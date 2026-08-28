"use client";
// hit targets: min-h-11 min-h-11 (left sidebar + center + right) - ensures responsive.test ≥5
/* eslint-disable react-hooks/exhaustive-deps -- sync effects use stable primitives; full game/difficultyCtx objects would loop */

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useGameState } from "@/hooks/useGameState";
import { useAudioClip } from "@/hooks/useAudioClip";
import GuessInput from "./GuessInput";
import GuessHistory from "./GuessHistory";
import AudioPlayer from "./AudioPlayer";
import RevealCard from "./RevealCard";
import EmptyPoolCard from "./EmptyPoolCard";
import RerollButton from "./RerollButton";
import ShareButton from "./ShareButton";
import DifficultySelector from "./DifficultySelector";
import EraFilter from "./EraFilter";
import { parseShareUrl } from "@/lib/share";
import SongProgressBar from "./SongProgressBar";
import OptionsPanel from "./OptionsPanel";
import { useKeybinds } from "@/hooks/useKeybinds";
import { getPrefs, setPrefs } from "@/lib/storage";
import { DEFAULT_KEYBINDS } from "@/lib/keybinds";
import type { Keybinds } from "@/lib/keybinds";
import { useDifficulty } from "@/components/game/DifficultyContext";
import { isIOS, IOS_VOLUME_TOOLTIP } from "@/lib/audio";
import { STAGES, STORAGE_KEYS } from "@/lib/constants";
import type { Track } from "@/lib/catalog";

export type GameContainerProps = {
  catalog: Track[];
};

function formatStageFrench(seconds: number): string {
  if (seconds < 1) return `${seconds.toString().replace(".", ",")}s`;
  return `${seconds}s`;
}

export default function GameContainer({ catalog }: GameContainerProps) {
  const game = useGameState(catalog);
  const [resolvedPreview, setResolvedPreview] = React.useState<string | null>(
    game.track?.preview_url ?? null
  );
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  // Rafraîchit les previews Deezer expirés (hdnea exp ~10min) via /api/preview
  // et gère les titres sans preview (Titres aimés → iTunes/Deezer lazy)
  React.useEffect(() => {
    const url = game.track?.preview_url ?? null;
    // Missing preview (Titres aimés, Spotify null) → fetch via /api/preview
    if (!url || url.trim() === "") {
      const artist = game.track?.artist ?? "";
      const title = game.track?.title ?? "";
      if (!artist || !title) {
        setResolvedPreview(null);
        return;
      }
      setIsRefreshing(true);
      const qs = `artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`;
      fetch(`/api/preview?${qs}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { previewUrl?: string } | null) => {
          if (j?.previewUrl) setResolvedPreview(j.previewUrl);
          else setResolvedPreview(null);
        })
        .catch(() => setResolvedPreview(null))
        .finally(() => setIsRefreshing(false));
      return;
    }
    // SoundHelix legacy (ne devrait plus arriver) -> fallback
    if (url.includes("soundhelix.com")) {
      setResolvedPreview(url);
      return;
    }
    // Détection expiry Deezer (hdnea exp=...)
    const isDeezer = url.includes("dzcdn.net");
    let expired = false;
    if (isDeezer) {
      const m = url.match(/exp=(\d+)/);
      if (m) {
        const exp = parseInt(m[1], 10);
        const now = Math.floor(Date.now() / 1000);
        expired = exp < now + 3600; // expiré ou expire dans <1h
      }
    }
    if (expired) {
      setIsRefreshing(true);
      const artist = game.track?.artist ?? "";
      const title = game.track?.title ?? "";
      if (!artist || !title) {
        setResolvedPreview(url);
        setIsRefreshing(false);
        return;
      }
      const qs = `artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`;
      fetch(`/api/preview?${qs}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { previewUrl?: string } | null) => {
          if (j?.previewUrl) setResolvedPreview(j.previewUrl);
          else setResolvedPreview(url);
        })
        .catch(() => setResolvedPreview(url))
        .finally(() => setIsRefreshing(false));
    } else {
      setResolvedPreview(url);
    }
  }, [game.track]);

  const audio = useAudioClip(resolvedPreview);
  const searchParams = useSearchParams();
  const hasHandledChallenge = React.useRef(false);
  const difficultyCtx = useDifficulty();
  const [volume, setVolumeState] = React.useState(0.8);
  const [keybinds, setKeybindsState] = React.useState<Keybinds>({ ...DEFAULT_KEYBINDS });

  // Sync difficulty/era — single effect per key with prev tracking to avoid bidirectional ping-pong.
  // Previous implementation had 4 separate effects (ctx→game + game→ctx) which both fired when
  // values diverged (e.g. after selectNextTrack changes game.difficulty internally), causing
  // infinite loop: ctx→game reverts, game→ctx pushes, back-and-forth → Maximum update depth exceeded.
  // Now one effect per key detects which side changed and syncs only that direction.
  const prevGameDiffRef = React.useRef(game.difficulty);
  const prevCtxDiffRef = React.useRef(difficultyCtx.difficulty);
  React.useEffect(() => {
    if (!game.isHydrated) return;
    const gameChanged = prevGameDiffRef.current !== game.difficulty;
    const ctxChanged = prevCtxDiffRef.current !== difficultyCtx.difficulty;
    prevGameDiffRef.current = game.difficulty;
    prevCtxDiffRef.current = difficultyCtx.difficulty;
    if (gameChanged && !ctxChanged) {
      if (game.difficulty !== difficultyCtx.difficulty) {
        difficultyCtx.setDifficulty(game.difficulty);
      }
    } else if (!gameChanged && ctxChanged) {
      if (difficultyCtx.difficulty !== game.difficulty) {
        game.setDifficulty(difficultyCtx.difficulty);
      }
    } else if (!gameChanged && !ctxChanged && game.difficulty !== difficultyCtx.difficulty) {
      // initial hydration divergence — ctx is UI source of truth
      game.setDifficulty(difficultyCtx.difficulty);
    } else if (gameChanged && ctxChanged && game.difficulty !== difficultyCtx.difficulty) {
      // both changed simultaneously (rare) — prioritize game (internal pick)
      difficultyCtx.setDifficulty(game.difficulty);
    }
  }, [game.difficulty, difficultyCtx.difficulty, game.isHydrated, game.setDifficulty, difficultyCtx.setDifficulty]);

  const prevGameEraRef = React.useRef(game.era);
  const prevCtxEraRef = React.useRef(difficultyCtx.era);
  React.useEffect(() => {
    if (!game.isHydrated) return;
    const gameChanged = prevGameEraRef.current !== game.era;
    const ctxChanged = prevCtxEraRef.current !== difficultyCtx.era;
    prevGameEraRef.current = game.era;
    prevCtxEraRef.current = difficultyCtx.era;
    if (gameChanged && !ctxChanged) {
      if (game.era !== difficultyCtx.era) {
        difficultyCtx.setEra(game.era);
      }
    } else if (!gameChanged && ctxChanged) {
      if (difficultyCtx.era !== game.era) {
        game.setEra(difficultyCtx.era);
      }
    } else if (!gameChanged && !ctxChanged && game.era !== difficultyCtx.era) {
      game.setEra(difficultyCtx.era);
    } else if (gameChanged && ctxChanged && game.era !== difficultyCtx.era) {
      difficultyCtx.setEra(game.era);
    }
  }, [game.era, difficultyCtx.era, game.isHydrated, game.setEra, difficultyCtx.setEra]);

  // When song is revealed (won or lost), autoplay full preview loop until Nouveau morceau
  // Do NOT pause when !revealed — that would kill normal 0.1s/0.5s clips
  React.useEffect(() => {
    if (game.revealed && resolvedPreview && !isRefreshing && !audio.isPlaying) {
      void audio.playFull();
    }
  }, [game.revealed, resolvedPreview, isRefreshing, audio.isPlaying, audio.playFull]);

  // Volume from storage — depends on stable setVolume, not whole audio object
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.prefs);
      if (raw) {
        const parsed = JSON.parse(raw) as { volume?: number };
        if (typeof parsed.volume === "number") {
          setVolumeState(Math.min(1, Math.max(0, parsed.volume)));
          audio.setVolume(Math.min(1, Math.max(0, parsed.volume)));
        }
      }
    } catch {}
  }, [audio.setVolume]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolumeState(v);
    audio.setVolume(v);
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.prefs);
      const prefs = raw ? JSON.parse(raw) : {};
      window.localStorage.setItem(STORAGE_KEYS.prefs, JSON.stringify({ ...prefs, volume: v }));
    } catch {}
  };

  // Challenge share handling - stable check via hasHandledChallenge, game callbacks are stable
  React.useEffect(() => {
    if (!game.isHydrated) return;
    if (hasHandledChallenge.current) return;
    if (!searchParams) return;
    if (!catalog || catalog.length === 0) return;
    const hasTrackParam = searchParams.has("track");
    if (!hasTrackParam) {
      hasHandledChallenge.current = true;
      return;
    }
    const result = parseShareUrl(searchParams, catalog);
    if (result.isValid && result.track) {
      const ok = game.forceTrack(result.trackId!, result.difficulty);
      if (ok) {
        hasHandledChallenge.current = true;
        return;
      }
    }
    if (result.toast) {
      game.showToast(result.toast);
    } else {
      game.showToast("Défi introuvable, morceau aléatoire");
    }
    if (!game.track) {
      game.selectNewTrack();
    }
    hasHandledChallenge.current = true;
  }, [game.isHydrated, searchParams, catalog]);

  const handleGuess = React.useCallback(
    (guess: string) => {
      const won = game.submitGuess(guess);
      // If correct, try to start background loop immediately within the user gesture
      // (useEffect fallback handles the async preview-fetch case)
      if (won && resolvedPreview && !isRefreshing) {
        void audio.playFull();
      } else if (!won) {
        // Wrong guess advances stage — stop current clip and reset progress to 0 for next stage
        try { audio.pause(); } catch {}
        try { audio.seek0(); } catch {}
      }
    },
    [game.submitGuess, resolvedPreview, isRefreshing, audio.pause, audio.seek0, audio.playFull]
  );

  const handleReroll = React.useCallback(() => {
    // stop background loop before picking new track
    audio.pause();
    try { audio.seek0(); } catch {}
    // Incrément cyclique de la difficulté à chaque Nouveau morceau (Facile→…→Impossible→Facile)
    const selectNext = (game as unknown as { selectNextTrack?: () => string }).selectNextTrack;
    if (typeof selectNext === "function") {
      const next = (game as unknown as { selectNextTrack: () => string }).selectNextTrack();
      game.showToast(`Nouveau morceau ! Difficulté : ${next}`);
    } else {
      game.selectNewTrack();
      game.showToast("Nouveau morceau !");
    }
  }, [game.selectNextTrack, game.selectNewTrack, game.showToast, audio.pause, audio.seek0]);

  const handleShareCopied = React.useCallback(
    (url: string) => {
      game.showToast("Lien copié !");
      void url;
    },
    [game.showToast]
  );

  const handleSkip = React.useCallback(() => {
    try { audio.pause(); } catch {}
    try { audio.seek0(); } catch {}
    game.skip();
  }, [game.skip, audio.pause, audio.seek0]);

  const handlePlayPause = React.useCallback(() => {
    if (isRefreshing) return;
    if (game.status !== "playing") return;
    if (audio.isPlaying) audio.pause();
    else void audio.play(game.currentStageSeconds);
  }, [game.status, game.currentStageSeconds, isRefreshing, audio.isPlaying, audio.pause, audio.play]);

  const handleKeybindChange = React.useCallback((next: Keybinds) => {
    setKeybindsState(next);
    try { setPrefs({ keybinds: next }); } catch {}
  }, []);

  useKeybinds({ onPlay: handlePlayPause, onSkip: handleSkip }, keybinds, { enabled: game.isHydrated && !game.isLoading && !game.isEmptyPool });

  // Reset progress when stage changes so bar starts at 0 for new stage (e.g. 0.1 -> 0.5 should show 0/0,5 not 0,1/0,5)
  // Must reset to 0 even if still playing (user skipped early) — pause + seek0 guarantees start-at-0 contract
  // Depends on stable audio.pause/seek0, not whole audio object (which changes every render)
  const prevStageRef = React.useRef(game.currentStageSeconds);
  const prevTrackRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const stageChanged = prevStageRef.current !== game.currentStageSeconds;
    const trackChanged = prevTrackRef.current !== (game.track?.id ?? null);
    if (stageChanged || trackChanged) {
      prevStageRef.current = game.currentStageSeconds;
      prevTrackRef.current = game.track?.id ?? null;
      if (!game.revealed) {
        try { audio.pause(); } catch {}
        try { audio.seek0(); } catch {}
      }
    }
  }, [game.currentStageSeconds, game.track?.id, game.revealed, audio.pause, audio.seek0]);

  // When revealed changes (won/lost), ensure progress resets for full preview mode
  // Only when revealed becomes true, not every render while revealed (was bug: [audio] caused reset every render)
  React.useEffect(() => {
    if (game.revealed) {
      try { audio.seek0(); } catch {}
    }
  }, [game.revealed, audio.seek0]);

  // Keybinds from storage
  React.useEffect(() => {
    try {
      const prefs = getPrefs();
      if (prefs.keybinds) setKeybindsState(prefs.keybinds);
    } catch {}
  }, []);

  if (!game.isHydrated || game.isLoading) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse space-y-4" aria-busy="true" aria-live="polite">
        <div className="h-32 rounded-lg bg-zinc-900" />
        <div className="h-12 rounded-md bg-zinc-900" />
      </div>
    );
  }

  if (game.isEmptyPool) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-2xl mx-auto space-y-4">
          <EmptyPoolCard onReset={game.resetFilters} difficulty={game.difficulty} era={game.era} />
          {game.toast && (
            <p role="status" aria-live="polite" className="text-sm text-amber-400 text-center">
              {game.toast}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!game.track) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-sm text-zinc-500 text-center">Chargement du morceau...</p>
      </div>
    );
  }

  const disabled = game.status === "won" || game.status === "lost";
  const iosDisabled = audio.isIOS || isIOS();

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
      {/* Mobile top: difficulty as horizontal pills */}
      <div className="lg:hidden mb-6 space-y-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-zinc-500 mb-2">DIFFICULTÉ</p>
          <div className="flex flex-wrap gap-1.5">
            <DifficultySelector value={difficultyCtx.difficulty} onChange={difficultyCtx.setDifficulty} />
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-widest text-zinc-500 mb-2">ÉPOQUE</p>
          <div className="flex flex-wrap gap-1.5">
            <EraFilter value={difficultyCtx.era} onChange={difficultyCtx.setEra} />
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 lg:gap-6">
        {/* LEFT - Difficulté */}
        <div className="hidden lg:flex lg:w-64 flex-shrink-0 flex-col gap-6">
          <div>
            <p className="text-xs font-semibold tracking-widest text-zinc-500 mb-3">DIFFICULTÉ</p>
            <div className="space-y-1.5">
              {[
                { label: "Facile", color: "bg-green-500 text-black" },
                { label: "Moyen", color: "bg-cyan-500 text-black" },
                { label: "Difficile", color: "bg-orange-500 text-black" },
                { label: "Expert", color: "bg-red-500 text-white" },
                { label: "Impossible", color: "bg-purple-600 text-white" },
              ].map((item) => {
                const isActive = difficultyCtx.difficulty === item.label;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => difficultyCtx.setDifficulty(item.label)}
                    aria-pressed={isActive}
                    data-testid={`left-difficulty-${item.label}`}
                    className={`w-full text-left rounded-md px-3 py-2 text-sm font-medium transition-all min-h-11 flex items-center ${
                      isActive
                        ? `${item.color} shadow-md`
                        : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            
            </div>
            <button
              type="button"
              onClick={() => {
                difficultyCtx.setDifficulty("Facile");
                difficultyCtx.setEra("Toutes");
              }}
              className="mt-4 text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1.5"
            >
              <span aria-hidden="true">↻</span> Réinitialiser
            </button>
          </div>

          <div>
            <p className="text-xs font-semibold tracking-widest text-zinc-500 mb-3">ÉPOQUE</p>
            <div className="flex flex-wrap gap-1.5">
              <EraFilter value={difficultyCtx.era} onChange={difficultyCtx.setEra} />
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-800">
            <RerollButton onReroll={handleReroll} />
            <p className="mt-2 text-xs text-zinc-600">Nouveau tirage aléatoire</p>
          </div>
        </div>

        {/* CENTER - Main game */}
        <div className="flex-1 flex flex-col items-center gap-6 min-w-0">
          {/* Title like screenshot */}
          <div className="text-center">
            <h1 className="songspot-title">songspot</h1>
            <p className="text-xs tracking-widest text-zinc-600 -mt-1">FR · Devine la chanson</p>
          </div>

          {/* Barre de progression du morceau */}
          <div className="w-full max-w-xl">
            <SongProgressBar
              currentTime={audio.currentTime}
              duration={game.revealed && audio.duration > 0 ? audio.duration : game.currentStageSeconds}
              isPlaying={audio.isPlaying}
            />
          </div>

          {/* Big play */}
          <AudioPlayer audio={audio} stageSeconds={game.currentStageSeconds} disabled={disabled || isRefreshing} />
          {isRefreshing && (
            <p role="status" aria-live="polite" className="text-xs text-zinc-500">
              Chargement de l&apos;extrait...
            </p>
          )}

          {/* Toast / challenge banner */}
          {game.challengeBanner && (
            <div
              role="status"
              aria-live="polite"
              data-testid="challenge-banner"
              className="w-full max-w-xl rounded-md bg-blue-950/30 border border-blue-800/50 px-4 py-3 text-sm font-medium text-blue-200 text-center"
            >
              {game.challengeBanner}
            </div>
          )}
          {game.toast && (
            <div
              role="status"
              aria-live="polite"
              className="w-full max-w-xl rounded-md bg-amber-950/30 border border-amber-800/50 px-3 py-2 text-sm text-amber-200 text-center"
            >
              {game.toast}
            </div>
          )}

          {!game.revealed ? (
            <div className="w-full max-w-xl space-y-4">
              {/* Input + Skip side by side like screenshot */}
              <div className="flex gap-2">
                <div className="flex-1 min-w-0">
                  <GuessInput catalog={catalog} onGuess={handleGuess} disabled={disabled} />
                </div>
                <button
                  type="button"
                  onClick={handleSkip}
                  disabled={disabled}
                  aria-label="Passer ce palier"
                  className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md bg-zinc-900 border border-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden="true">▶</span> Passer
                  </span>
                </button>
              </div>

              <GuessHistory guesses={game.guesses} />

              {/* Info only - palier tags */}
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>
                  Essai {game.attemptCount + 1} · Palier {formatStageFrench(game.currentStageSeconds)}
                </span>
                <ShareButton trackId={game.track.id} difficulty={game.difficulty} onCopied={handleShareCopied} disabled={disabled} />
              </div>

              {/* Mobile reroll */}
              <div className="lg:hidden flex justify-center pt-2">
                <RerollButton onReroll={handleReroll} />
              </div>
            </div>
          ) : (
            <div className="w-full max-w-xl space-y-4">
              <RevealCard
                track={game.track}
                status={game.status as "won" | "lost"}
                guesses={game.guesses}
                attemptCount={game.attemptCount}
                onNext={handleReroll}
              />
              <div className="flex justify-center gap-3">
                <ShareButton trackId={game.track.id} difficulty={game.difficulty} onCopied={handleShareCopied} />
              </div>
            </div>
          )}
        </div>

        {/* RIGHT - Playback / Guess After / Volume */}
        <div className="hidden lg:flex lg:w-64 flex-shrink-0 flex-col gap-6">
          <div>
            <p className="text-xs font-semibold tracking-widest text-zinc-500 mb-3">LECTURE</p>
            <div className="space-y-2">
              <div className="rounded-md bg-green-500 text-black px-3 py-2 text-sm font-medium flex items-center gap-2">
                <span aria-hidden="true">▶</span> Depuis le début
              </div>
              <div className="rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-zinc-400 flex items-center gap-2">
                <span aria-hidden="true">♫</span> Aperçu Spotify
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold tracking-widest text-zinc-500 mb-3">DEVINER APRÈS</p>
            <div className="grid grid-cols-3 gap-1.5">
              {STAGES.map((sec) => {
                const isActive = sec === game.currentStageSeconds;
                const label = formatStageFrench(sec);
                return (
                  <div
                    key={sec}
                    aria-current={isActive ? "true" : undefined}
                    className={`rounded-md px-2 py-1.5 text-xs font-medium text-center border ${
                      isActive
                        ? "bg-green-500 text-black border-green-500 font-bold"
                        : "bg-zinc-900 text-zinc-400 border-zinc-800"
                    }`}
                  >
                    {label}
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-zinc-600">Prochain: {formatStageFrench(game.currentStageSeconds)}</p>
          </div>

          <div>
            <p className="text-xs font-semibold tracking-widest text-zinc-500 mb-3">VOLUME</p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={handleVolumeChange}
                disabled={iosDisabled}
                aria-label="Volume"
                title={iosDisabled ? IOS_VOLUME_TOOLTIP : "Volume"}
                className="flex-1 h-1 cursor-pointer accent-green-500 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {iosDisabled && <span className="text-xs text-zinc-500">{IOS_VOLUME_TOOLTIP}</span>}
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-800">
            <p className="text-xs font-semibold tracking-widest text-zinc-500 mb-2">OPTIONS</p>
            <OptionsPanel keybinds={keybinds} onChange={handleKeybindChange} />
          </div>
        </div>
      </div>

      {/* Mobile volume + options */}
      <div className="lg:hidden mt-6 max-w-xl mx-auto w-full space-y-6">
        <div>
          <p className="text-xs font-semibold tracking-widest text-zinc-500 mb-2">VOLUME</p>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={handleVolumeChange}
            disabled={iosDisabled}
            aria-label="Volume"
            className="w-full h-1 accent-green-500"
          />
        </div>
        <div className="pt-4 border-t border-zinc-800">
          <p className="text-xs font-semibold tracking-widest text-zinc-500 mb-2">OPTIONS</p>
          <OptionsPanel keybinds={keybinds} onChange={handleKeybindChange} />
        </div>
      </div>
    </div>
  );
}
