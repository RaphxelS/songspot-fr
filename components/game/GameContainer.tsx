"use client";

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
import { parseShareUrl } from "@/lib/share";
import type { Track } from "@/lib/catalog";

export type GameContainerProps = {
  catalog: Track[];
};

export default function GameContainer({ catalog }: GameContainerProps) {
  const game = useGameState(catalog);
  const audio = useAudioClip(game.track?.preview_url ?? null);
  const searchParams = useSearchParams();
  const hasHandledChallenge = React.useRef(false);

  // Pause audio when won/lost revealed
  React.useEffect(() => {
    if (game.revealed) {
      audio.pause();
    }
  }, [game.revealed, audio]);

  // T10: Au mount via useSearchParams (dans Suspense) si ?track= présent et valide (allowlist) → force ce track + banniere, sinon fallback random + toast "Defi introuvable"
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

    // Invalide -> fallback random + toast "Defi introuvable"
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
      void won;
    },
    [game]
  );

  const handleToggleStage = React.useCallback(
    (sparseIndex: number) => {
      const next = [...game.enabledStages];
      next[sparseIndex] = !next[sparseIndex];
      game.setEnabledStages(next);
    },
    [game]
  );

  const handleReroll = React.useCallback(() => {
    game.selectNewTrack();
    game.showToast("Nouveau morceau !");
  }, [game]);

  const handleShareCopied = React.useCallback(
    (url: string) => {
      game.showToast("Lien copié !");
      void url;
    },
    [game]
  );

  if (!game.isHydrated || game.isLoading) {
    return (
      <div className="w-full max-w-2xl animate-pulse space-y-4" aria-busy="true" aria-live="polite">
        <div className="h-32 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-12 rounded-md bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-12 rounded-md bg-zinc-100 dark:bg-zinc-800" />
      </div>
    );
  }

  if (game.isEmptyPool) {
    return (
      <div className="w-full max-w-2xl space-y-4">
        <EmptyPoolCard onReset={game.resetFilters} difficulty={game.difficulty} era={game.era} />
        {game.toast && (
          <p role="status" aria-live="polite" className="text-sm text-amber-700 dark:text-amber-300">
            {game.toast}
          </p>
        )}
        {game.challengeBanner && (
          <p role="status" aria-live="polite" className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
            {game.challengeBanner}
          </p>
        )}
      </div>
    );
  }

  if (!game.track) {
    return (
      <div className="w-full max-w-2xl">
        <p className="text-sm text-zinc-500">Chargement du morceau...</p>
      </div>
    );
  }

  const disabled = game.status === "won" || game.status === "lost";

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      {game.challengeBanner && (
        <div
          role="status"
          aria-live="polite"
          data-testid="challenge-banner"
          className="rounded-md bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800 dark:bg-blue-950/30 dark:text-blue-200"
        >
          {game.challengeBanner}
        </div>
      )}

      {game.toast && (
        <div role="status" aria-live="polite" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          {game.toast}
        </div>
      )}

      <AudioPlayer
        audio={audio}
        stageSeconds={game.currentStageSeconds}
        stageIndex={game.stageIndex}
        enabledStages={game.enabledStages}
        onToggleStage={handleToggleStage}
        disabled={disabled}
      />

      {!game.revealed ? (
        <>
          <GuessInput catalog={catalog} onGuess={handleGuess} disabled={disabled} />
          <GuessHistory guesses={game.guesses} />

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => game.skip()}
              disabled={disabled}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              Passer
            </button>
            <RerollButton onReroll={handleReroll} disabled={false} />
            <ShareButton trackId={game.track.id} difficulty={game.difficulty} onCopied={handleShareCopied} disabled={disabled} />
            <span className="flex min-h-11 items-center text-xs text-zinc-500 dark:text-zinc-400">
              Essai {game.attemptCount + 1} \u00b7 Palier {formatStage(game.currentStageSeconds)}
            </span>
          </div>
        </>
      ) : (
        <>
          <RevealCard
            track={game.track}
            status={game.status as "won" | "lost"}
            guesses={game.guesses}
            attemptCount={game.attemptCount}
            onNext={handleReroll}
          />
          <div className="flex flex-wrap gap-3">
            <RerollButton onReroll={handleReroll} />
            <ShareButton trackId={game.track.id} difficulty={game.difficulty} onCopied={handleShareCopied} />
          </div>
        </>
      )}
    </div>
  );
}

function formatStage(s: number): string {
  if (s < 1) return `${s.toString().replace(".", ",")} s`;
  return `${s} s`;
}
