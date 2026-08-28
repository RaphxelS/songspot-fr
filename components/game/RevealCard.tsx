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
  const [imgError, setImgError] = React.useState(false);

  React.useEffect(() => {
    const el = cardRef.current;
    if (el) {
      const t = setTimeout(() => {
        try {
          el.focus();
        } catch {}
      }, 50);
      return () => clearTimeout(t);
    }
  }, [track.id, status]);

  const coverSrc = imgError
    ? `https://placehold.co/300x300/27272a/ffffff?text=${encodeURIComponent(track.title.slice(0, 12))}`
    : track.cover;

  return (
    <div
      ref={cardRef}
      tabIndex={-1}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="reveal-card"
      data-status={status}
      className={`rounded-lg border p-6 shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] ${
        isWon
          ? "border-green-800 bg-zinc-900"
          : "border-red-900 bg-zinc-900"
      }`}
    >
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={coverSrc}
          alt={`Pochette de ${track.album} par ${track.artist}`}
          width={112}
          height={112}
          onError={() => setImgError(true)}
          className="h-28 w-28 flex-shrink-0 rounded-md object-cover shadow-md bg-zinc-800"
          loading="eager"
        />
        <div className="flex-1 text-center sm:text-left">
          <p
            className={`text-sm font-semibold uppercase tracking-widest ${isWon ? "text-green-400" : "text-red-400"}`}
          >
            {isWon ? "Bravo !" : "Perdu !"}
          </p>
          <h2 className="mt-1 text-xl font-bold text-zinc-50">{track.title}</h2>
          <p className="text-base font-medium text-zinc-300">{track.artist}</p>
          <p className="text-sm text-zinc-500">Album : {track.album}</p>

          <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
            <span className="inline-flex items-center rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-300 ring-1 ring-zinc-700">
              {track.era}
            </span>
            <span className="inline-flex items-center rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-300 ring-1 ring-zinc-700">
              Popularité {track.popularity}
            </span>
          </div>

          {!isWon && (
            <p className="mt-3 text-sm text-zinc-400">
              La réponse était <span className="font-semibold text-zinc-200">{track.title}</span> — {track.artist}.
            </p>
          )}

          {isWon && attemptCount !== undefined && (
            <p className="mt-3 text-sm text-green-400">
              Trouvé en {attemptCount} essai{attemptCount > 1 ? "s" : ""} !
            </p>
          )}

          {guesses && guesses.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">Tes essais</p>
              <div className="mt-1 flex flex-wrap justify-center gap-1.5 sm:justify-start">
                {guesses.map((g, i) => (
                  <span
                    key={`${g}-${i}`}
                    className="inline-flex items-center rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-300 ring-1 ring-zinc-700"
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
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md bg-green-500 px-5 py-2.5 text-sm font-bold text-black hover:bg-green-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
          >
            Nouveau morceau
          </button>
        </div>
      )}
    </div>
  );
}

export { RevealCard };
