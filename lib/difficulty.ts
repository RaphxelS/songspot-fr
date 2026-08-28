import type { Track } from "./catalog";

/**
 * Difficulté 5 paliers quintiles — labels FR exacts (ne pas traduire)
 */
export const DIFFICULTY_LABELS = [
  "Facile",
  "Moyen",
  "Difficile",
  "Expert",
  "Impossible",
] as const;

export type DifficultyTier = (typeof DIFFICULTY_LABELS)[number];

/**
 * Retourne la difficulté suivante dans le cycle Facile→Moyen→Difficile→Expert→Impossible→Facile.
 * Si current invalide ou "Toutes" (legacy), retourne "Facile".
 */
export function getNextDifficulty(current: string): DifficultyTier {
  const idx = (DIFFICULTY_LABELS as readonly string[]).indexOf(current);
  if (idx === -1) return "Facile";
  return DIFFICULTY_LABELS[(idx + 1) % DIFFICULTY_LABELS.length];
}

export type DifficultyThresholds = {
  p20: number;
  p40: number;
  p60: number;
  p80: number;
};

/**
 * Calcule les seuils quintiles du catalogue courant.
 * Tri par popularity croissant, seuils à 20/40/60/80 percentiles.
 * threshold = sorted[Math.floor(n * percentile)].popularity
 * Gère catalogue vide ou skew (quintiles effondrés) sans crash.
 */
export function getDifficultyThresholds(
  catalog: Track[]
): DifficultyThresholds {
  if (!catalog || catalog.length === 0) {
    return { p20: 0, p40: 0, p60: 0, p80: 0 };
  }
  const sorted = [...catalog].sort((a, b) => a.popularity - b.popularity);
  const n = sorted.length;
  // Clamp index to [0, n-1] pour éviter out-of-bounds si n petit
  const at = (p: number) => {
    const idx = Math.floor(n * p);
    const clamped = Math.min(Math.max(idx, 0), n - 1);
    return sorted[clamped].popularity;
  };
  return {
    p20: at(0.2),
    p40: at(0.4),
    p60: at(0.6),
    p80: at(0.8),
  };
}

/**
 * Retourne le label de difficulté pour une popularité donnée selon thresholds.
 * Map: 0-20% → Impossible (pop basse), 20-40% → Expert, 40-60% → Difficile,
 *      60-80% → Moyen, 80-100% → Facile (pop haute)
 */
export function getTier(
  popularity: number,
  thresholds: DifficultyThresholds
): DifficultyTier {
  if (!thresholds) return "Moyen";
  if (popularity >= thresholds.p80) return "Facile";
  if (popularity >= thresholds.p60) return "Moyen";
  if (popularity >= thresholds.p40) return "Difficile";
  if (popularity >= thresholds.p20) return "Expert";
  return "Impossible";
}

/**
 * Alias historique pour compatibilité plan v2 (getDifficultyTier)
 */
export function getDifficultyTier(
  popularity: number,
  catalog: Track[]
): DifficultyTier {
  const thresholds = getDifficultyThresholds(catalog);
  return getTier(popularity, thresholds);
}

/**
 * Filtre les tracks par palier de difficulté.
 * Si thresholds non fourni, calcule à partir de tracks (permet test isolé).
 * Gère empty tier → [] (caller affiche EmptyPoolCard)
 * Gère quintiles effondrés (seuils égaux) sans crash.
 */
export function filterByDifficulty(
  tracks: Track[],
  tier: DifficultyTier | string,
  thresholds?: DifficultyThresholds
): Track[] {
  if (!tracks || tracks.length === 0) return [];
  if (!tier) return [];
  if (!DIFFICULTY_LABELS.includes(tier as DifficultyTier)) return [];
  const th = thresholds ?? getDifficultyThresholds(tracks);
  return tracks.filter((t) => getTier(t.popularity, th) === tier);
}

/**
 * Filtres Ères via release_date (YYYY-MM-DD).
 * - "Toutes" → all
 * - "Classic" / "Classique" / "classic" → year < 2000
 * - "2000s" → 2000-2009
 * - "2010s" → 2010-2019
 * - "2020s" → >= 2020
 * Case-insensitive pour "Toutes"/"Classic"/"Classique".
 * Fallback: si era inconnu, filtre sur champ era exact (legacy).
 */
export type EraFilter =
  | "Toutes"
  | "Classic"
  | "Classique"
  | "classic"
  | "2000s"
  | "2010s"
  | "2020s"
  | string;

export function filterByEra(tracks: Track[], era: EraFilter): Track[] {
  if (!tracks || tracks.length === 0) return [];
  if (!era) return tracks;
  const lower = era.toLowerCase().trim();
  if (lower === "toutes") return tracks;

  if (lower === "classic" || lower === "classique") {
    return tracks.filter((t) => {
      const y = parseInt(t.release_date.slice(0, 4), 10);
      return !Number.isNaN(y) && y < 2000;
    });
  }
  if (lower === "2000s") {
    return tracks.filter((t) => {
      const y = parseInt(t.release_date.slice(0, 4), 10);
      return !Number.isNaN(y) && y >= 2000 && y <= 2009;
    });
  }
  if (lower === "2010s") {
    return tracks.filter((t) => {
      const y = parseInt(t.release_date.slice(0, 4), 10);
      return !Number.isNaN(y) && y >= 2010 && y <= 2019;
    });
  }
  if (lower === "2020s") {
    return tracks.filter((t) => {
      const y = parseInt(t.release_date.slice(0, 4), 10);
      return !Number.isNaN(y) && y >= 2020;
    });
  }
  // Fallback legacy: filtre sur champ era exact
  return tracks.filter((t) => t.era === era);
}
