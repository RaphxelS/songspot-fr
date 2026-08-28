"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { normalize } from "@/lib/normalize";
import { STAGES, STORAGE_KEYS } from "@/lib/constants";
import {
  DIFFICULTY_LABELS,
  filterByDifficulty,
  filterByEra,
  getDifficultyThresholds,
  type DifficultyTier,
} from "@/lib/difficulty";
import {
  clearPlayedIds,
  filterPlayedIdsByPool,
  getPrefs,
  pushPlayedId,
  setPrefs,
  normalizeEnabledStages,
  FALLBACK_ENABLED_STAGES,
} from "@/lib/storage";
import type { Track } from "@/lib/catalog";

// Re-export STAGES strict pour tests: expect(STAGES).toEqual([0.1,0.5,2,8,15])
export { STAGES };

export type GameStatus = "playing" | "won" | "lost";

export type UseGameStateReturn = {
  track: Track | null;
  stageIndex: number;
  enabledStages: boolean[];
  guesses: string[];
  status: GameStatus;
  attemptCount: number;
  isHydrated: boolean;
  isLoading: boolean;
  currentStageSeconds: number;
  revealed: boolean;
  filteredPool: Track[];
  isEmptyPool: boolean;
  difficulty: string;
  era: string;
  toast: string | null;
  challengeBanner: string | null;
  toutesProgressIndex: number;
  progressiveTier: string | null;
  showToast: (message: string, durationMs?: number) => void;
  forceTrack: (trackId: string, difficultyParam?: string | null) => boolean;
  clearChallenge: () => void;
  submitGuess: (guess: string) => boolean;
  skip: () => void;
  selectNewTrack: () => void;
  setEnabledStages: (stages: boolean[]) => void;
  setDifficulty: (d: string) => void;
  setEra: (e: string) => void;
  resetFilters: () => void;
  resetGame: () => void;
};

// ─────────────────────────────────────────────────────────────
// Helpers — unify via lib/storage single source
// ─────────────────────────────────────────────────────────────

function isCorrectGuess(guess: string, track: Track): boolean {
  const ng = normalize(guess.trim());
  if (!ng) return false;
  const nt = normalize(track.title);
  const na = normalize(track.artist);
  if (ng === nt) return true;
  if (ng === na) return true;
  const combined1 = normalize(`${track.title} ${track.artist}`);
  const combined2 = normalize(`${track.artist} ${track.title}`);
  const combinedDash1 = normalize(`${track.title} - ${track.artist}`);
  const combinedDash2 = normalize(`${track.artist} - ${track.title}`);
  if (ng === combined1 || ng === combined2) return true;
  if (ng === combinedDash1 || ng === combinedDash2) return true;
  // Dash variants (—, –, etc.) are normalized to "-" via lib/normalize, so "title — artist" → "title - artist"
  return false;
}

function getEnabledStageSeconds(enabledStages: boolean[]): number[] {
  const filtered = STAGES.filter((_, i) => enabledStages[i]);
  return filtered.length > 0 ? [...filtered] : [STAGES[0]];
}

/** Helper for tests: prochain index activé après currentSparseIndex (-1 si aucun) */
export function getNextEnabledStageIndex(
  currentSparseIndex: number,
  enabledStages: boolean[],
): number {
  for (let i = currentSparseIndex + 1; i < enabledStages.length; i++) {
    if (enabledStages[i]) return i;
  }
  return -1;
}

export function getEnabledStageSecondsForTest(
  enabledStages: boolean[],
): number[] {
  return getEnabledStageSeconds(enabledStages);
}

export function getCurrentStageSecondsForTest(
  denseIndex: number,
  enabledStages: boolean[],
): number {
  const enabled = getEnabledStageSeconds(enabledStages);
  return enabled[denseIndex] ?? enabled[enabled.length - 1] ?? STAGES[0];
}

export function getProgressiveTierForTest(progressIndex: number): string {
  return DIFFICULTY_LABELS[progressIndex % DIFFICULTY_LABELS.length];
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────
export function useGameState(catalog: Track[]): UseGameStateReturn {
  const [track, setTrack] = useState<Track | null>(null);
  const [stageIndex, setStageIndex] = useState(0);
  const [enabledStages, setEnabledStagesState] = useState<boolean[]>([
    true,
    true,
    true,
    true,
    true,
  ]);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [status, setStatus] = useState<GameStatus>("playing");
  const [attemptCount, setAttemptCount] = useState(0);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [difficulty, setDifficultyState] = useState<string>("Facile");
  const [era, setEraState] = useState<string>("Toutes");
  const [toast, setToast] = useState<string | null>(null);
  const [isEmptyPool, setIsEmptyPool] = useState(false);
  const [challengeBanner, setChallengeBanner] = useState<string | null>(null);
  const [toutesProgressIndex, setToutesProgressIndexState] = useState(0);
  const toutesProgressRef = useRef(0);

  // Derived: enabled seconds list
  const enabledStageSeconds = useMemo(
    () => getEnabledStageSeconds(enabledStages),
    [enabledStages],
  );

  const currentStageSeconds = useMemo(() => {
    // stageIndex is index in enabledStageSeconds (dense)
    return (
      enabledStageSeconds[stageIndex] ??
      enabledStageSeconds[enabledStageSeconds.length - 1] ??
      STAGES[0]
    );
  }, [enabledStageSeconds, stageIndex]);

  // filteredPool derived (used for UI, but selectNewTrack recomputes synchronously to avoid stale closure)
  const filteredPool = useMemo(() => {
    if (!catalog || catalog.length === 0) return [];
    try {
      const thresholds = getDifficultyThresholds(catalog);
      let pool = filterByEra(catalog, era as never);
      if (
        (DIFFICULTY_LABELS as readonly string[]).includes(difficulty)
      ) {
        pool = filterByDifficulty(
          pool,
          difficulty as DifficultyTier,
          thresholds,
        );
      }
      return pool;
    } catch {
      return [];
    }
  }, [catalog, difficulty, era]);

  const progressiveTier = useMemo(() => {
    // "Toutes" supprimée — plus de mode progressif
    return null;
  }, []);

  // Hydration: lecture localStorage uniquement en useEffect (évite hydration mismatch)
  useEffect(() => {
    let shouldToastGuard = false;
    try {
      // Detect raw all-false before normalization for toast
      let rawStages: unknown = undefined;
      try {
        const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEYS.prefs) : null;
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          rawStages = parsed.enabledStages;
        }
      } catch {
        // ignore parse error, will fallback to getPrefs
      }
      const prefs = getPrefs();
      let stages = prefs.enabledStages;
      // validation + guard
      if (!Array.isArray(stages) || stages.length !== 5) {
        stages = [true, true, true, true, true];
      }
      // If raw was explicitly all false, we need toast even though getPrefs normalized
      if (Array.isArray(rawStages) && rawStages.length === 5 && !(rawStages as boolean[]).some(Boolean)) {
        shouldToastGuard = true;
        stages = [...FALLBACK_ENABLED_STAGES];
        setPrefs({ enabledStages: stages });
      } else if (!stages.some(Boolean)) {
        stages = [...FALLBACK_ENABLED_STAGES];
        setPrefs({ enabledStages: stages });
        shouldToastGuard = true;
      }
      if (shouldToastGuard) {
        setToast(
          "Au moins un palier doit rester activé — réinitialisé à 0,1 s",
        );
        const t = setTimeout(() => setToast(null), 3000);
        void t;
      }
      setEnabledStagesState(stages);
      setDifficultyState(prefs.difficulty && prefs.difficulty !== "Toutes" ? prefs.difficulty : "Facile");
      setEraState(prefs.era || "Toutes");
      const progIdx = typeof prefs.toutesProgressIndex === "number" ? prefs.toutesProgressIndex : 0;
      const progClamped = Math.max(0, Math.floor(progIdx));
      setToutesProgressIndexState(progClamped);
      toutesProgressRef.current = progClamped;
    } catch {
      // ignore, fallback mémoire
    }
    // isHydrated async -> permet test initial false avant useEffect (skeleton path)
    // setTimeout 0 ensure immediate render sees false, puis true après tick
    setTimeout(() => setIsHydrated(true), 0);
  }, []);

  // Persist enabledStages whenever it changes après hydration
  useEffect(() => {
    if (!isHydrated) return;
    try {
      setPrefs({ enabledStages });
    } catch {
      // ignore
    }
  }, [enabledStages, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      setPrefs({ difficulty });
    } catch {
      // ignore
    }
  }, [difficulty, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      setPrefs({ era });
    } catch {
      // ignore
    }
  }, [era, isHydrated]);

  // Clamp stageIndex if enabledStages shrinks (ex: all disabled fallback → 1 element)
  useEffect(() => {
    if (!isHydrated) return;
    const maxIdx = enabledStageSeconds.length - 1;
    if (stageIndex > maxIdx) {
      setStageIndex(maxIdx >= 0 ? maxIdx : 0);
    }
  }, [enabledStageSeconds, stageIndex, isHydrated]);

  // ── selectNewTrack : tire aléatoirement dans filteredPool en excluant playedIds
  // useEffect seul pour random pick — évite hydration mismatch
  const selectNewTrack = useCallback(() => {
    if (!catalog || catalog.length === 0) {
      setIsLoading(false);
      setIsEmptyPool(false);
      setTrack(null);
      return;
    }

    // Mode progressif supprimé (Toutes retirée) — tirage direct
    // Non-progressive path: difficulté spécifique => random dans le pool filtré
    // recompute pool synchronously (évite memo stale)
    let pool: Track[];
    try {
      const thresholds = getDifficultyThresholds(catalog);
      pool = filterByEra(catalog, era as never);
      if ((DIFFICULTY_LABELS as readonly string[]).includes(difficulty)) {
        pool = filterByDifficulty(pool, difficulty as DifficultyTier, thresholds);
      }
    } catch {
      pool = [];
    }

    if (pool.length === 0) {
      setIsEmptyPool(true);
      setTrack(null);
      setIsLoading(false);
      setToast("Aucun morceau disponible pour ces filtres — essayez une autre difficulté ou époque");
      return;
    }

    setIsEmptyPool(false);
    // Clear challenge banner on new random pick (reroll)
    setChallengeBanner(null);
    // Preserve guard toast ("Au moins un palier...") if present, otherwise clear
    setToast((prev) => (prev && prev.includes("Au moins un palier") ? prev : null));

    // Q-03 reuse helper filterPlayedIdsByPool (single source, per-pool filter)
    const poolIds = pool.map((t) => t.id);
    const filteredPlayed = filterPlayedIdsByPool(poolIds);

    let available = pool.filter((t) => !filteredPlayed.includes(t.id));

    // Si poolExhausted → playedIds=[] reset filtré
    if (available.length === 0) {
      try {
        clearPlayedIds();
      } catch {
        // ignore
      }
      available = pool;
    }

    // pickRandom — Math.random() uniquement ici (dans callback appelé depuis useEffect ou user action)
    const idx = Math.floor(Math.random() * available.length);
    const picked = available[idx];

    if (!picked) {
      setTrack(null);
      setIsLoading(false);
      return;
    }

    try {
      pushPlayedId(picked.id);
    } catch {
      // ignore
    }

    setTrack(picked);
    setStageIndex(0);
    setGuesses([]);
    setStatus("playing");
    setAttemptCount(0);
    setIsLoading(false);
  }, [catalog, difficulty, era]);

  // Random pick uniquement en useEffect (évite hydration mismatch)
  // isHydrated flag + skeleton, isLoading
  useEffect(() => {
    if (!isHydrated) return;
    selectNewTrack();
  }, [isHydrated, selectNewTrack]);

  // ── setEnabledStages toggle persistant avec guard
  const setEnabledStages = useCallback(
    (next: boolean[]) => {
      const normalized = normalizeEnabledStages(next);
      // normalizeEnabledStages already handles all-false → fallback, but we also need toast
      const isFallback =
        Array.isArray(next) &&
        next.length === 5 &&
        !next.some(Boolean) &&
        normalized[0] === true &&
        normalized.slice(1).every((v: boolean) => !v);
      // also handle case where next is all false but normalize returns fallback
      if (isFallback) {
        setToast(
          "Au moins un palier doit rester activé — réinitialisé à 0,1 s",
        );
        setTimeout(() => setToast(null), 3000);
      }
      // Another case: caller passed validated array but all false was already fallbacked without toast detection above
      // Detect if input all false but output fallback
      if (
        Array.isArray(next) &&
        next.length === 5 &&
        !next.some(Boolean)
      ) {
        // ensure toast if not already set
        if (!isFallback) {
          setToast(
            "Au moins un palier doit rester activé — réinitialisé à 0,1 s",
          );
          setTimeout(() => setToast(null), 3000);
        }
      }
      setEnabledStagesState(normalized);
      try {
        setPrefs({ enabledStages: normalized });
      } catch {
        // ignore
      }
    },
    [],
  );

  const setDifficulty = useCallback((d: string) => {
    setDifficultyState(d);
    // persist via effect, but also immediate for test sync
    try {
      setPrefs({ difficulty: d });
    } catch {
      // ignore
    }
  }, []);

  const setEra = useCallback((e: string) => {
    setEraState(e);
    try {
      setPrefs({ era: e });
    } catch {
      // ignore
    }
  }, []);

  const resetFilters = useCallback(() => {
    setDifficultyState("Facile");
    setEraState("Toutes");
    setToast(null);
    setChallengeBanner(null);
    toutesProgressRef.current = 0;
    setToutesProgressIndexState(0);
    try {
      setPrefs({ difficulty: "Facile", era: "Toutes", toutesProgressIndex: 0 });
    } catch {
      // ignore
    }
    // selectNewTrack will be triggered via effect watching difficulty/era
  }, []);

  const resetGame = useCallback(() => {
    selectNewTrack();
  }, [selectNewTrack]);

  // ── Helpers T10 : showToast + forceTrack + challengeBanner
  const showToast = useCallback((message: string, durationMs: number = 3000) => {
    setToast(message);
    if (durationMs > 0) {
      setTimeout(() => setToast(null), durationMs);
    }
  }, []);
  const clearChallenge = useCallback(() => {
    setChallengeBanner(null);
  }, []);
  const forceTrack = useCallback(
    (trackId: string, difficultyParam?: string | null): boolean => {
      if (!catalog || catalog.length === 0) return false;
      const found = catalog.find((t) => t.id === trackId);
      if (!found) return false;
      const allowedDiffs = [...DIFFICULTY_LABELS] as string[];
      let diffToApply: string | null = null;
      if (difficultyParam && allowedDiffs.includes(difficultyParam)) {
        diffToApply = difficultyParam;
        setDifficultyState(difficultyParam);
        try {
          setPrefs({ difficulty: difficultyParam });
        } catch {}
      }
      try {
        pushPlayedId(found.id);
      } catch {}
      setTrack(found);
      setStageIndex(0);
      setGuesses([]);
      setStatus("playing");
      setAttemptCount(0);
      setIsLoading(false);
      setIsEmptyPool(false);
      const bannerDiff = diffToApply ?? difficultyParam ?? difficulty;
      const banner = bannerDiff && allowedDiffs.includes(bannerDiff)
        ? `Défi : devine ce morceau ! (difficulté ${bannerDiff})`
        : "Défi : devine ce morceau !";
      setChallengeBanner(banner);
      return true;
    },
    [catalog, difficulty]
  );
  // ── submitGuess : normalize vs track.title+artist case+accent+ligatures
  const submitGuess = useCallback(
    (guess: string): boolean => {
      if (!track) return false;
      if (status !== "playing") return false;
      const trimmed = guess.trim();
      if (!trimmed) return false;

      const correct = isCorrectGuess(trimmed, track);
      setGuesses((prev) => [...prev, trimmed]);
      setAttemptCount((prev) => prev + 1);

      if (correct) {
        setStatus("won");
        // reveal + focus RevealCard + pause audio handled by UI (status change)
        // we could try to pause audio if needed, but hook doesn't own audio element
        return true;
      }

      // else advanceStage() next enabled or status='lost' if dernier stage
      const enabledCount = enabledStageSeconds.length;
      if (stageIndex < enabledCount - 1) {
        setStageIndex((prev) => prev + 1);
        // stay playing
      } else {
        setStatus("lost");
        // revealed=true implicit via status
      }
      return false;
    },
    [track, status, stageIndex, enabledStageSeconds],
  );

  // ── skip() idem
  const skip = useCallback(() => {
    if (status !== "playing") return;
    // skip counts as attempt but doesn't add guess? Spec says skip idem advanceStage
    // We increment attemptCount and advance stage without adding to guesses (or add empty)
    setAttemptCount((prev) => prev + 1);
    // optionally add placeholder to guesses for history? Keep empty to not pollute
    const enabledCount = enabledStageSeconds.length;
    if (stageIndex < enabledCount - 1) {
      setStageIndex((prev) => prev + 1);
    } else {
      setStatus("lost");
    }
  }, [status, stageIndex, enabledStageSeconds]);

  const revealed = status === "won" || status === "lost";

  return {
    track,
    stageIndex,
    enabledStages,
    guesses,
    status,
    attemptCount,
    isHydrated,
    isLoading,
    currentStageSeconds,
    revealed,
    filteredPool,
    isEmptyPool,
    difficulty,
    era,
    toast,
    challengeBanner,
    toutesProgressIndex,
    progressiveTier,
    showToast,
    forceTrack,
    clearChallenge,
    submitGuess,
    skip,
    selectNewTrack,
    setEnabledStages,
    setDifficulty,
    setEra,
    resetFilters,
    resetGame,
  };
}

export default useGameState;
