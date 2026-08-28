"use client";

import * as React from "react";
import { STAGES } from "@/lib/constants";

export type SongProgressBarProps = {
  currentTime: number;
  duration: number;
  isPlaying?: boolean;
  className?: string;
};

const MAX_STAGE = STAGES[STAGES.length - 1] as number; // 15

// Visual positions for stage ticks/labels so early stages are readable
// (not used for fill — fill is linear per-stage 0->100%)
const VISUAL_POS: Record<number, number> = {
  0.1: 8,
  0.5: 18,
  2: 32,
  8: 62,
  15: 100,
};

function formatSec(sec: number): string {
  const fixed = Number.isFinite(sec) ? sec.toFixed(1) : "0,0";
  return `${fixed.replace(".", ",")}s`;
}

export default function SongProgressBar({
  currentTime,
  duration,
  isPlaying = false,
  className = "",
}: SongProgressBarProps) {
  const safeDuration = duration > 0 ? duration : 0;
  const clampedCurrent = Math.min(Math.max(0, currentTime), safeDuration);
  // Stage-capped: fill animates 0 -> visualMax for that stage (e.g. 2s -> 0..32%, 8s -> 0..62%)
  // so short clips visibly sweep but STOP at their stage tick instead of racing to 100%.
  // Keeps rAF-driven smoothness (no CSS transition) so even 0.1s (0..8%) moves frame-by-frame.
  const visualMaxForDuration =
    safeDuration > 0 ? (VISUAL_POS[safeDuration as number] ?? null) : null;
  const pct =
    safeDuration > 0
      ? visualMaxForDuration !== null
        ? Math.min(
            visualMaxForDuration,
            Math.max(0, (clampedCurrent / safeDuration) * visualMaxForDuration),
          )
        : Math.min(100, Math.max(0, (clampedCurrent / safeDuration) * 100))
      : 0;
  const ariaNow = Math.round(clampedCurrent * 100) / 100;

  // For stage ticks/labels: keep global timeline view (15s) with readable spacing
  const effectiveMax = safeDuration > MAX_STAGE ? safeDuration : MAX_STAGE;

  return (
    <div
      data-testid="song-progress-bar"
      role="group"
      aria-label="Progression de l'extrait"
      className={`w-full space-y-2 ${className}`}
    >
      <div className="relative h-2.5 w-full overflow-visible rounded-full bg-zinc-800">
        {/* Ticks at visual positions — faint stage markers (skip 15s: it's the track end) */}
        {STAGES.map((sec) => {
          if (sec === MAX_STAGE) return null;
          const left = VISUAL_POS[sec as number] ?? (sec / MAX_STAGE) * 100;
          if (sec > effectiveMax && sec !== safeDuration) return null;
          const isActive = sec === safeDuration;
          return (
            <div
              key={sec}
              aria-hidden="true"
              className={`pointer-events-none absolute top-0 h-full w-px ${isActive ? "bg-green-400" : "bg-zinc-600/50"}`}
              style={{ left: `${left}%` }}
            />
          );
        })}
        {/* Fill — LINEAR per-stage, no CSS transition so rAF-driven 16ms updates are visible instantly even for 0.1s */}
        <div
          role="progressbar"
          aria-label="Progression de l'extrait"
          aria-valuenow={ariaNow}
          aria-valuemin={0}
          aria-valuemax={safeDuration}
          className="absolute left-0 top-0 h-full bg-green-500 rounded-full"
          style={{ width: `${pct}%` }}
        />
        {clampedCurrent > 0 && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 -translate-x-1/2 rounded-full bg-white shadow-md border-2 border-green-500"
            style={{ left: `${pct}%` }}
          />
        )}
      </div>
      {/* Stage marks — restored at bottom, positioned at readable visual spots */}
      <div className="relative h-4 w-full text-[10px] tabular-nums" aria-hidden="true">
        {STAGES.map((sec) => {
          const isActive = sec === safeDuration;
          const left = VISUAL_POS[sec as number] ?? (sec / MAX_STAGE) * 100;
          if (sec > effectiveMax && sec !== safeDuration) return null;
          let alignClass = "-translate-x-1/2";
          let style: React.CSSProperties = { left: `${left}%` };
          if (left < 8) {
            alignClass = "translate-x-0";
            style = { left: "0%" };
          } else if (left > 92) {
            alignClass = "-translate-x-full";
            style = { left: "100%" };
          }
          return (
            <span
              key={sec}
              className={`absolute top-0 ${alignClass} whitespace-nowrap ${isActive ? "font-bold text-green-500" : "text-zinc-500"}`}
              style={style}
            >
              {formatSec(sec)}
            </span>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-xs tabular-nums">
        <span className="font-medium text-zinc-300" aria-live="polite">
          {formatSec(clampedCurrent)} / {formatSec(safeDuration)}
        </span>
        <span className="text-zinc-500" aria-live="polite">
          {isPlaying ? "Lecture" : "En pause"}
        </span>
      </div>
      <span className="sr-only" aria-live="polite">
        {isPlaying
          ? `Lecture en cours ${clampedCurrent.toFixed(1)}s sur ${safeDuration.toFixed(1)}s`
          : "En pause"}
      </span>
    </div>
  );
}

export { SongProgressBar };
