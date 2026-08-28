"use client";

import * as React from "react";

export type GuessHistoryProps = {
  guesses: string[];
};

export default function GuessHistory({ guesses }: GuessHistoryProps) {
  const lastGuess = guesses.length > 0 ? guesses[guesses.length - 1] : null;

  if (guesses.length === 0) {
    return (
      <div className="min-h-6">
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          Aucun essai pour l’instant
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Aucun essai — à toi de jouer !</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* aria-live annonce du dernier essai */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {lastGuess ? `Essai ${guesses.length} : ${lastGuess}` : ""}
      </div>
      <p className="text-xs font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
        Historique — {guesses.length} essai{guesses.length > 1 ? "s" : ""}
      </p>
      <div
        role="list"
        aria-label="Historique des essais"
        className="flex flex-wrap gap-2"
      >
        {guesses.map((g, i) => (
          <span
            key={`${g}-${i}`}
            role="listitem"
            className="inline-flex min-h-6 items-center rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-700 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700"
          >
            <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-white dark:bg-zinc-50 dark:text-zinc-900">
              {i + 1}
            </span>
            {g}
          </span>
        ))}
      </div>
    </div>
  );
}

export { GuessHistory };
