import "server-only";

import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/spotifyAuth";
import {
  buildArtistCategories,
  buildGenreCategories,
  profilesToGenresMap,
  resolveArtistImageUrl,
} from "@/lib/likedCategories";
import {
  fetchAllLikedTracksWithMeta,
  fetchArtistProfilesMap,
} from "@/lib/likedFetch";
import { SpotifyRateLimitError } from "@/lib/likedLibraryCache";

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
      imageUrl: resolveArtistImageUrl(
        artist.id,
        tracks,
        artistProfiles.get(artist.id)?.imageUrl,
      ),
    }));
    const genres = buildGenreCategories(tracks, artistGenresMap);

    return NextResponse.json(
      { artists, genres, totalLiked: total },
      {
        headers: {
          "Cache-Control": "private, no-cache, must-revalidate",
        },
      },
    );
  } catch (e) {
    if (e instanceof SpotifyRateLimitError) {
      return NextResponse.json(
        { error: "Spotify limite les requêtes — patientez une minute puis réessayez." },
        { status: 429 },
      );
    }
    console.warn("[liked/categories] error", e);
    return NextResponse.json({ error: "Erreur lors du chargement des catégories" }, { status: 502 });
  }
}
