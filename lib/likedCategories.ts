import type { LikedTrackWithMeta } from "@/lib/likedMapper";

export type LikedArtistCategory = {
  id: string;
  name: string;
  likedCount: number;
  imageUrl?: string;
};

export type LikedGenreCategory = {
  name: string;
  likedCount: number;
};

export type ArtistProfile = {
  genres: string[];
  imageUrl?: string;
};

export type ArtistProfilesMap = Map<string, ArtistProfile>;

export type ArtistGenresMap = Map<string, string[]>;

export function profilesToGenresMap(profiles: ArtistProfilesMap): ArtistGenresMap {
  const map: ArtistGenresMap = new Map();
  for (const [id, profile] of profiles) {
    map.set(id, profile.genres);
  }
  return map;
}

/** Humanize Spotify genre slug for UI, e.g. "k-pop" → "K-Pop", "dance pop" → "Dance Pop". */
export function formatGenreLabel(genre: string): string {
  const trimmed = genre.trim();
  if (!trimmed) return trimmed;
  return trimmed
    .split(/\s+/)
    .map((word) =>
      word
        .split("-")
        .map((part) => (part.length > 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part))
        .join("-"),
    )
    .join(" ");
}

export function buildArtistCategories(
  likedTracks: LikedTrackWithMeta[],
): LikedArtistCategory[] {
  const byId = new Map<string, LikedArtistCategory>();

  for (const { track, meta } of likedTracks) {
    if (!meta.primaryArtistId) continue;
    const existing = byId.get(meta.primaryArtistId);
    if (existing) {
      existing.likedCount += 1;
      if (!existing.imageUrl && track.cover) existing.imageUrl = track.cover;
    } else {
      byId.set(meta.primaryArtistId, {
        id: meta.primaryArtistId,
        name: meta.primaryArtistName,
        likedCount: 1,
        imageUrl: track.cover || undefined,
      });
    }
  }

  return [...byId.values()].sort((a, b) => b.likedCount - a.likedCount || a.name.localeCompare(b.name));
}

/** First album cover from liked tracks for an artist (same URLs used in-game). */
export function findArtistCoverFromTracks(
  likedTracks: LikedTrackWithMeta[],
  artistId: string,
): string | undefined {
  for (const { track, meta } of likedTracks) {
    if (meta.primaryArtistId === artistId && track.cover) return track.cover;
  }
  return undefined;
}

export function resolveArtistImageUrl(
  artistId: string,
  likedTracks: LikedTrackWithMeta[],
  profileImageUrl?: string,
): string | undefined {
  return findArtistCoverFromTracks(likedTracks, artistId) ?? profileImageUrl;
}

export function buildGenreCategories(
  likedTracks: LikedTrackWithMeta[],
  artistGenresMap: ArtistGenresMap,
): LikedGenreCategory[] {
  const byGenre = new Map<string, number>();

  for (const { meta } of likedTracks) {
    const genres = artistGenresMap.get(meta.primaryArtistId) ?? [];
    for (const genre of genres) {
      byGenre.set(genre, (byGenre.get(genre) ?? 0) + 1);
    }
  }

  return [...byGenre.entries()]
    .map(([name, likedCount]) => ({ name, likedCount }))
    .sort((a, b) => b.likedCount - a.likedCount || a.name.localeCompare(b.name));
}

export function filterLikedByArtist(
  likedTracks: LikedTrackWithMeta[],
  artistId: string,
): LikedTrackWithMeta[] {
  return likedTracks.filter((t) => t.meta.primaryArtistId === artistId);
}

export function filterLikedByGenre(
  likedTracks: LikedTrackWithMeta[],
  genre: string,
  artistGenresMap: ArtistGenresMap,
): LikedTrackWithMeta[] {
  return likedTracks.filter((t) => {
    const genres = artistGenresMap.get(t.meta.primaryArtistId) ?? [];
    return genres.includes(genre);
  });
}

/** Fisher-Yates shuffle — returns a new array. */
export function shuffleTracks<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function dedupeTracksById(tracks: import("@/lib/catalog").Track[]): import("@/lib/catalog").Track[] {
  const seen = new Set<string>();
  const out: import("@/lib/catalog").Track[] = [];
  for (const t of tracks) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
  }
  return out;
}
