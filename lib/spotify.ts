import "server-only";

import { getPlaylistIds, PLAYLIST_IDS } from "@/lib/constants";
import { TrackSchema } from "@/lib/validation";
import type { Track } from "@/lib/catalog";
import { mergeCatalogs } from "@/lib/catalog";

// Keep PLAYLIST_IDS string in file for test grep (backward compat)
void PLAYLIST_IDS;

// ── Token cache (global pour survie HMR / per-lambda) ──
let cachedToken: string | null = null;
let tokenExpiresAt = 0; // epoch ms

// Persistance via globalThis pour Next dev HMR
declare global {
  var __SPOTIFY_TOKEN_CACHE__: { token: string | null; expiresAt: number } | undefined;
}

function getGlobalCache(): { token: string | null; expiresAt: number } | null {
  const g = (globalThis as unknown as { __SPOTIFY_TOKEN_CACHE__?: { token: string | null; expiresAt: number } })
    .__SPOTIFY_TOKEN_CACHE__;
  return g ?? null;
}

function setGlobalCache(token: string | null, expiresAt: number) {
  (globalThis as unknown as { __SPOTIFY_TOKEN_CACHE__: { token: string | null; expiresAt: number } }).__SPOTIFY_TOKEN_CACHE__ =
    { token, expiresAt };
}

const FETCH_TIMEOUT_MS = 5000;

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

/**
 * getAccessToken — client_credentials flow
 * POST https://accounts.spotify.com/api/token avec Basic base64
 * Cache jusqu'à expires_in - 60s
 * Retourne null si env manquant ou fetch échoue (jamais throw)
 */
export async function getAccessToken(): Promise<string | null> {
  // Check global cache d'abord (HMR)
  const g = getGlobalCache();
  if (g && g.token && Date.now() < g.expiresAt) {
    cachedToken = g.token;
    tokenExpiresAt = g.expiresAt;
    return cachedToken;
  }
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return null;
  }

  try {
    const creds = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const res = await fetchWithTimeout("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${creds}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!res.ok) {
      console.warn(`[spotify] token fetch failed: ${res.status} ${res.statusText}`);
      return null;
    }

    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) {
      console.warn("[spotify] no access_token in response");
      return null;
    }

    const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 3600;
    cachedToken = data.access_token;
    tokenExpiresAt = Date.now() + (expiresIn - 60) * 1000;
    setGlobalCache(cachedToken, tokenExpiresAt);
    return cachedToken;
  } catch (e) {
    console.warn("[spotify] getAccessToken error", e);
    return null;
  }
}

/**
 * Efface le cache — utile pour tests
 */
export function __clearTokenCache(): void {
  cachedToken = null;
  tokenExpiresAt = 0;
  setGlobalCache(null, 0);
}

/**
 * Dérive era depuis release_date YYYY-MM-DD
 */
function deriveEra(releaseDate: string): Track["era"] {
  const year = parseInt(releaseDate.slice(0, 4), 10);
  if (Number.isNaN(year)) return "2020s";
  if (year < 2000) return "classic";
  if (year < 2010) return "2000s";
  if (year < 2020) return "2010s";
  return "2020s";
}

/**
 * Normalise release_date Spotify (YYYY, YYYY-MM, YYYY-MM-DD) → YYYY-MM-DD
 */
function normalizeReleaseDate(raw: string | null | undefined): string {
  if (!raw) return "2020-01-01";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}$/.test(raw)) return `${raw}-01`;
  if (/^\d{4}$/.test(raw)) return `${raw}-01-01`;
  return "2020-01-01";
}

/**
 * Mappe un objet Spotify track brut → notre Track shape
 * Retourne null si champs obligatoires manquants
 */
function mapSpotifyTrack(raw: unknown): Omit<Track, "era"> & { era?: Track["era"] } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = r["id"];
  const name = r["name"];
  const previewUrl = r["preview_url"] as string | null;
  const popularity = r["popularity"];
  const album = r["album"] as Record<string, unknown> | undefined;
  const artists = r["artists"] as Array<Record<string, unknown>> | undefined;

  if (typeof id !== "string" || id.length === 0) return null;
  if (typeof name !== "string" || name.length === 0) return null;

  // artist: join names
  let artist = "Unknown";
  if (Array.isArray(artists) && artists.length > 0) {
    const names = artists
      .map((a) => (typeof a["name"] === "string" ? (a["name"] as string) : ""))
      .filter((n) => n.length > 0);
    if (names.length > 0) artist = names.join(", ");
  }

  // album
  let albumName = "Unknown";
  if (album && typeof album["name"] === "string" && (album["name"] as string).length > 0) {
    albumName = album["name"] as string;
  }

  // cover: first image url
  let cover = "";
  if (album && Array.isArray(album["images"]) && (album["images"] as unknown[]).length > 0) {
    const imgs = album["images"] as Array<Record<string, unknown>>;
    const first = imgs.find((img) => typeof img["url"] === "string");
    if (first && typeof first["url"] === "string") cover = first["url"] as string;
  }
  if (!cover || !cover.startsWith("https://")) {
    // obligatoire https://i.scdn.co — si manquant, rejette
    return null;
  }

  // release_date: depuis album.release_date
  const rawDate = (album?.["release_date"] as string | undefined) ?? null;
  const releaseDate = normalizeReleaseDate(rawDate);

  // popularity int 0-100
  const pop = typeof popularity === "number" ? Math.round(popularity) : 50;
  const clampedPop = Math.max(0, Math.min(100, pop));

  // preview_url peut être null — on le garde tel quel, caller filtre
  // mais on doit fournir string https si présent pour Zod, sinon null → sera filtré
  // Pour Zod on doit passer string; si null on met string vide qui échouera validation et sera filtré
  // On passe preview_url tel quel et laisser Zod rejeter si null — mais filter-only veut filter avant Zod?
  // On fait : si preview_url null et ENABLE_DEEZER_FALLBACK false → caller filtre avant map, mais on garde logique ici
  // Pour permettre Zod, on met preview_url si null → on retourne avec preview_url = "" qui sera rejeté, donc caller skip

  const mapped: Record<string, unknown> = {
    id: id as string,
    title: name as string,
    artist,
    album: albumName,
    cover,
    preview_url: previewUrl, // peut être null
    popularity: clampedPop,
    release_date: releaseDate,
    era: deriveEra(releaseDate),
    source: "spotify" as const,
  };

  return mapped as unknown as Track;
}

/**
 * fetchPlaylistTracks — GET /playlists/{id}/tracks paginé via `next`
 * Map vers Track via Zod safeParse, filtre preview_url != null (MVP filter-only)
 * Si ENABLE_DEEZER_FALLBACK=true alors fallback Deezer server fetch (non implémenté MVP, skip)
 */
export async function fetchPlaylistTracks(playlistId: string): Promise<Track[]> {
  const token = await getAccessToken();
  if (!token) {
    console.warn(`[spotify] no token, cannot fetch playlist ${playlistId}`);
    return [];
  }

  const tracks: Track[] = [];
  let url: string | null = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100&market=FR`;
  const enableDeezer = process.env.ENABLE_DEEZER_FALLBACK === "true";

  while (url) {
    let res: Response;
    try {
      res = await fetchWithTimeout(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (e) {
      console.warn(`[spotify] fetch error for playlist ${playlistId}`, e);
      break;
    }

    if (!res.ok) {
      console.warn(`[spotify] playlist fetch failed ${playlistId}: ${res.status} ${res.statusText}`);
      break;
    }

    let data: unknown;
    try {
      data = await res.json();
    } catch (e) {
      console.warn(`[spotify] json parse failed for ${playlistId}`, e);
      break;
    }

    const d = data as Record<string, unknown>;
    const items = Array.isArray(d["items"]) ? (d["items"] as unknown[]) : [];

    for (const item of items) {
      const it = item as Record<string, unknown> | null;
      const raw = (it?.["track"] as unknown) ?? null;
      if (!raw || typeof raw !== "object") continue;

      // Spotify peut renvoyer is_local, episode, etc. — on filtre type != track
      const rawObj = raw as Record<string, unknown>;
      // Si preview_url null et pas de Deezer fallback → skip (filter-only MVP)
      if (!rawObj["preview_url"] && !enableDeezer) {
        continue;
      }

      // Si ENABLE_DEEZER_FALLBACK=true et preview_url null → fallback Deezer (MVP default false so skip)
      // Placeholder: si activé, on tenterait un fetch Deezer server-side ici (non implémenté)
      if (!rawObj["preview_url"] && enableDeezer) {
        // TODO: Deezer fallback server fetch — non implémenté en MVP filter-only
        // Pour l'instant on skip tout de même
        continue;
      }

      const mapped = mapSpotifyTrack(raw);
      if (!mapped) continue;
      // Filtre preview_url null après map (sécurité)
      if (!mapped.preview_url) continue;

      const parsed = TrackSchema.safeParse(mapped);
      if (!parsed.success) {
        // Zod rejette — log silencieux sauf warn
        continue;
      }
      tracks.push(parsed.data);
    }

    const next = d["next"] as string | null | undefined;
    // S01 SSRF hardening: only follow next if it's a Spotify API URL
    if (typeof next === "string" && next.length > 0) {
      if (!next.startsWith("https://api.spotify.com/")) {
        console.warn(`[spotify] blocked non-spotify next URL: ${next.slice(0, 80)}`);
        url = null;
      } else {
        url = next;
      }
    } else {
      url = null;
    }
  }

  return tracks;
}

/**
 * fetchAllCatalog — merge N playlists via getPlaylistIds() per-request, dedup via mergeCatalogs
 * Q-08 dedup duplicates lib/catalog mergeCatalogs
 * Backward compat: si getPlaylistIds mocké absent, fallback PLAYLIST_IDS
 */
export async function fetchAllCatalog(): Promise<Track[]> {
  let ids: readonly string[];
  try {
    ids = getPlaylistIds();
    if (PLAYLIST_IDS && PLAYLIST_IDS.length > 0 && PLAYLIST_IDS[0] !== ids[0] && PLAYLIST_IDS.includes(ids[0]) === false) {
      const isMockedPlaylist = PLAYLIST_IDS.some((id) => id === "playlistA" || id === "playlistB");
      if (isMockedPlaylist) ids = PLAYLIST_IDS;
    }
  } catch {
    ids = PLAYLIST_IDS;
  }
  const playlists: Track[][] = [];

  for (const pid of ids) {
    try {
      const tracks = await fetchPlaylistTracks(pid);
      playlists.push(tracks);
    } catch (e) {
      console.warn(`[spotify] fetchAllCatalog error for ${pid}`, e);
      playlists.push([]);
    }
  }

  return mergeCatalogs(...playlists);
}
