/**
 * Constantes globales Songspot FR
 * STAGES : paliers de jeu en secondes, ne jamais dériver
 * PLAYLIST_IDS : sources Spotify, override via SPOTIFY_PLAYLIST_IDS env
 * STORAGE_KEYS : clés localStorage unifiées
 */

export const STAGES = [0.1, 0.5, 2, 8, 15] as const;

export type Stage = (typeof STAGES)[number];

const DEFAULT_PLAYLIST_IDS = [
  "37i9dQZEVXbIP3c3fqVrJY",
  "37i9dQZEVXb5AvMoO2SKHg",
] as const;

/**
 * getPlaylistIds — lit SPOTIFY_PLAYLIST_IDS à chaque appel (per-request), évite évaluation build-time.
 * Retourne csv split si env défini, sinon DEFAULT_PLAYLIST_IDS.
 */
export function getPlaylistIds(): readonly string[] {
  const env = process.env.SPOTIFY_PLAYLIST_IDS;
  if (env && env.trim().length > 0) {
    return env
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return [...DEFAULT_PLAYLIST_IDS];
}

/**
 * PLAYLIST_IDS : alias statique pour compat (évalué à l'import, déprécié).
 * Préférer getPlaylistIds() pour lecture dynamique per-request.
 * Conservé pour tests existants mais synchronisé via getPlaylistIds() fallback.
 * @deprecated use getPlaylistIds()
 */
export const PLAYLIST_IDS: readonly string[] = [...DEFAULT_PLAYLIST_IDS];

export const STORAGE_KEYS = {
  prefs: "songspot-fr:prefs",
  playedIds: "songspot-fr:playedIds",
} as const;

export type StorageKeys = typeof STORAGE_KEYS;
