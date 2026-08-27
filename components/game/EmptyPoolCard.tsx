/**
 * components/game/EmptyPoolCard.tsx — edge: empty pool fallback
 * Affiché quand filteredPool.length===0 (aucun morceau pour difficulté+ère)
 * Propose fallback vers « Toutes » + toast.
 */

"use client";

import * as React from "react";

type EmptyPoolCardProps = {
  onReset?: () => void;
  onResetFilters?: () => void;
  message?: string;
  difficulty?: string;
  era?: string;
};

export default function EmptyPoolCard({
  onReset,
  onResetFilters,
  message,
  difficulty,
  era,
}: EmptyPoolCardProps) {
  const handleReset = onReset ?? onResetFilters;

  return (
    <div
      data-testid="empty-pool-card"
      role="alert"
      aria-live="polite"
      className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-900 dark:bg-amber-950/30"
    >
      <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
        Aucun morceau disponible
      </h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        {message ??
          `Aucun morceau ne correspond à ces filtres${
            difficulty || era
              ? ` (difficulté : ${difficulty ?? "—"}, époque : ${era ?? "—"})`
              : " (difficulté et époque)"
          }. Essayez avec des filtres plus larges.`}
      </p>
      {handleReset && (
        <button
          type="button"
          onClick={handleReset}
          data-testid="empty-pool-reset"
          className="mt-4 inline-flex min-h-11 min-w-11 items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-100"
          aria-label="Réinitialiser les filtres à Toutes"
        >
          Afficher tous les morceaux
        </button>
      )}
      {!handleReset && (
        <p className="mt-4 text-xs text-zinc-500">
          Sélectionnez « Toutes » pour la difficulté et l&apos;époque.
        </p>
      )}
    </div>
  );
}

export { EmptyPoolCard };
