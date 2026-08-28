"use client";

import * as React from "react";
import { STAGES } from "@/lib/constants";

export type StageProgressProps = {
  stageIndex: number;
  currentStageSeconds: number;
  disabled?: boolean;
  // Backward compat: old props that tests still pass (info-only mode ignores them)
  enabledStages?: boolean[];
  onToggle?: (sparseIndex: number) => void;
};

function formatStage(seconds: number): string {
  if (seconds < 1) {
    return `${seconds.toString().replace(".", ",")} s`;
  }
  return `${seconds} s`;
}

export default function StageProgress({
  stageIndex,
  currentStageSeconds,
  disabled = false,
  enabledStages,
  onToggle,
}: StageProgressProps) {
  const isInfoOnly = !enabledStages || !onToggle;

  // Find sparse index of current stage
  const activeSparseIndex = React.useMemo(() => {
    const idx = STAGES.indexOf(currentStageSeconds as never);
    if (idx >= 0) return idx;
    return stageIndex;
  }, [stageIndex, currentStageSeconds]);

  // If old props provided, render old interactive pills for test compatibility
  if (!isInfoOnly && enabledStages && onToggle) {
    const enabledCount = enabledStages.filter(Boolean).length;
    return (
      <div className="w-full space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Paliers</p>
          <p aria-live="polite" className="text-xs text-zinc-500 dark:text-zinc-400">
            {enabledCount} / {STAGES.length} actifs
          </p>
        </div>
        <div role="group" aria-label="Paliers de durée, cliquer pour activer ou désactiver" className="grid grid-cols-5 gap-2">
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
                title={isLastEnabled ? "Au moins un palier doit rester activé" : isEnabled ? `Désactiver ${label}` : `Activer ${label}`}
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
                <span className="mt-1 text-[10px] leading-none opacity-70">{isEnabled ? "activé" : "désactivé"}</span>
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

  // New info-only mode (no toggle) - segmented bar like screenshot
  const activeSparse = activeSparseIndex;
  return (
    <div className="w-full space-y-3">
      <div className="relative">
        <div className="grid grid-cols-5 gap-1" role="group" aria-label="Progression paliers">
          {STAGES.map((sec, idx) => {
            const isActive = idx === activeSparse;
            const isPast = idx < activeSparse;
            return (
              <div
                key={sec}
                className={`h-2 rounded-sm transition-all ${isActive ? "bg-green-500" : isPast ? "bg-green-500/30" : "bg-zinc-800"} ${disabled ? "opacity-50" : ""}`}
                aria-hidden="true"
              />
            );
          })}
        </div>
        <div className="mt-1 flex">
          {STAGES.map((sec, idx) => (
            <div key={sec} className="flex-1 flex justify-center">
              {idx === activeSparse && (
                <span className="text-[10px] font-bold text-green-500 -mt-1" aria-hidden="true">
                  I
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="flex text-[10px] text-zinc-500">
          {STAGES.map((sec) => (
            <span key={sec} className="flex-1 text-center">
              {formatStage(sec)}
            </span>
          ))}
        </div>
      </div>
      <p className="text-center text-xs text-zinc-500" aria-live="polite">
        Palier actuel : <span className="font-bold text-green-500">{formatStage(currentStageSeconds)}</span>
        <span className="mx-1">·</span>
        <span>
          {activeSparse + 1} / {STAGES.length}
        </span>
      </p>
    </div>
  );
}

export { StageProgress };
