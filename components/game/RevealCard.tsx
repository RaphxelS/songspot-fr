"use client";

import * as React from "react";
import type { Track } from "@/lib/catalog";

export type RevealCardProps = {
  track: Track;
  status: "won" | "lost";
  guesses?: string[];
  attemptCount?: number;
  onNext?: () => void;
};

export default function RevealCard({ track, status, guesses, attemptCount, onNext }: RevealCardProps) {
  const cardRef = React.useRef<HTMLDivElement>(null);
  const isWon = status === "won";

  // Focus after reveal
  React.useEffect(() => {
    const el = cardRef.current;
    if (el) {
      // delay to ensure DOM is ready, then focus
      const t = setTimeout(() => {
        try {
          el.focus();
        } catch {
          // ignore
        }
      }, 50);
      return () => clearTimeout(t);
    }
  }, [track.id, status]);

  return (
    <div
      ref={cardRef}
      tabIndex={-1}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="reveal-card"
      data-status={status}
      className={`rounded-lg border p-6 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:focus-visible:ring-zinc-100 ${
        isWon
          ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30"
          : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
      }`}
    >
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={track.cover}
          alt={`Pochette de ${track.album} par ${track.artist}`}
          width={112}
          height={112}
          className="h-28 w-28 flex-shrink-0 rounded-md object-cover shadow-md"
        />
        <div className="flex-1 text-center sm:text-left">
          <p
            className={`text-sm font-semibold uppercase tracking-widest ${isWon ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}
          >
            {isWon ? "Bravo !" : "Perdu !"}
          </p>
          <h2 className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-50">
            {track.title}
          </h2>
          <p className="text-base font-medium text-zinc-700 dark:text-zinc-300">
            {track.artist}
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Album : {track.album}
          </p>

          <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
            <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700">
              {track.era}
            </span>
            <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700">
              Popularité {track.popularity}
            </span>
          </div>

          {!isWon && (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              La réponse était <span className="font-semibold">{track.title}</span> — {track.artist}.
            </p>
          )}

          {isWon && attemptCount !== undefined && (
            <p className="mt-3 text-sm text-green-700 dark:text-green-300">
              Trouvé en {attemptCount} essai{attemptCount > 1 ? "s" : ""} !
            </p>
          )}

          {guesses && guesses.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                Tes essais
              </p>
              <div className="mt-1 flex flex-wrap justify-center gap-1.5 sm:justify-start">
                {guesses.map((g, i) => (
                  <span
                    key={`${g}-${i}`}
                    className="inline-flex items-center rounded-full bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
                  >
                    {g}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {onNext && (
        <div className="mt-6 flex justify-center sm:justify-end">
          <button
            type="button"
            onClick={onNext}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Nouveau morceau
          </button>
        </div>
      )}
    </div>
  );
}

export { RevealCard };
