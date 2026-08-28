import "server-only";

import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/spotifyAuth";
import { TrackSchema } from "@/lib/validation";
import type { Track } from "@/lib/catalog";

export const dynamic = "force-dynamic";

const FETCH_TIMEOUT_MS = 5000;

async function fetchWithTimeout(url: string, token: string): Promise<Response> {
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

function normalizeReleaseDate(raw: string | null | undefined): string {
  if (!raw) return "2020-01-01";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}$/.test(raw)) return `${raw}-01`;
  if (/^\d{4}$/.test(raw)) return `${raw}-01-01`;
  return "2020-01-01";
}

function deriveEra(releaseDate: string): Track["era"] {
  const year = parseInt(releaseDate.slice(0, 4), 10);
  if (Number.isNaN(year)) return "2020s";
  if (year < 2000) return "classic";
  if (year < 2010) return "2000s";
  if (year < 2020) return "2010s";
  return "2020s";
}

function mapSpotifyTrack(raw: unknown): Track | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = r["id"];
  const name = r["name"];
  const previewUrl = (r["preview_url"] as string | null) ?? null;
  const popularity = r["popularity"];
  const album = r["album"] as Record<string, unknown> | undefined;
  const artists = r["artists"] as Array<Record<string, unknown>> | undefined;

  if (typeof id !== "string" || id.length === 0) return null;
  if (typeof name !== "string" || name.length === 0) return null;

  let artist = "Unknown";
  if (Array.isArray(artists) && artists.length > 0) {
    const names = artists
      .map((a) => (typeof a["name"] === "string" ? (a["name"] as string) : ""))
      .filter((n) => n.length > 0);
    if (names.length > 0) artist = names.join(", ");
  }

  let albumName = "Unknown";
  if (album && typeof album["name"] === "string" && (album["name"] as string).length > 0) {
    albumName = album["name"] as string;
  }

  let cover = "";
  if (album && Array.isArray(album["images"]) && (album["images"] as unknown[]).length > 0) {
    const imgs = album["images"] as Array<Record<string, unknown>>;
    const first = imgs.find((img) => typeof img["url"] === "string");
    if (first && typeof first["url"] === "string") cover = first["url"] as string;
  }
  // If no https cover, skip track (keep validation)
  if (!cover || !cover.startsWith("https://")) {
    return null;
  }

  const rawDate = (album?.["release_date"] as string | undefined) ?? null;
  const releaseDate = normalizeReleaseDate(rawDate);
  const pop = typeof popularity === "number" ? Math.round(popularity) : 50;
  const clampedPop = Math.max(0, Math.min(100, pop));

  // For liked mode, preview may be null — we keep null and let client enrich via /api/preview
  // But TrackSchema requires https URL, so we need to handle null gracefully:
  // If preview null, we keep as null and caller will treat as optional. For validation, we use a lenient schema.
  // We store preview_url as string | null in intermediate, but final Track requires string.
  // To satisfy Track type, we either:
  // - keep preview_url as empty string and let Zod filter later? Instead we store null and handle in route.
  // Best: if preview null, set preview_url to "" placeholder, but mark source and allow later enrichment.
  // However we want to return tracks even without preview, with preview_url = "" or null?
  // Let's set preview_url to null in raw and then if valid, map to Track with fallback empty string — but then we lose info.
  // Simpler: we return Track with preview_url as empty string not validated, but client will know to fetch.
  // We'll bypass strict Zod for liked catalog and return raw mapped with preview_url possibly null, then
  // transform to Track by setting preview_url to a sentinel that will be replaced client-side, but we can also
  // set it to "https://placeholder.invalid" and rely on preview fetch — but better to keep null and extend Track type.
  // For now, we allow preview_url to be null and cast Track with nullable preview.
  // To keep type safety, we will use TrackSchema.safeParse only for tracks WITH preview; for others we skip Zod and push lenient.
  const era = deriveEra(releaseDate);

  // If preview null, we keep as empty string not validated — but we will push with a flag
  // Instead we construct Track-like object and validate leniently:
  const base = {
    id: id as string,
    title: name as string,
    artist,
    album: albumName,
    cover,
    popularity: clampedPop,
    release_date: releaseDate,
    era,
    source: "spotify" as const,
  };

  // If preview present and valid URL, include it; else leave as "" to be replaced
  // We will return with preview_url = previewUrl ?? "" and not run through strict Zod for null case
  // Client will detect "" or null and call /api/preview
  const mapped: Record<string, unknown> = {
    ...base,
    preview_url: previewUrl ?? "",
  };

  // If preview null, we skip strict validation but still return track with empty preview_url
  // The client must handle missing preview (fetchBestPreview).
  if (!previewUrl) {
    // Return as Track with empty preview_url — will be enriched client side
    // To satisfy TrackSchema, we would fail; so we return lenient Track (cast)
    // Keep preview_url as "" — client will fetch
    return mapped as unknown as Track;
  }

  // If preview present, validate strictly
  const parsed = TrackSchema.safeParse(mapped);
  if (!parsed.success) return null;
  return parsed.data;
}

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

  const url = `https://api.spotify.com/v1/me/tracks?limit=${limit}&offset=${offset}&market=FR`;

  let res: Response;
  try {
    res = await fetchWithTimeout(url, token);
  } catch (e) {
    console.warn("[liked] fetch error", e);
    return NextResponse.json({ error: "Erreur de connexion à Spotify" }, { status: 502 });
  }

  if (res.status === 401) {
    // Token invalid even after refresh — clear?
    return NextResponse.json({ error: "Session Spotify expirée — veuillez vous reconnecter" }, { status: 401 });
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.warn(`[liked] Spotify error ${res.status} ${txt.slice(0, 200)}`);
    return NextResponse.json({ error: "Erreur lors du chargement des titres aimés" }, { status: 502 });
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return NextResponse.json({ error: "Réponse Spotify invalide" }, { status: 502 });
  }

  const d = data as Record<string, unknown>;
  const total = typeof d["total"] === "number" ? (d["total"] as number) : null;
  const items = Array.isArray(d["items"]) ? (d["items"] as unknown[]) : [];

  const tracks: Track[] = [];
  let playableCount = 0;

  for (const item of items) {
    const it = item as Record<string, unknown> | null;
    const raw = (it?.["track"] as unknown) ?? null;
    if (!raw || typeof raw !== "object") continue;
    const mapped = mapSpotifyTrack(raw);
    if (!mapped) continue;
    // Count playable: preview_url truthy
    if (mapped.preview_url && mapped.preview_url.length > 0 && mapped.preview_url.startsWith("https://")) {
      playableCount++;
    }
    tracks.push(mapped);
  }

  // Headers: expose total for pagination
  return NextResponse.json(
    { tracks, total, limit, offset, playableCount },
    {
      headers: {
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    }
  );
}
