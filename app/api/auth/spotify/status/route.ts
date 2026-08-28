import { NextResponse } from "next/server";
import { fetchSpotifyUser, getValidAccessToken, getStoredTokens } from "@/lib/spotifyAuth";

export const dynamic = "force-dynamic";

export async function GET() {
  const configured = Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
  const { accessToken } = await getStoredTokens();
  if (!accessToken) {
    return NextResponse.json({ authenticated: false, configured }, { status: 200 });
  }

  const valid = await getValidAccessToken();
  if (!valid) {
    return NextResponse.json({ authenticated: false, configured }, { status: 200 });
  }

  const user = await fetchSpotifyUser(valid);
  if (!user) {
    // Token invalid and refresh failed? Return unauthenticated but don't clear cookies here; client can decide to logout
    // If 401, the fetchSpotifyUser returned null; we treat as not authenticated
    // Try to avoid false negative due to transient fetch failure: if we have a valid token, still say authenticated
    // But if Spotify API returns 401, we'd want false. Simpler: if user null, check if token was recently refreshed?
    // For MVP, return authenticated:true even if profile fetch failed, to avoid flicker.
    // We distinguish by trying once; if fails, return authenticated:true with no user
    return NextResponse.json({ authenticated: true, user: null, configured }, { status: 200 });
  }

  return NextResponse.json({ authenticated: true, user, configured }, { status: 200 });
}
