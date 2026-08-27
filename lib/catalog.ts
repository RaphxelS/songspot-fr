import { TrackSchema } from "./validation";
import { STAGES } from "./constants";
import { z } from "zod";

/**
 * Modèle Track + helpers catalogue
 */

export type Track = z.infer<typeof TrackSchema>;

export type Era = Track["era"];

/**
 * Merge plusieurs catalogues + dedup par id
 * Garde la première occurrence en cas de doublon.
 */
export function mergeCatalogs(...catalogs: Track[][]): Track[] {
  const seen = new Set<string>();
  const merged: Track[] = [];
  for (const cat of catalogs) {
    for (const track of cat) {
      if (!seen.has(track.id)) {
        seen.add(track.id);
        merged.push(track);
      }
    }
  }
  return merged;
}

/**
 * Dédup un catalogue (alias pour mergeCatalogs sur un seul tableau)
 */
export function dedupCatalog(catalog: Track[]): Track[] {
  return mergeCatalogs(catalog);
}

/**
 * Filtre par ère
 */
export function filterByEra(catalog: Track[], era: Era | "Toutes"): Track[] {
  if (era === "Toutes") return catalog;
  return catalog.filter((t) => t.era === era);
}

/**
 * Filtre par texte (titre + artiste) — accent-insensitive via normalize importé dynamiquement
 * Utilitaire pur pour tests; la version UI utilise lib/normalize directement.
 */
export function filterByQuery(catalog: Track[], query: string, normalizeFn: (s: string) => string): Track[] {
  if (!query || query.trim().length < 2) return [];
  const q = normalizeFn(query);
  return catalog.filter((t) => {
    const hay = normalizeFn(`${t.title} ${t.artist}`);
    return hay.includes(q);
  });
}

/**
 * Valide un catalogue via Zod — retourne { success, errors }
 */
export function validateCatalog(catalog: unknown) {
  const result = z.array(TrackSchema).safeParse(catalog);
  return result;
}

/**
 * Helpers re-exportés pour commodité
 */
export { STAGES };
export { TrackSchema } from "./validation";
