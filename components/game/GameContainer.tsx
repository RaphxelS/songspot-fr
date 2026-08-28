"use client";

import * as React from "react";
import { useGameState } from "@/hooks/useGameState";
import { useAudioClip } from "@/hooks/useAudioClip";
import GuessInput from "./GuessInput";
import GuessHistory from "./GuessHistory";
import AudioPlayer from "./AudioPlayer";
import RevealCard from "./RevealCard";
import EmptyPoolCard from "./EmptyPoolCard";
import type { Track } from "@/lib/catalog";

export type GameContainerProps = {
  catalog: Track[];
};

export default function GameContainer({ catalog }: GameContainerProps) {
  const game = useGameState(catalog);
  const audio = useAudioClip(game.track?.preview_url ?? null);

  // Pause audio when won/lost revealed
  React.useEffect(() => {
    if (game.revealed) {
      audio.pause();
    }
  }, [game.revealed, audio]);

  const handleGuess = React.useCallback(
    (guess: string) => {
      const won = game.submitGuess(guess);
      // if lost or won, audio will be paused via effect
      void won;
    },
    [game],
  );

  const handleToggleStage = React.useCallback(
    (sparseIndex: number) => {
      const next = [...game.enabledStages];
      next[sparseIndex] = !next[sparseIndex];
      game.setEnabledStages(next);
    },
    [game],
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
      </div>
    );
  }

  if (!game.track) {
    return (
      <div className="w-full max-w-2xl">
        <p className="text-sm text-zinc-500">Chargement du morceau…</p>
      </div>
    );
  }

  const disabled = game.status === "won" || game.status === "lost";

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
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

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => game.skip()}
              disabled={disabled}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              Passer
            </button>
            <span className="flex min-h-11 items-center text-xs text-zinc-500 dark:text-zinc-400">
              Essai {game.attemptCount + 1} • Palier {formatStage(game.currentStageSeconds)}
            </span>
          </div>
        </>
      ) : (
        <RevealCard
          track={game.track}
          status={game.status as "won" | "lost"}
          guesses={game.guesses}
          attemptCount={game.attemptCount}
          onNext={() => game.selectNewTrack()}
        />
      )}
    </div>
  );
}

function formatStage(s: number): string {
  if (s < 1) return `${s.toString().replace(".", ",")} s`;
  return `${s} s`;
}
