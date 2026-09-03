import "server-only";

import {
  mapSpotifyTrackWithMeta,
  type LikedTrackWithMeta,
} from "@/lib/likedMapper";

const FETCH_TIMEOUT_MS = 8000;
const SPOTIFY_API = "https://api.spotify.com/v1";
const HARD_CEILING = 10000;
const PAGE_SIZE = 50;
/** Pause between paginated liked-track requests to avoid Spotify 429s. */
const PAGE_DELAY_MS = 200;
const MAX_429_RETRIES = 4;
const LIBRARY_CACHE_TTL_MS = 10 * 60 * 1000;

export class SpotifyRateLimitError extends Error {
  constructor(message = "Spotify rate limit exceeded") {
    super(message);
    this.name = "SpotifyRateLimitError";
  }
}

type LikedLibrary = {
  tracks: LikedTrackWithMeta[];
  total: number;
  expiresAt: number;
};

const libraryCache = new Map<string, LikedLibrary>();
const libraryInFlight = new Map<string, Promise<LikedLibrary>>();

function libraryCacheKey(token: string): string {
  return token.slice(-48);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithSpotifyToken(url: string, token: string): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    clearTimeout(t);
    return res;
  } catch (e) {
    clearTimeout(t);
    throw e;
  }
}

async function fetchWithSpotifyRetry(url: string, token: string): Promise<Response> {
  for (let attempt = 0; attempt <= MAX_429_RETRIES; attempt++) {
    const res = await fetchWithSpotifyToken(url, token);
    if (res.status !== 429) return res;
    if (attempt === MAX_429_RETRIES) return res;

    const retryAfterHeader = res.headers.get("Retry-After");
    const retrySec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : NaN;
    const waitMs = Number.isFinite(retrySec) ? Math.min(retrySec, 60) * 1000 : (attempt + 1) * 2000;
    console.warn(`[liked] Spotify 429 — retry in ${waitMs}ms (attempt ${attempt + 1})`);
    await sleep(waitMs);
  }
  throw new SpotifyRateLimitError();
}

function mapLikedPageItems(items: unknown[]): LikedTrackWithMeta[] {
  const out: LikedTrackWithMeta[] = [];
  for (const item of items) {
    const it = item as Record<string, unknown> | null;
    const raw = (it?.["track"] as unknown) ?? null;
    if (!raw || typeof raw !== "object") continue;
    const mapped = mapSpotifyTrackWithMeta(raw);
    if (mapped) out.push(mapped);
  }
  return out;
}

/** Fetch every liked track from Spotify (uncached). */
export async function fetchLikedLibraryFromSpotify(token: string): Promise<{
  tracks: LikedTrackWithMeta[];
  total: number;
}> {
  const all: LikedTrackWithMeta[] = [];
  let offset = 0;
  let totalVal = 0;

  while (true) {
    const url = `${SPOTIFY_API}/me/tracks?limit=${PAGE_SIZE}&offset=${offset}&market=FR`;
    const res = await fetchWithSpotifyRetry(url, token);

    if (res.status === 429) {
      throw new SpotifyRateLimitError();
    }
    if (!res.ok) {
      throw new Error(`Spotify liked fetch failed: ${res.status}`);
    }

    const data = (await res.json()) as Record<string, unknown>;
    if (offset === 0 && typeof data["total"] === "number") {
      totalVal = data["total"] as number;
    }

    const items = Array.isArray(data["items"]) ? (data["items"] as unknown[]) : [];
    if (items.length === 0) break;

    all.push(...mapLikedPageItems(items));

    offset += PAGE_SIZE;
    if (totalVal > 0 && all.length >= totalVal) break;
    if (offset > HARD_CEILING) break;

    if (items.length === PAGE_SIZE) {
      await sleep(PAGE_DELAY_MS);
    }
  }

  return { tracks: all, total: totalVal || all.length };
}

/** Cached liked library — dedupes concurrent fetches per user token. */
export async function getCachedLikedLibrary(token: string): Promise<{
  tracks: LikedTrackWithMeta[];
  total: number;
}> {
  const key = libraryCacheKey(token);
  const now = Date.now();
  const cached = libraryCache.get(key);
  if (cached && cached.expiresAt > now) {
    return { tracks: cached.tracks, total: cached.total };
  }

  let pending = libraryInFlight.get(key);
  if (!pending) {
    pending = fetchLikedLibraryFromSpotify(token)
      .then((result) => {
        const entry: LikedLibrary = {
          tracks: result.tracks,
          total: result.total,
          expiresAt: Date.now() + LIBRARY_CACHE_TTL_MS,
        };
        libraryCache.set(key, entry);
        libraryInFlight.delete(key);
        return entry;
      })
      .catch((err) => {
        libraryInFlight.delete(key);
        throw err;
      });
    libraryInFlight.set(key, pending);
  }

  const result = await pending;
  return { tracks: result.tracks, total: result.total };
}

export async function fetchAllLikedTracksWithMeta(token: string): Promise<{
  tracks: LikedTrackWithMeta[];
  total: number;
}> {
  return getCachedLikedLibrary(token);
}

/** For tests — clear in-memory liked library cache. */
export function __clearLikedLibraryCache(): void {
  libraryCache.clear();
  libraryInFlight.clear();
}
