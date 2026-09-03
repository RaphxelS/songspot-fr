import "server-only";

import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/spotifyAuth";
import type { Track } from "@/lib/catalog";
import {
  dedupeTracksById,
  filterLikedByArtist,
  filterLikedByGenre,
  shuffleTracks,
} from "@/lib/likedCategories";
import {
  fetchAllLikedTracksWithMeta,
  fetchArtistGenresMap,
  fetchArtistTopTracks,
  fetchGenreRecommendations,
  searchArtistTracks,
} from "@/lib/likedFetch";

export const dynamic = "force-dynamic";

type Scope = "all" | "artist" | "genre";

function parseScope(raw: string | null): Scope | null {
  if (raw === "all" || raw === "artist" || raw === "genre") return raw;
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scope = parseScope(searchParams.get("scope"));
  const artistId = searchParams.get("artistId") ?? "";
  const genre = searchParams.get("genre") ?? "";
  const enrich = searchParams.get("enrich") === "1";

  if (!scope) {
    return NextResponse.json({ error: "Paramètre scope invalide" }, { status: 400 });
  }

  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ error: "Non authentifié — connectez votre compte Spotify" }, { status: 401 });
  }

  try {
    const { tracks: allLiked } = await fetchAllLikedTracksWithMeta(token);

    if (scope === "all") {
      const shuffled = shuffleTracks(allLiked.map((t) => t.track));
      return NextResponse.json({
        tracks: shuffled,
        likedCount: shuffled.length,
        enrichedCount: 0,
      });
    }

    if (scope === "artist") {
      if (!artistId) {
        return NextResponse.json({ error: "Paramètre artistId requis" }, { status: 400 });
      }

      const filtered = filterLikedByArtist(allLiked, artistId);
      let pool: Track[] = filtered.map((t) => t.track);
      const likedCount = pool.length;

      if (enrich && filtered.length > 0) {
        const artistName = filtered[0].meta.primaryArtistName;
        const [topTracks, searchTracks] = await Promise.all([
          fetchArtistTopTracks(token, artistId),
          searchArtistTracks(token, artistName, artistId),
        ]);
        pool = dedupeTracksById([...pool, ...topTracks, ...searchTracks]);
      }

      return NextResponse.json({
        tracks: shuffleTracks(pool),
        likedCount,
        enrichedCount: Math.max(0, pool.length - likedCount),
      });
    }

    if (scope === "genre") {
      if (!genre) {
        return NextResponse.json({ error: "Paramètre genre requis" }, { status: 400 });
      }

      const artistIds = allLiked.map((t) => t.meta.primaryArtistId).filter((id) => id.length > 0);
      const artistGenresMap = await fetchArtistGenresMap(token, artistIds);
      const filtered = filterLikedByGenre(allLiked, genre, artistGenresMap);
      let pool: Track[] = filtered.map((t) => t.track);
      const likedCount = pool.length;

      if (enrich) {
        const seedTrackIds = filtered.slice(0, 5).map((t) => t.track.id);
        const recommended = await fetchGenreRecommendations(token, genre, seedTrackIds);
        pool = dedupeTracksById([...pool, ...recommended]);
      }

      return NextResponse.json({
        tracks: shuffleTracks(pool),
        likedCount,
        enrichedCount: Math.max(0, pool.length - likedCount),
      });
    }

    return NextResponse.json({ error: "Scope non supporté" }, { status: 400 });
  } catch (e) {
    console.warn("[liked/catalog] error", e);
    return NextResponse.json({ error: "Erreur lors du chargement du catalogue" }, { status: 502 });
  }
}
