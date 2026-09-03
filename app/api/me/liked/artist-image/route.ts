import "server-only";

import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/spotifyAuth";
import { getAccessToken } from "@/lib/spotify";
import { fetchWithSpotifyToken, pickSpotifyArtistImage } from "@/lib/likedFetch";

const SPOTIFY_API = "https://api.spotify.com/v1";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "id requis" }, { status: 400 });
  }

  const appToken = await getAccessToken();
  const tokens = appToken && appToken !== token ? [appToken, token] : [token];

  for (const apiToken of tokens) {
    const res = await fetchWithSpotifyToken(`${SPOTIFY_API}/artists/${id}`, apiToken);
    if (!res.ok) continue;

    const data = (await res.json()) as Record<string, unknown>;
    const url = pickSpotifyArtistImage(data["images"]);
    if (!url) return NextResponse.json({ url: null }, { status: 404 });

    return NextResponse.json({ url });
  }

  return NextResponse.json({ url: null }, { status: 404 });
}
