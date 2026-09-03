import "server-only";

import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/spotifyAuth";
import { isPlayableTrack } from "@/lib/likedMapper";
import { getCachedLikedLibrary, SpotifyRateLimitError } from "@/lib/likedLibraryCache";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get("limit");
  const offsetParam = searchParams.get("offset");

  let limit = 50;
  if (limitParam) {
    const n = parseInt(limitParam, 10);
    if (!Number.isNaN(n) && n > 0 && n <= 50) limit = n;
  }
  let offset = 0;
  if (offsetParam) {
    const n = parseInt(offsetParam, 10);
    if (!Number.isNaN(n) && n >= 0) offset = n;
  }

  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ error: "Non authentifié — connectez votre compte Spotify" }, { status: 401 });
  }

  try {
    const { tracks: allCached, total } = await getCachedLikedLibrary(token);
    const pageTracks = allCached.slice(offset, offset + limit).map((t) => t.track);
    const playableCount = pageTracks.filter((t) => isPlayableTrack(t)).length;

    return NextResponse.json(
      { tracks: pageTracks, total, limit, offset, playableCount },
      {
        headers: {
          "Cache-Control": "private, max-age=0, must-revalidate",
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
    console.warn("[liked] cache fetch error", e);
    return NextResponse.json({ error: "Erreur lors du chargement des titres aimés" }, { status: 502 });
  }
}
