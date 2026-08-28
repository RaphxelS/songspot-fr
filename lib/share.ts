/**
 * lib/share.ts — Partage Défi ami (URL sans stage MVP C11)
 * buildShareUrl(trackId, difficulty) → ?track=<id>&difficulty=<tier> (stage omis)
 * parseShareUrl(searchParams) inverse avec allowlist id∈catalog + Zod
 * + navigator.clipboard.writeText + toast "Défi introuvable"
 */
import { z } from "zod";
import { DIFFICULTY_LABELS } from "./difficulty";
import type { Track } from "./catalog";

// ─────────────────────────────────────────────────────────────
// Schémas Zod
// ─────────────────────────────────────────────────────────────

export const ShareDifficultySchema = z.enum(DIFFICULTY_LABELS as unknown as [string, ...string[]]);

export const ShareParamsSchema = z.object({
  track: z.string().min(1),
  difficulty: ShareDifficultySchema,
});

// Types
export type ShareParams = {
  trackId: string;
  difficulty: string;
};

export type ParseResult = {
  trackId: string | null;
  difficulty: string | null;
  track: Track | null;
  isValid: boolean;
  toast: string | null;
  error?: string;
};

// Constantes toast FR
export const TOAST_SHARE_COPIED = "Lien copié !";
export const TOAST_CHALLENGE_NOT_FOUND = "Défi introuvable, morceau aléatoire";
export const TOAST_CHALLENGE_NOT_FOUND_SHORT = "Défi introuvable";
export const CHALLENGE_BANNER_PREFIX = "Défi : devine ce morceau !";

// ─────────────────────────────────────────────────────────────
// Helpers validation allowlist
// ─────────────────────────────────────────────────────────────

/**
 * Vérifie que l'id appartient au catalogue (allowlist)
 */
export function isValidTrackId(trackId: string, catalog: Track[]): boolean {
  if (!trackId || typeof trackId !== "string") return false;
  return catalog.some((t) => t.id === trackId);
}

/**
 * Valide difficulty via allowlist DIFFICULTY_LABELS + Toutes
 */
export function isValidDifficulty(difficulty: string): boolean {
  if (!difficulty) return false;
  const allowed = [...DIFFICULTY_LABELS] as string[];
  return allowed.includes(difficulty);
}

// ─────────────────────────────────────────────────────────────
// buildShareUrl
// ─────────────────────────────────────────────────────────────

/**
 * Construit l'URL de partage sans stage (MVP C11).
 * Retourne "?track=<id>&difficulty=<tier>" (query seule)
 * ou URL complète si baseUrl / window disponible.
 * Stage est toujours omis.
 */
export function buildShareUrl(trackId: string, difficulty: string): string {
  const params = new URLSearchParams();
  params.set("track", trackId);
  params.set("difficulty", difficulty);
  return `?${params.toString()}`;
}

/**
 * Construit l'URL complète pour le presse-papier.
 * Ex: https://example.com/?track=abc&difficulty=Expert
 * Sans stage.
 */
export function buildShareUrlFull(
  trackId: string,
  difficulty: string,
  baseUrl?: string
): string {
  const query = buildShareUrl(trackId, difficulty);
  if (baseUrl) {
    // baseUrl may include origin+pathname
    const base = baseUrl.replace(/\?.*$/, "").replace(/\/$/, "");
    return `${base}${query}`;
  }
  if (typeof window !== "undefined" && window.location) {
    const origin = window.location.origin || "";
    const pathname = window.location.pathname || "/";
    return `${origin}${pathname}${query}`;
  }
  return query;
}

/**
 * Copie l'URL de partage dans le presse-papier.
 * Retourne true si succès, false sinon.
 */
export async function copyShareUrl(
  trackId: string,
  difficulty: string,
  baseUrl?: string
): Promise<boolean> {
  const url = buildShareUrlFull(trackId, difficulty, baseUrl);
  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      await navigator.clipboard.writeText(url);
      return true;
    }
    // Fallback: try to use legacy execCommand if available (jsdom tests)
    if (typeof document !== "undefined") {
      // Create temporary textarea fallback (for tests that mock clipboard only)
      return false;
    }
    return false;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// parseShareUrl
// ─────────────────────────────────────────────────────────────

/**
 * Inverse de buildShareUrl avec allowlist id∈catalog + Zod.
 * @param searchParams - URLSearchParams (ex: new URLSearchParams(window.location.search))
 * @param catalog - catalogue complet pour allowlist
 * @returns ParseResult avec isValid, track, difficulty, toast
 */
export function parseShareUrl(
  searchParams: URLSearchParams,
  catalog: Track[]
): ParseResult {
  const rawTrack = searchParams.get("track");
  const rawDifficulty = searchParams.get("difficulty");

  // Si pas de param track, ce n'est pas un défi — pas d'erreur
  if (!rawTrack) {
    return {
      trackId: null,
      difficulty: null,
      track: null,
      isValid: false,
      toast: null,
    };
  }

  // Validation Zod pour track (min 1)
  const trackValidation = z.string().min(1).safeParse(rawTrack);
  if (!trackValidation.success) {
    return {
      trackId: rawTrack,
      difficulty: rawDifficulty,
      track: null,
      isValid: false,
      toast: TOAST_CHALLENGE_NOT_FOUND,
      error: "track_invalid_format",
    };
  }

  // Allowlist id∈catalog
  const found = catalog.find((t) => t.id === rawTrack);
  if (!found) {
    return {
      trackId: rawTrack,
      difficulty: rawDifficulty,
      track: null,
      isValid: false,
      toast: TOAST_CHALLENGE_NOT_FOUND,
      error: "track_not_in_allowlist",
    };
  }

  // Difficulty : valider allowlist DIFFICULTY_LABELS, fallback Facile si Toutes ancien
  let validatedDifficulty: string | null = null;
  if (rawDifficulty) {
    if (rawDifficulty === "Toutes") {
      // legacy migration: Toutes removed → Facile
      validatedDifficulty = "Facile";
    } else if (isValidDifficulty(rawDifficulty)) {
      validatedDifficulty = rawDifficulty;
    } else {
      // Zod check for invalid difficulty — on garde track valide mais difficulty ignorée
      // On ne considère pas ça comme erreur bloquante, on fallback
      validatedDifficulty = null;
    }
  }

  return {
    trackId: rawTrack,
    difficulty: validatedDifficulty,
    track: found,
    isValid: true,
    toast: null,
  };
}

/**
 * Variante qui prend une chaîne query "?track=...&difficulty=..." ou URLSearchParams
 */
export function parseShareUrlFromString(
  queryString: string,
  catalog: Track[]
): ParseResult {
  const params = new URLSearchParams(queryString);
  return parseShareUrl(params, catalog);
}

/**
 * Génère le texte de bannière pour un défi valide
 */
export function buildChallengeBanner(difficulty: string | null): string {
  if (difficulty && isValidDifficulty(difficulty)) {
    return `${CHALLENGE_BANNER_PREFIX} (difficulté ${difficulty})`;
  }
  return CHALLENGE_BANNER_PREFIX;
}

// Re-export pour tests
export const share = {
  buildShareUrl,
  buildShareUrlFull,
  copyShareUrl,
  parseShareUrl,
  parseShareUrlFromString,
  isValidTrackId,
  isValidDifficulty,
  buildChallengeBanner,
  TOAST_SHARE_COPIED,
  TOAST_CHALLENGE_NOT_FOUND,
};

export default share;
