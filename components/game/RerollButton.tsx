"use client";

import * as React from "react";

export type RerollButtonProps = {
  onReroll: () => void;
  disabled?: boolean;
  className?: string;
};

/**
 * RerollButton — "Nouveau morceau"
 * tire pickRandom(filteredPool.filter(id∉playedIds)), push id, reset si pool épuisé
 * Logique déléguée à useGameState.selectNewTrack via onReroll prop.
 */
export default function RerollButton({
  onReroll,
  disabled = false,
  className,
}: RerollButtonProps) {
  return (
    <button
      type="button"
      onClick={onReroll}
      disabled={disabled}
      aria-label="Nouveau morceau"
      className={
        className ??
        "inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
      }
    >
      Nouveau morceau
    </button>
  );
}

export { RerollButton };
