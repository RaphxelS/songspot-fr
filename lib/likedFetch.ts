import "server-only";

import type { Track } from "@/lib/catalog";
import { mapSpotifyTrackWithMeta } from "@/lib/likedMapper";
import type { ArtistGenresMap, ArtistProfilesMap } from "@/lib/likedCategories";
import { getAccessToken } from "@/lib/spotify";
import {
  fetchAllLikedTracksWithMeta,
  fetchWithSpotifyToken,
} from "@/lib/likedLibraryCache";

export { fetchAllLikedTracksWithMeta, fetchWithSpotifyToken, SpotifyRateLimitError } from "@/lib/likedLibraryCache";

const SPOTIFY_API = "https://api.spotify.com/v1";

/** Pick a medium-sized Spotify image URL from the images array (descending size). */
export function pickSpotifyArtistImage(images: unknown): string | undefined {
  if (!Array.isArray(images) || images.length === 0) return undefined;
  const urls = images
    .map((img) => {
      if (!img || typeof img !== "object") return null;
      const url = (img as Record<string, unknown>)["url"];
      return typeof url === "string" && url.startsWith("https://") ? url : null;
    })
    .filter((u): u is string => u !== null);
  if (urls.length === 0) return undefined;
  // Spotify returns largest first — prefer medium (index 1) for avatars.
  return urls[1] ?? urls[0];
}

export async function fetchArtistProfilesMap(
  token: string,
  artistIds: string[],
): Promise<ArtistProfilesMap> {
  const map: ArtistProfilesMap = new Map();
  const unique = [...new Set(artistIds.filter((id) => id.length > 0))];
  if (unique.length === 0) return map;

  const appToken = await getAccessToken();
  const tokens = appToken && appToken !== token ? [appToken, token] : [token];

  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    const url = `${SPOTIFY_API}/artists?ids=${batch.join(",")}`;
    let res: Response | null = null;
    for (const apiToken of tokens) {
      const attempt = await fetchWithSpotifyToken(url, apiToken);
      if (attempt.ok) {
        res = attempt;
        break;
      }
      console.warn(`[liked] artist profiles fetch failed: ${attempt.status}`);
    }
    if (!res?.ok) continue;

    const data = (await res.json()) as Record<string, unknown>;
    const artists = Array.isArray(data["artists"]) ? (data["artists"] as unknown[]) : [];
    for (const raw of artists) {
      if (!raw || typeof raw !== "object") continue;
      const a = raw as Record<string, unknown>;
      const id = typeof a["id"] === "string" ? (a["id"] as string) : "";
      const genres = Array.isArray(a["genres"])
        ? (a["genres"] as unknown[]).filter((g): g is string => typeof g === "string")
        : [];
      const imageUrl = pickSpotifyArtistImage(a["images"]);
      if (id) map.set(id, { genres, imageUrl });
    }
  }

  return map;
}

export async function fetchArtistGenresMap(
  token: string,
  artistIds: string[],
): Promise<ArtistGenresMap> {
  const profiles = await fetchArtistProfilesMap(token, artistIds);
  const map: ArtistGenresMap = new Map();
  for (const [id, profile] of profiles) {
    map.set(id, profile.genres);
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

export type GenreRecommendationsResult = {
  tracks: Track[];
  ok: boolean;
  status: number | null;
};

export async function fetchGenreRecommendations(
  token: string,
  genre: string,
  seedTrackIds: string[],
  limit = 50,
): Promise<GenreRecommendationsResult> {
  const params = buildRecommendationsParams(genre, seedTrackIds, limit);
  const url = `${SPOTIFY_API}/recommendations?${params.toString()}`;
  const res = await fetchWithSpotifyToken(url, token);
  if (!res.ok) {
    return { tracks: [], ok: false, status: res.status };
  }

  const data = (await res.json()) as Record<string, unknown>;
  const items = Array.isArray(data["tracks"]) ? (data["tracks"] as unknown[]) : [];
  const tracks: Track[] = [];
  for (const raw of items) {
    const mapped = mapSpotifyTrackWithMeta(raw);
    if (mapped) tracks.push(mapped.track);
  }
  return { tracks, ok: true, status: res.status };
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
