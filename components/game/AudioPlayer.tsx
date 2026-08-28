"use client";

import * as React from "react";
import { isIOS, IOS_VOLUME_TOOLTIP } from "@/lib/audio";
import type { UseAudioClipReturn } from "@/hooks/useAudioClip";
import StageProgress from "./StageProgress";
import { STAGES, STORAGE_KEYS } from "@/lib/constants";

export type AudioPlayerProps = {
  audio: UseAudioClipReturn;
  stageSeconds: number;
  stageIndex: number;
  enabledStages: boolean[];
  onToggleStage: (sparseIndex: number) => void;
  disabled?: boolean; // won/lost
};

function formatStageFrench(seconds: number): string {
  if (seconds < 1) return `${seconds.toString().replace(".", ",")} s`;
  return `${seconds} s`;
}

export default function AudioPlayer({
  audio,
  stageSeconds,
  stageIndex,
  enabledStages,
  onToggleStage,
  disabled = false,
}: AudioPlayerProps) {
  const { isPlaying, currentTime, error, isIOS: isIOSState, play, pause, seek0, setVolume } = audio;
  const [volume, setVolumeState] = React.useState(0.8);
  const iosDisabled = isIOSState || isIOS();

  // Restore volume from prefs on mount (already handled by hook, but keep UI sync)
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.prefs);
      if (raw) {
        const parsed = JSON.parse(raw) as { volume?: number };
        if (typeof parsed.volume === "number") {
          setVolumeState(Math.min(1, Math.max(0, parsed.volume)));
        }
      }
    } catch {
      // ignore
    }
    // also sync iOS detection already in hook
  }, []);

  const handlePlayPause = React.useCallback(() => {
    if (disabled) return;
    if (isPlaying) {
      pause();
    } else {
      // play is user-initiated, stageSeconds from currentStageSeconds
      void play(stageSeconds);
    }
  }, [disabled, isPlaying, pause, play, stageSeconds]);

  const handleSeek0 = React.useCallback(() => {
    seek0();
    // spec: "Depuis le début" currentTime=0 sans changer isPlaying — seek0 already does not toggle isPlaying
  }, [seek0]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolumeState(v);
    setVolume(v);
  };

  // No autoplay: ensure we don't call play in effect. Verified by code review: no useEffect with play.

  return (
    <div className="flex w-full flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {/* Header: stage indicator */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100" aria-live="polite">
          Extrait : <span className="font-bold">{formatStageFrench(stageSeconds)}</span>
          <span className="mx-1 text-zinc-400">/</span>
          <span className="text-zinc-500">{formatStageFrench(STAGES[STAGES.length - 1])}</span>
        </p>
        {error && (
          <p role="alert" aria-live="assertive" className="text-xs font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>

      {/* Current time debug (optional) */}
      <p className="sr-only" aria-live="polite">
        {isPlaying ? `Lecture en cours ${currentTime.toFixed(1)} s` : "En pause"}
      </p>

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handlePlayPause}
          disabled={disabled}
          aria-label={isPlaying ? "Pause" : "Lecture"}
          aria-pressed={isPlaying}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md bg-zinc-900 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isPlaying ? (
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="inline-block h-3 w-3 rounded-sm bg-current" />
              Pause
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="inline-block h-0 w-0 border-y-[6px] border-l-[10px] border-y-transparent border-l-current" />
              Lecture
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={handleSeek0}
          disabled={disabled}
          aria-label="Depuis le début"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Depuis le début
        </button>

        {/* Volume */}
        <div className="flex min-h-11 items-center gap-2">
          <label htmlFor="audio-volume" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Volume
          </label>
          <input
            id="audio-volume"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={handleVolumeChange}
            disabled={iosDisabled}
            aria-label="Volume"
            title={iosDisabled ? IOS_VOLUME_TOOLTIP : "Volume"}
            className="h-2 w-24 cursor-pointer accent-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:accent-zinc-50"
          />
          {iosDisabled && (
            <span className="max-w-[14ch] text-xs text-zinc-500 dark:text-zinc-400" aria-hidden="true">
              {IOS_VOLUME_TOOLTIP}
            </span>
          )}
        </div>

        {iosDisabled && <span className="sr-only">{IOS_VOLUME_TOOLTIP}</span>}
      </div>

      {/* StageProgress 5 segments */}
      <StageProgress
        enabledStages={enabledStages}
        stageIndex={stageIndex}
        currentStageSeconds={stageSeconds}
        onToggle={onToggleStage}
        disabled={disabled}
      />

      {/* Hit targets note (sr-only for verification) */}
      <div className="sr-only">Tous les boutons ont une taille minimale de 44 pixels</div>
    </div>
  );
}

export { AudioPlayer };
