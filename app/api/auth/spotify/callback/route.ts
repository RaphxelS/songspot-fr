import { NextResponse } from "next/server";
import {
  clearStateCookie,
  exchangeCodeForTokens,
  getStateCookie,
  setAuthCookies,
} from "@/lib/spotifyAuth";

export const dynamic = "force-dynamic";

function baseUrl(request: Request): string {
  const explicit = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  try {
    const u = new URL(request.url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "http://localhost:3000";
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const base = baseUrl(request);

  // User denied
  if (error) {
    await clearStateCookie().catch(() => {});
    const redirect = `${base}/?spotify=denied`;
    return NextResponse.redirect(redirect, 302);
  }

  if (!code || !state) {
    await clearStateCookie().catch(() => {});
    const redirect = `${base}/?spotify=error&reason=missing_code`;
    return NextResponse.redirect(redirect, 302);
  }

  const expected = await getStateCookie();
  // Always clear state cookie after reading
  await clearStateCookie().catch(() => {});

  if (!expected || expected !== state) {
    console.warn("[spotifyAuth] state mismatch");
    const redirect = `${base}/?spotify=error&reason=state_mismatch`;
    return NextResponse.redirect(redirect, 302);
  }

  const tokens = await exchangeCodeForTokens(code);
  if (!tokens) {
    const redirect = `${base}/?spotify=error&reason=token_exchange`;
    return NextResponse.redirect(redirect, 302);
  }

  await setAuthCookies(tokens);

  const redirect = `${base}/?spotify=connected`;
  return NextResponse.redirect(redirect, 302);
}
