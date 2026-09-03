import { TrackSchema } from "@/lib/validation";
import type { Track } from "@/lib/catalog";

export type LikedTrackMeta = {
  primaryArtistId: string;
  primaryArtistName: string;
  allArtistIds: string[];
};

export type LikedTrackWithMeta = {
  track: Track;
  meta: LikedTrackMeta;
};

export function normalizeReleaseDate(raw: string | null | undefined): string {
  if (!raw) return "2020-01-01";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}$/.test(raw)) return `${raw}-01`;
  if (/^\d{4}$/.test(raw)) return `${raw}-01-01`;
  return "2020-01-01";
}

export function deriveEra(releaseDate: string): Track["era"] {
  const year = parseInt(releaseDate.slice(0, 4), 10);
  if (Number.isNaN(year)) return "2020s";
  if (year < 2000) return "classic";
  if (year < 2010) return "2000s";
  if (year < 2020) return "2010s";
  return "2020s";
}

function extractArtistInfo(
  artists: Array<Record<string, unknown>> | undefined,
): { artist: string; primaryArtistId: string; primaryArtistName: string; allArtistIds: string[] } {
  if (!Array.isArray(artists) || artists.length === 0) {
    return { artist: "Unknown", primaryArtistId: "", primaryArtistName: "Unknown", allArtistIds: [] };
  }

  const names: string[] = [];
  const ids: string[] = [];
  for (const a of artists) {
    const name = typeof a["name"] === "string" ? (a["name"] as string) : "";
    const id = typeof a["id"] === "string" ? (a["id"] as string) : "";
    if (name.length > 0) names.push(name);
    if (id.length > 0) ids.push(id);
  }

  const artist = names.length > 0 ? names.join(", ") : "Unknown";
  const primaryArtistId = ids[0] ?? "";
  const primaryArtistName = names[0] ?? "Unknown";
  return { artist, primaryArtistId, primaryArtistName, allArtistIds: ids };
}

/**
 * Maps a raw Spotify track object to our Track shape plus artist metadata.
 */
export function mapSpotifyTrackWithMeta(raw: unknown): LikedTrackWithMeta | null {
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

  const { artist, primaryArtistId, primaryArtistName, allArtistIds } = extractArtistInfo(artists);

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
  if (!cover || !cover.startsWith("https://")) {
    return null;
  }

  const rawDate = (album?.["release_date"] as string | undefined) ?? null;
  const releaseDate = normalizeReleaseDate(rawDate);
  const pop = typeof popularity === "number" ? Math.round(popularity) : 50;
  const clampedPop = Math.max(0, Math.min(100, pop));
  const era = deriveEra(releaseDate);

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

  const mapped: Record<string, unknown> = {
    ...base,
    preview_url: previewUrl ?? "",
  };

  let track: Track;
  if (!previewUrl) {
    track = mapped as unknown as Track;
  } else {
    const parsed = TrackSchema.safeParse(mapped);
    if (!parsed.success) return null;
    track = parsed.data;
  }

  return {
    track,
    meta: { primaryArtistId, primaryArtistName, allArtistIds },
  };
}

/** Returns Track only (no metadata) — for backward-compatible liked pagination. */
export function mapSpotifyTrack(raw: unknown): Track | null {
  const result = mapSpotifyTrackWithMeta(raw);
  return result?.track ?? null;
}

export function isPlayableTrack(track: Track): boolean {
  return (
    track.preview_url.length > 0 &&
    track.preview_url.startsWith("https://")
  );
}
