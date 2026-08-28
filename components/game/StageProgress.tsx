"use client";

import * as React from "react";
import { STAGES } from "@/lib/constants";

export type StageProgressProps = {
  enabledStages: boolean[];
  stageIndex: number; // dense index (0..enabledCount-1)
  currentStageSeconds: number;
  onToggle: (sparseIndex: number) => void;
  disabled?: boolean;
};

function formatStage(seconds: number): string {
  if (seconds < 1) {
    // French decimal comma: 0,1 s
    return `${seconds.toString().replace(".", ",")} s`;
  }
  return `${seconds} s`;
}

export default function StageProgress({
  enabledStages,
  stageIndex,
  currentStageSeconds,
  onToggle,
  disabled = false,
}: StageProgressProps) {
  // Map dense stageIndex to sparse active index
  const activeSparseIndex = React.useMemo(() => {
    let dense = -1;
    for (let i = 0; i < STAGES.length; i++) {
      if (enabledStages[i]) {
        dense++;
        const secs = STAGES[i];
        if (secs === currentStageSeconds && dense === stageIndex) {
          return i;
        }
        // also fallback: dense === stageIndex
        if (dense === stageIndex) {
          return i;
        }
      }
    }
    // fallback to first enabled
    for (let i = 0; i < enabledStages.length; i++) if (enabledStages[i]) return i;
    return 0;
  }, [enabledStages, stageIndex, currentStageSeconds]);

  const enabledCount = enabledStages.filter(Boolean).length;

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          Paliers
        </p>
        <p aria-live="polite" className="text-xs text-zinc-500 dark:text-zinc-400">
          {enabledCount} / {STAGES.length} actifs
        </p>
      </div>

      <div
        role="group"
        aria-label="Paliers de durée, cliquer pour activer ou désactiver"
        className="grid grid-cols-5 gap-2"
      >
        {STAGES.map((sec, sparseIdx) => {
          const isEnabled = enabledStages[sparseIdx] ?? false;
          const isActive = sparseIdx === activeSparseIndex && isEnabled;
          const isLastEnabled = isEnabled && enabledCount === 1;
          const label = formatStage(sec);

          return (
            <button
              key={sec}
              type="button"
              disabled={disabled || isLastEnabled}
              aria-pressed={isEnabled}
              aria-label={`Palier ${label} ${isEnabled ? "activé" : "désactivé"}${isActive ? " — en cours" : ""}`}
              title={
                isLastEnabled
                  ? "Au moins un palier doit rester activé"
                  : isEnabled
                    ? `Désactiver ${label}`
                    : `Activer ${label}`
              }
              onClick={() => {
                if (isLastEnabled) return;
                onToggle(sparseIdx);
              }}
              className={`inline-flex min-h-11 min-w-11 flex-col items-center justify-center rounded-md border px-2 py-2 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:focus-visible:ring-zinc-100 ${
                isEnabled
                  ? isActive
                    ? "animate-pulse border-zinc-900 bg-zinc-900 text-white shadow-md ring-2 ring-zinc-900 ring-offset-1 dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 dark:ring-zinc-50"
                    : "border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  : "border-dashed border-zinc-300 bg-zinc-50 text-zinc-400 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-500"
              } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <span className="text-sm font-bold leading-none">{label}</span>
              <span className="mt-1 text-[10px] leading-none opacity-70">
                {isEnabled ? "activé" : "désactivé"}
              </span>
            </button>
          );
        })}
      </div>

      <p className="sr-only" aria-live="polite">
        Palier actuel : {formatStage(currentStageSeconds)} — {enabledCount} paliers activés
      </p>
    </div>
  );
}

export { StageProgress };
