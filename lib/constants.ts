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
 * PLAYLIST_IDS : utilise SPOTIFY_PLAYLIST_IDS env si défini (csv), sinon défaut
 * Ex: SPOTIFY_PLAYLIST_IDS="id1,id2" -> ["id1","id2"]
 */
export const PLAYLIST_IDS: readonly string[] = (() => {
  const env = process.env.SPOTIFY_PLAYLIST_IDS;
  if (env && env.trim().length > 0) {
    return env
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return [...DEFAULT_PLAYLIST_IDS];
})();

export const STORAGE_KEYS = {
  prefs: "songspot-fr:prefs",
  playedIds: "songspot-fr:playedIds",
} as const;

export type StorageKeys = typeof STORAGE_KEYS;
