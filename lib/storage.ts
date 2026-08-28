/**
 * lib/storage.ts — typed localStorage UNIFIÉ (songspot-fr:prefs + songspot-fr:playedIds)
 * + try/catch + memory fallback si setItem throw (Safari privé)
 * + validation enabledStages.some(Boolean) guard
 * + filter playedIds on filter change per-pool key
 * + JSON.parse try/catch
 */

import { STORAGE_KEYS } from "./constants";
import { clampVolume } from "./audio";
import { DEFAULT_KEYBINDS, normalizeKeybinds } from "./keybinds";
import type { Keybinds } from "./keybinds";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
export type Prefs = {
  difficulty: string;
  era: string;
  volume: number;
  enabledStages: boolean[];
  toutesProgressIndex: number;
  keybinds: Keybinds;
};

export const DEFAULT_PREFS: Prefs = {
  difficulty: "Facile",
  era: "Toutes",
  volume: 0.8,
  enabledStages: [true, true, true, true, true],
  toutesProgressIndex: 0,
  keybinds: { ...DEFAULT_KEYBINDS },
};

export const FALLBACK_ENABLED_STAGES: boolean[] = [
  true,
  false,
  false,
  false,
  false,
];

// ─────────────────────────────────────────────────────────────
// Memory fallback (Safari privé / quota exceeded)
// ─────────────────────────────────────────────────────────────
const memoryStore = new Map<string, string>();

function safeGetItem(key: string): string | null {
  try {
    if (
      typeof window === "undefined" ||
      typeof window.localStorage === "undefined"
    ) {
      return memoryStore.get(key) ?? null;
    }
    const val = window.localStorage.getItem(key);
    if (val !== null) {
      memoryStore.set(key, val);
      return val;
    }
    // localStorage has no value but memory has (fallback after throw scenario)
    return memoryStore.get(key) ?? null;
  } catch {
    return memoryStore.get(key) ?? null;
  }
}

function safeSetItem(key: string, value: string): void {
  memoryStore.set(key, value);
  try {
    if (
      typeof window !== "undefined" &&
      typeof window.localStorage !== "undefined"
    ) {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // Safari privé QuotaExceededError — keep memory fallback
  }
}

function safeRemoveItem(key: string): void {
  memoryStore.delete(key);
  try {
    if (
      typeof window !== "undefined" &&
      typeof window.localStorage !== "undefined"
    ) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

// ─────────────────────────────────────────────────────────────
// Helpers validation
// ─────────────────────────────────────────────────────────────
export function normalizeEnabledStages(raw: unknown): boolean[] {
  if (!Array.isArray(raw) || raw.length !== 5) {
    return [...DEFAULT_PREFS.enabledStages];
  }
  const normalized = raw.map((v) => Boolean(v));
  if (!normalized.some(Boolean)) {
    return [...FALLBACK_ENABLED_STAGES];
  }
  return normalized;
}

// ─────────────────────────────────────────────────────────────
// Prefs API — UNIFIÉ songspot-fr:prefs
// ─────────────────────────────────────────────────────────────
export function getPrefs(): Prefs {
  try {
    const raw = safeGetItem(STORAGE_KEYS.prefs);
    if (!raw) return { ...DEFAULT_PREFS, keybinds: { ...DEFAULT_KEYBINDS } };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed !== "object" || parsed === null)
      return { ...DEFAULT_PREFS, keybinds: { ...DEFAULT_KEYBINDS } };

    const result: Prefs = { ...DEFAULT_PREFS, keybinds: { ...DEFAULT_KEYBINDS } };

    if (typeof parsed.difficulty === "string") {
      // Migration: Toutes → Facile (difficulty Toutes supprimée)
      if (parsed.difficulty === "Toutes") result.difficulty = "Facile";
      else result.difficulty = parsed.difficulty;
    }
    if (typeof parsed.era === "string") {
      result.era = parsed.era;
    }
    if (typeof parsed.volume === "number") {
      result.volume = clampVolume(parsed.volume);
    } else if (typeof parsed.volume === "string") {
      const num = Number(parsed.volume);
      if (!Number.isNaN(num)) result.volume = clampVolume(num);
    }
    if (parsed.enabledStages !== undefined) {
      result.enabledStages = normalizeEnabledStages(parsed.enabledStages);
    }
    if (typeof parsed.toutesProgressIndex === "number" && Number.isFinite(parsed.toutesProgressIndex)) {
      result.toutesProgressIndex = Math.max(0, Math.floor(parsed.toutesProgressIndex));
    }
    if (parsed.keybinds !== undefined) {
      result.keybinds = normalizeKeybinds(parsed.keybinds);
    } else {
      result.keybinds = { ...DEFAULT_KEYBINDS };
    }

    // Final guard: ensure at least one enabled
    if (!result.enabledStages.some(Boolean)) {
      result.enabledStages = [...FALLBACK_ENABLED_STAGES];
    }

    return result;
  } catch {
    // JSON.parse corrupt "{broken" → fallback mémoire, pas de crash
    return { ...DEFAULT_PREFS, keybinds: { ...DEFAULT_KEYBINDS } };
  }
}

export function setPrefs(prefs: Partial<Prefs>): void {
  try {
    const current = getPrefs();
    const merged: Prefs = { ...current, ...prefs };

    if (prefs.enabledStages !== undefined) {
      merged.enabledStages = normalizeEnabledStages(prefs.enabledStages);
    }
    if (prefs.volume !== undefined) {
      merged.volume = clampVolume(prefs.volume as number);
    }
    if (prefs.difficulty !== undefined && typeof prefs.difficulty === "string") {
      // Migration guard: Toutes not allowed → Facile
      if (prefs.difficulty === "Toutes") merged.difficulty = "Facile";
      else merged.difficulty = prefs.difficulty;
    }
    if (prefs.era !== undefined && typeof prefs.era === "string") {
      merged.era = prefs.era;
    }
    if (prefs.toutesProgressIndex !== undefined && typeof prefs.toutesProgressIndex === "number") {
      merged.toutesProgressIndex = Math.max(0, Math.floor(prefs.toutesProgressIndex));
    }
    if (prefs.keybinds !== undefined) {
      merged.keybinds = normalizeKeybinds(prefs.keybinds);
    }

    // Guard final
    if (!merged.enabledStages.some(Boolean)) {
      merged.enabledStages = [...FALLBACK_ENABLED_STAGES];
    }

    safeSetItem(STORAGE_KEYS.prefs, JSON.stringify(merged));
  } catch {
    // silencieux Safari privé
  }
}

// Convenience individual accessors (persist via prefs)

export function getEnabledStages(): boolean[] {
  return getPrefs().enabledStages;
}

export function setEnabledStages(stages: boolean[]): void {
  setPrefs({ enabledStages: normalizeEnabledStages(stages) });
}

export function getDifficulty(): string {
  return getPrefs().difficulty;
}

export function setDifficulty(difficulty: string): void {
  if (difficulty === "Toutes") difficulty = "Facile";
  setPrefs({ difficulty });
}

export function getEra(): string {
  return getPrefs().era;
}

export function setEra(era: string): void {
  setPrefs({ era });
}

export function getVolume(): number {
  return getPrefs().volume;
}

export function setVolume(volume: number): void {
  setPrefs({ volume });
}

export function getToutesProgressIndex(): number {
  return getPrefs().toutesProgressIndex ?? 0;
}

export function setToutesProgressIndex(idx: number): void {
  setPrefs({ toutesProgressIndex: Math.max(0, Math.floor(idx)) });
}

export function incrementToutesProgressIndex(): number {
  const next = getToutesProgressIndex() + 1;
  setToutesProgressIndex(next);
  return next;
}

export function getKeybinds(): Keybinds {
  return getPrefs().keybinds ?? { ...DEFAULT_KEYBINDS };
}

export function setKeybinds(keybinds: Keybinds): void {
  setPrefs({ keybinds: normalizeKeybinds(keybinds) });
}

// ─────────────────────────────────────────────────────────────
// PlayedIds API — songspot-fr:playedIds
// ─────────────────────────────────────────────────────────────
export function getPlayedIds(): string[] {
  try {
    const raw = safeGetItem(STORAGE_KEYS.playedIds);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    // corrupt JSON "{broken" → fallback mémoire, pas de crash
    return [];
  }
}

export function setPlayedIds(ids: string[]): void {
  try {
    const filtered = ids.filter((x): x is string => typeof x === "string");
    safeSetItem(STORAGE_KEYS.playedIds, JSON.stringify(filtered));
  } catch {
    // ignore
  }
}

export function pushPlayedId(id: string): void {
  if (!id || typeof id !== "string") return;
  try {
    const ids = getPlayedIds();
    if (!ids.includes(id)) {
      ids.push(id);
      setPlayedIds(ids);
    }
  } catch {
    // ignore
  }
}

export function clearPlayedIds(): void {
  try {
    safeSetItem(STORAGE_KEYS.playedIds, JSON.stringify([]));
  } catch {
    // ignore, memory fallback already
  }
  // also ensure memory is cleared and try removeItem for completeness
  try {
    safeRemoveItem(STORAGE_KEYS.playedIds);
    // re-set empty to keep key consistent for fallback path
    memoryStore.set(STORAGE_KEYS.playedIds, JSON.stringify([]));
    // try to persist empty if possible (second try)
    try {
      if (
        typeof window !== "undefined" &&
        typeof window.localStorage !== "undefined"
      ) {
        window.localStorage.setItem(
          STORAGE_KEYS.playedIds,
          JSON.stringify([]),
        );
      }
    } catch {
      // keep memory
    }
  } catch {
    // ignore
  }
}

/**
 * Filtre les playedIds pour ne garder que ceux présents dans le pool actuel.
 * Persiste le résultat filtré si différent.
 * @param poolIds - ids du pool filtré (difficulty+ère)
 */
export function filterPlayedIdsByPool(poolIds: string[]): string[] {
  try {
    const ids = getPlayedIds();
    const poolSet = new Set(poolIds);
    const filtered = ids.filter((id) => poolSet.has(id));
    if (filtered.length !== ids.length) {
      setPlayedIds(filtered);
    }
    return filtered;
  } catch {
    return [];
  }
}

/**
 * @deprecated alias for filterPlayedIdsByPool
 */
export function getFilteredPlayedIds(poolIds: string[]): string[] {
  return filterPlayedIdsByPool(poolIds);
}

export function isPoolExhausted(poolIds: string[]): boolean {
  if (!poolIds || poolIds.length === 0) return false;
  const filtered = filterPlayedIdsByPool(poolIds);
  return filtered.length >= poolIds.length;
}

export function clearIfExhausted(poolIds: string[]): boolean {
  if (isPoolExhausted(poolIds)) {
    clearPlayedIds();
    return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────
// Game mode persistence
// ─────────────────────────────────────────────────────────────
export type GameMode = "top" | "liked";

export function getGameMode(): GameMode {
  try {
    const raw = safeGetItem(STORAGE_KEYS.gameMode);
    if (raw === "liked" || raw === "top") return raw as GameMode;
    // fallback: check prefs.mode legacy
    const prefs = getPrefs() as unknown as Record<string, unknown>;
    const m = (prefs as { mode?: unknown }).mode;
    if (m === "liked" || m === "top") return m as GameMode;
    return "top";
  } catch {
    return "top";
  }
}

export function setGameMode(mode: GameMode): void {
  if (mode !== "top" && mode !== "liked") return;
  try {
    safeSetItem(STORAGE_KEYS.gameMode, mode);
    // also sync to prefs.mode for cross-component access
    setPrefs({ mode } as unknown as Partial<Prefs>);
  } catch {
    // ignore
  }
}

export function getLikedPlayedIds(): string[] {
  try {
    const raw = safeGetItem(STORAGE_KEYS.likedPlayedIds);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

export function setLikedPlayedIds(ids: string[]): void {
  try {
    const filtered = ids.filter((x): x is string => typeof x === "string");
    safeSetItem(STORAGE_KEYS.likedPlayedIds, JSON.stringify(filtered));
  } catch {
    // ignore
  }
}

// ─────────────────────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────────────────────
/**
 * Reset memory store — used only in tests to simulate fresh state
 * or to clear fallback between tests.
 */
export function __resetMemoryStoreForTests(): void {
  memoryStore.clear();
}

/**
 * Clear all storage keys (prefs + playedIds) — test helper
 */
export function __clearAllStorageForTests(): void {
  memoryStore.clear();
  try {
    if (
      typeof window !== "undefined" &&
      typeof window.localStorage !== "undefined"
    ) {
      window.localStorage.removeItem(STORAGE_KEYS.prefs);
      window.localStorage.removeItem(STORAGE_KEYS.playedIds);
      window.localStorage.removeItem(STORAGE_KEYS.likedPlayedIds);
      window.localStorage.removeItem(STORAGE_KEYS.gameMode);
    }
  } catch {
    // ignore
  }
}

export const storage = {
  getPrefs,
  setPrefs,
  getPlayedIds,
  setPlayedIds,
  pushPlayedId,
  clearPlayedIds,
  filterPlayedIdsByPool,
  getFilteredPlayedIds,
  isPoolExhausted,
  clearIfExhausted,
  getEnabledStages,
  setEnabledStages,
  getToutesProgressIndex,
  setToutesProgressIndex,
  incrementToutesProgressIndex,
  getKeybinds,
  setKeybinds,
  // Game mode helpers
  getGameMode,
  setGameMode,
  getLikedPlayedIds,
  setLikedPlayedIds,
};

export default storage;
