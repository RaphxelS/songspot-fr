import "server-only";

import { cookies } from "next/headers";

// ── Constants ─────────────────────────────────────────────────────────────
const SPOTIFY_ACCOUNTS = "https://accounts.spotify.com";
const SPOTIFY_API = "https://api.spotify.com/v1";
const FETCH_TIMEOUT_MS = 5000;
const STATE_COOKIE = "spotify_auth_state";
const ACCESS_COOKIE = "spotify_access_token";
const REFRESH_COOKIE = "spotify_refresh_token";
const EXPIRES_COOKIE = "spotify_token_expires_at";
export const SPOTIFY_SCOPE = "user-library-read";

export type SpotifyTokens = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type?: string;
  scope?: string;
};

export type SpotifyUser = {
  id: string;
  display_name: string | null;
  email?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────
async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    clearTimeout(t);
    return res;
  } catch (e) {
    clearTimeout(t);
    throw e;
  }
}

function randomState(bytes = 16): string {
  // Node 18+ has crypto.randomBytes? In edge, use global crypto
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cryptoNode = require("crypto") as typeof import("crypto");
    return cryptoNode.randomBytes(bytes).toString("hex");
  } catch {
    const arr = new Uint8Array(bytes);
    crypto.getRandomValues(arr);
    return Array.from(arr)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
}

// Exported for tests
export function generateState(): string {
  return randomState(16);
}

export function getRedirectUri(): string {
  const explicit = process.env.SPOTIFY_REDIRECT_URI?.trim();
  if (explicit && explicit.length > 0) return explicit;
  const base = process.env.NEXT_PUBLIC_BASE_URL?.trim() || "http://localhost:3000";
  const normalized = base.replace(/\/$/, "");
  return `${normalized}/api/auth/spotify/callback`;
}

export function getAuthorizeUrl(state: string): string | null {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  if (!clientId) return null;
  const redirectUri = getRedirectUri();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: SPOTIFY_SCOPE,
    redirect_uri: redirectUri,
    state,
  });
  return `${SPOTIFY_ACCOUNTS}/authorize?${params.toString()}`;
}

// ── Cookie helpers ───────────────────────────────────────────────────────
function isSecureRequest(): boolean {
  // Only use Secure on https — http://localhost with Secure flag drops cookies in production
  const uri = getRedirectUri();
  return uri.startsWith("https://");
}

export async function setAuthCookies(tokens: SpotifyTokens): Promise<void> {
  const jar = await cookies();
  const secure = isSecureRequest();
  const accessMaxAge = Math.max(60, (tokens.expires_in ?? 3600) - 10);
  const expiresAt = Date.now() + accessMaxAge * 1000;

  jar.set(ACCESS_COOKIE, tokens.access_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: accessMaxAge,
  });
  jar.set(EXPIRES_COOKIE, String(expiresAt), {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: accessMaxAge,
  });
  if (tokens.refresh_token) {
    jar.set(REFRESH_COOKIE, tokens.refresh_token, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30d
    });
  }
}

export async function setStateCookie(state: string): Promise<void> {
  const jar = await cookies();
  const secure = isSecureRequest();
  jar.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 min
  });
}

export async function getStateCookie(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(STATE_COOKIE)?.value ?? null;
}

export async function clearStateCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(STATE_COOKIE);
}

export async function clearAuthCookies(): Promise<void> {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
  jar.delete(EXPIRES_COOKIE);
  jar.delete(STATE_COOKIE);
}

export async function getStoredTokens(): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
}> {
  const jar = await cookies();
  const accessToken = jar.get(ACCESS_COOKIE)?.value ?? null;
  const refreshToken = jar.get(REFRESH_COOKIE)?.value ?? null;
  const expiresRaw = jar.get(EXPIRES_COOKIE)?.value ?? null;
  const expiresAt = expiresRaw ? parseInt(expiresRaw, 10) : null;
  return {
    accessToken,
    refreshToken,
    expiresAt: expiresAt && !Number.isNaN(expiresAt) ? expiresAt : null,
  };
}

// ── Token exchange ───────────────────────────────────────────────────────
export async function exchangeCodeForTokens(code: string): Promise<SpotifyTokens | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const redirectUri = getRedirectUri();
  const creds = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    });

    const res = await fetchWithTimeout(`${SPOTIFY_ACCOUNTS}/api/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${creds}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.warn(`[spotifyAuth] token exchange failed ${res.status} ${txt.slice(0, 200)}`);
      return null;
    }

    const data = (await res.json()) as SpotifyTokens;
    if (!data.access_token) return null;
    return data;
  } catch (e) {
    console.warn("[spotifyAuth] exchangeCodeForTokens error", e);
    return null;
  }
}

export async function refreshAccessToken(refreshToken: string): Promise<SpotifyTokens | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const creds = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  try {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });

    const res = await fetchWithTimeout(`${SPOTIFY_ACCOUNTS}/api/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${creds}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.warn(`[spotifyAuth] refresh failed ${res.status} ${txt.slice(0, 200)}`);
      return null;
    }

    const data = (await res.json()) as SpotifyTokens;
    if (!data.access_token) return null;
    // Spotify may not return a new refresh_token; keep old one
    if (!data.refresh_token) {
      data.refresh_token = refreshToken;
    }
    return data;
  } catch (e) {
    console.warn("[spotifyAuth] refreshAccessToken error", e);
    return null;
  }
}

/**
 * Returns a valid access token, refreshing if expiring within 60s.
 * If refreshing succeeds, cookies are updated and new token is returned.
 * If no token or refresh fails, returns null.
 */
export async function getValidAccessToken(): Promise<string | null> {
  const { accessToken, refreshToken, expiresAt } = await getStoredTokens();
  if (!accessToken) return null;

  const now = Date.now();
  const isExpiring = !expiresAt || expiresAt < now + 60_000;

  if (!isExpiring) {
    return accessToken;
  }

  if (!refreshToken) {
    return accessToken; // no refresh token, try using current even if expiring
  }

  const refreshed = await refreshAccessToken(refreshToken);
  if (!refreshed) {
    return accessToken; // fallback to stale token; caller will get 401 and handle
  }

  await setAuthCookies(refreshed);
  return refreshed.access_token;
}

// ── User profile ─────────────────────────────────────────────────────────
export async function fetchSpotifyUser(accessToken: string): Promise<SpotifyUser | null> {
  try {
    const res = await fetchWithTimeout(`${SPOTIFY_API}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    const id = typeof data["id"] === "string" ? (data["id"] as string) : null;
    if (!id) return null;
    const displayName = typeof data["display_name"] === "string" ? (data["display_name"] as string) : null;
    const email = typeof data["email"] === "string" ? (data["email"] as string) : undefined;
    return { id, display_name: displayName, email };
  } catch (e) {
    console.warn("[spotifyAuth] fetchSpotifyUser error", e);
    return null;
  }
}

// For tests — clear in-memory? Cookies are via next/headers, so just expose helpers
export async function __clearAllAuthCookiesForTests(): Promise<void> {
  await clearAuthCookies();
}
