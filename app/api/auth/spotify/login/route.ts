import { NextResponse } from "next/server";
import { generateState, getAuthorizeUrl, setStateCookie } from "@/lib/spotifyAuth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const base = (() => {
    try {
      const u = new URL(request.url);
      return `${u.protocol}//${u.host}`;
    } catch {
      return "http://localhost:3000";
    }
  })();
  if (!clientId) {
    // Redirect with error instead of JSON so browser stays on app with toast
    return NextResponse.redirect(`${base}/?spotify=error&reason=not_configured`, 302);
  }

  const state = generateState();
  await setStateCookie(state);

  const authorizeUrl = getAuthorizeUrl(state);
  if (!authorizeUrl) {
    return NextResponse.redirect(`${base}/?spotify=error&reason=authorize_failed`, 302);
  }

  return NextResponse.redirect(authorizeUrl, 302);
}
