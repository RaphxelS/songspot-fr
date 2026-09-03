import "server-only";

import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/spotifyAuth";
import {
  buildArtistCategories,
  buildGenreCategories,
  profilesToGenresMap,
} from "@/lib/likedCategories";
import {
  fetchAllLikedTracksWithMeta,
  fetchArtistProfilesMap,
} from "@/lib/likedFetch";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ error: "Non authentifié — connectez votre compte Spotify" }, { status: 401 });
  }

  try {
    const { tracks, total } = await fetchAllLikedTracksWithMeta(token);
    const artistIds = tracks.map((t) => t.meta.primaryArtistId).filter((id) => id.length > 0);
    const artistProfiles = await fetchArtistProfilesMap(token, artistIds);
    const artistGenresMap = profilesToGenresMap(artistProfiles);

    const artists = buildArtistCategories(tracks).map((artist) => ({
      ...artist,
      imageUrl: artistProfiles.get(artist.id)?.imageUrl,
    }));
    const genres = buildGenreCategories(tracks, artistGenresMap);

    return NextResponse.json(
      { artists, genres, totalLiked: total },
      {
        headers: {
          "Cache-Control": "private, max-age=300, must-revalidate",
        },
      },
    );
  } catch (e) {
    console.warn("[liked/categories] error", e);
    return NextResponse.json({ error: "Erreur lors du chargement des catégories" }, { status: 502 });
  }
}
