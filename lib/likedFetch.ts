import "server-only";

import {
  mapSpotifyTrackWithMeta,
  type LikedTrackWithMeta,
} from "@/lib/likedMapper";
import type { Track } from "@/lib/catalog";
import type { ArtistGenresMap } from "@/lib/likedCategories";

const FETCH_TIMEOUT_MS = 8000;
const SPOTIFY_API = "https://api.spotify.com/v1";
const HARD_CEILING = 10000;

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

export async function fetchAllLikedTracksWithMeta(token: string): Promise<{
  tracks: LikedTrackWithMeta[];
  total: number;
}> {
  const all: LikedTrackWithMeta[] = [];
  let offset = 0;
  const pageSize = 50;
  let totalVal = 0;

  while (true) {
    const url = `${SPOTIFY_API}/me/tracks?limit=${pageSize}&offset=${offset}&market=FR`;
    const res = await fetchWithSpotifyToken(url, token);

    if (!res.ok) {
      throw new Error(`Spotify liked fetch failed: ${res.status}`);
    }

    const data = (await res.json()) as Record<string, unknown>;
    if (offset === 0 && typeof data["total"] === "number") {
      totalVal = data["total"] as number;
    }

    const items = Array.isArray(data["items"]) ? (data["items"] as unknown[]) : [];
    if (items.length === 0) break;

    for (const item of items) {
      const it = item as Record<string, unknown> | null;
      const raw = (it?.["track"] as unknown) ?? null;
      if (!raw || typeof raw !== "object") continue;
      const mapped = mapSpotifyTrackWithMeta(raw);
      if (mapped) all.push(mapped);
    }

    offset += pageSize;
    if (totalVal > 0 && all.length >= totalVal) break;
    if (offset > HARD_CEILING) break;
  }

  return { tracks: all, total: totalVal || all.length };
}

export async function fetchArtistGenresMap(
  token: string,
  artistIds: string[],
): Promise<ArtistGenresMap> {
  const map: ArtistGenresMap = new Map();
  const unique = [...new Set(artistIds.filter((id) => id.length > 0))];

  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    const url = `${SPOTIFY_API}/artists?ids=${batch.join(",")}`;
    const res = await fetchWithSpotifyToken(url, token);
    if (!res.ok) continue;

    const data = (await res.json()) as Record<string, unknown>;
    const artists = Array.isArray(data["artists"]) ? (data["artists"] as unknown[]) : [];
    for (const raw of artists) {
      if (!raw || typeof raw !== "object") continue;
      const a = raw as Record<string, unknown>;
      const id = typeof a["id"] === "string" ? (a["id"] as string) : "";
      const genres = Array.isArray(a["genres"])
        ? (a["genres"] as unknown[]).filter((g): g is string => typeof g === "string")
        : [];
      if (id) map.set(id, genres);
    }
  }

  return map;
}

export async function fetchArtistTopTracks(token: string, artistId: string): Promise<Track[]> {
  const url = `${SPOTIFY_API}/artists/${artistId}/top-tracks?market=FR`;
  const res = await fetchWithSpotifyToken(url, token);
  if (!res.ok) return [];

  const data = (await res.json()) as Record<string, unknown>;
  const items = Array.isArray(data["tracks"]) ? (data["tracks"] as unknown[]) : [];
  const tracks: Track[] = [];
  for (const raw of items) {
    const mapped = mapSpotifyTrackWithMeta(raw);
    if (mapped) tracks.push(mapped.track);
  }
  return tracks;
}

export async function searchArtistTracks(
  token: string,
  artistName: string,
  artistId?: string,
  limit = 50,
): Promise<Track[]> {
  const q = encodeURIComponent(`artist:"${artistName.replace(/"/g, "")}"`);
  const url = `${SPOTIFY_API}/search?q=${q}&type=track&market=FR&limit=${limit}`;
  const res = await fetchWithSpotifyToken(url, token);
  if (!res.ok) return [];

  const data = (await res.json()) as Record<string, unknown>;
  const tracksObj = data["tracks"] as Record<string, unknown> | undefined;
  const items = Array.isArray(tracksObj?.["items"]) ? (tracksObj["items"] as unknown[]) : [];
  const tracks: Track[] = [];
  for (const raw of items) {
    const mapped = mapSpotifyTrackWithMeta(raw);
    if (!mapped) continue;
    if (artistId && mapped.meta.primaryArtistId !== artistId) continue;
    tracks.push(mapped.track);
  }
  return tracks;
}

export async function fetchGenreRecommendations(
  token: string,
  genre: string,
  seedTrackIds: string[],
  limit = 50,
): Promise<Track[]> {
  const params = buildRecommendationsParams(genre, seedTrackIds, limit);
  const url = `${SPOTIFY_API}/recommendations?${params.toString()}`;
  const res = await fetchWithSpotifyToken(url, token);
  if (!res.ok) return [];

  const data = (await res.json()) as Record<string, unknown>;
  const items = Array.isArray(data["tracks"]) ? (data["tracks"] as unknown[]) : [];
  const tracks: Track[] = [];
  for (const raw of items) {
    const mapped = mapSpotifyTrackWithMeta(raw);
    if (mapped) tracks.push(mapped.track);
  }
  return tracks;
}

/** Spotify expects comma-separated seed_tracks; max 5 seeds total (genre counts as 1). */
export function buildRecommendationsParams(
  genre: string,
  seedTrackIds: string[],
  limit = 50,
): URLSearchParams {
  const params = new URLSearchParams({
    limit: String(limit),
    market: "FR",
    seed_genres: genre,
  });
  const seeds = seedTrackIds.slice(0, 4);
  if (seeds.length > 0) {
    params.set("seed_tracks", seeds.join(","));
  }
  return params;
}
