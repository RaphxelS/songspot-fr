"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { STORAGE_KEYS } from "@/lib/constants";
import {
  AUDIO_ERRORS,
  clampVolume,
  isIOS as checkIsIOS,
  mapPlayError,
} from "@/lib/audio";

export type UseAudioClipReturn = {
  play: (stageSeconds: number) => Promise<void>;
  playFull: () => Promise<void>;
  pause: () => void;
  seek0: () => void;
  setVolume: (v: number) => void;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  error: string | null;
  isIOS: boolean;
};

/**
 * Hook encapsulant HTMLAudioElement unique (preload auto)
 * API: play(stageSeconds), pause(), seek0(), setVolume(0-1), isPlaying, currentTime, error, isIOS
 *
 * Implémentation: audio.src = preview_url -> attendre canplay/loadedmetadata Promise timeout 5s
 * -> currentTime=0 -> play().catch -> setTimeout(stop, stageSeconds*1000) primary + rAF loop + setInterval(20ms) guard
 * Cleanup: pause + clearTimeout + cancelAnimationFrame + removeEventListener + src='' + load()
 * onError -> setError("Extrait indisponible, nouveau morceau")
 */
export function useAudioClip(previewUrl: string | null): UseAudioClipReturn {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const canPlayListenersRef = useRef<
    { canplay: () => void; loadedmetadata: () => void; error: () => void } | null
  >(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isIOSState, setIsIOSState] = useState(false);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (rafRef.current !== null) {
      // rAF may be missing in jsdom
      if (typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(rafRef.current);
      } else {
        window.clearTimeout(rafRef.current);
      }
      rafRef.current = null;
    }
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      try {
        audio.pause();
      } catch {
        // ignore
      }
      try {
        (audio as HTMLAudioElement & { loop?: boolean }).loop = false;
      } catch {
        // ignore
      }
    }
    clearTimers();
    setIsPlaying(false);
  }, [clearTimers]);

  const seek0 = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      try {
        audio.currentTime = 0;
      } catch {
        // ignore if not ready
      }
      setCurrentTime(0);
    }
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamped = clampVolume(v);
    const audio = audioRef.current;
    if (audio) {
      try {
        audio.volume = clamped;
      } catch {
        // iOS read-only, ignore
      }
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.prefs);
      const prefs = raw ? JSON.parse(raw) : {};
      prefs.volume = clamped;
      window.localStorage.setItem(STORAGE_KEYS.prefs, JSON.stringify(prefs));
    } catch {
      // fallback mémoire — ignore
    }
  }, []);

  // init audio element once
  useEffect(() => {
    if (typeof window === "undefined") return;
    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;

    const onError = () => {
      setError(AUDIO_ERRORS.previewUnavailable);
      setIsPlaying(false);
    };
    const onTimeUpdate = () => {
      try {
        setCurrentTime(audio.currentTime);
      } catch {
        // ignore
      }
    };
    const onDuration = () => {
      try {
        const d = audio.duration;
        if (Number.isFinite(d) && d > 0) setDuration(d);
      } catch {}
    };
    audio.addEventListener("error", onError);
    // timeupdate is too slow (250ms) for 0.1s, but keep for currentTime display fallback
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onDuration);
    audio.addEventListener("durationchange", onDuration);

    // iOS detection + restore volume from storage
    try {
      setIsIOSState(checkIsIOS());
      const raw = window.localStorage.getItem(STORAGE_KEYS.prefs);
      if (raw) {
        const prefs = JSON.parse(raw);
        if (typeof prefs.volume === "number") {
          audio.volume = clampVolume(prefs.volume);
        }
      }
    } catch {
      // ignore
    }

    return () => {
      // cleanup on unmount
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      if (rafRef.current !== null) {
        if (typeof window.cancelAnimationFrame === "function")
          window.cancelAnimationFrame(rafRef.current);
        else window.clearTimeout(rafRef.current);
      }
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
      try {
        audio.pause();
      } catch {
        // ignore
      }
      audio.removeEventListener("error", onError);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onDuration);
      audio.removeEventListener("durationchange", onDuration);
      // remove potential canplay listeners left over if play() was pending
      if (canPlayListenersRef.current) {
        audio.removeEventListener("canplay", canPlayListenersRef.current.canplay);
        audio.removeEventListener(
          "loadedmetadata",
          canPlayListenersRef.current.loadedmetadata
        );
        audio.removeEventListener("error", canPlayListenersRef.current.error);
        canPlayListenersRef.current = null;
      }
      audio.src = "";
      try {
        audio.load();
      } catch {
        // ignore
      }
      audioRef.current = null;
    };
  }, []);

  // previewUrl change -> reset currentTime, cut timer, remove listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // cancel previous playback timers
    clearTimers();
    // remove pending canplay listeners if any
    if (canPlayListenersRef.current) {
      audio.removeEventListener("canplay", canPlayListenersRef.current.canplay);
      audio.removeEventListener(
        "loadedmetadata",
        canPlayListenersRef.current.loadedmetadata
      );
      audio.removeEventListener("error", canPlayListenersRef.current.error);
      canPlayListenersRef.current = null;
    }

    setIsPlaying(false);
    setError(null);
    try {
      audio.pause();
    } catch {
      // ignore
    }
    try {
      (audio as HTMLAudioElement & { loop?: boolean }).loop = false;
    } catch {
      // ignore
    }
    try {
      audio.currentTime = 0;
    } catch {
      // ignore
    }
    setCurrentTime(0);

    if (previewUrl) {
      audio.src = previewUrl;
    } else {
      audio.src = "";
      try {
        audio.load();
      } catch {
        // ignore
      }
    }
  }, [previewUrl, clearTimers]);

  const play = useCallback(
    async (stageSeconds: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      if (!previewUrl) {
        setError(AUDIO_ERRORS.previewUnavailable);
        return;
      }

      // cancel previous timers before new play (double play guard)
      clearTimers();
      setError(null);
      try {
        (audio as HTMLAudioElement & { loop?: boolean }).loop = false;
      } catch {
        // ignore
      }

      if (audio.src !== previewUrl) {
        audio.src = previewUrl;
      }

      // wait for canplay/loadedmetadata with 5s timeout
      const waitCanPlay = () =>
        new Promise<void>((resolve, reject) => {
          // if already have enough data, resolve immediately
          if (audio.readyState >= 3) {
            resolve();
            return;
          }
          let timeoutId: number | null = null;
          const onCanPlay = () => {
            cleanup();
            resolve();
          };
          const onErr = () => {
            cleanup();
            reject(new Error("load error"));
          };
          const cleanup = () => {
            audio.removeEventListener("canplay", onCanPlay);
            audio.removeEventListener("loadedmetadata", onCanPlay);
            audio.removeEventListener("error", onErr);
            if (timeoutId !== null) window.clearTimeout(timeoutId);
            canPlayListenersRef.current = null;
          };
          audio.addEventListener("canplay", onCanPlay);
          audio.addEventListener("loadedmetadata", onCanPlay);
          audio.addEventListener("error", onErr);
          canPlayListenersRef.current = {
            canplay: onCanPlay,
            loadedmetadata: onCanPlay,
            error: onErr,
          };
          timeoutId = window.setTimeout(() => {
            cleanup();
            resolve(); // timeout -> try to play anyway (spec: timeout 5s then play)
          }, 5000) as unknown as number;
        });

      try {
        await waitCanPlay();
      } catch {
        setError(AUDIO_ERRORS.previewUnavailable);
        return;
      }

      try {
        audio.currentTime = 0;
      } catch {
        // ignore
      }
      setCurrentTime(0);
      try {
        const d = audio.duration;
        if (Number.isFinite(d) && d > 0) setDuration(d);
        else setDuration(stageSeconds);
      } catch { setDuration(stageSeconds); }

      try {
        await audio.play();
      } catch (e: unknown) {
        setError(mapPlayError(e));
        setIsPlaying(false);
        return;
      }

      setIsPlaying(true);
      setError(null);

      const timeoutMs = stageSeconds * 1000;

      // primary timeout — keep progress at 100% (stageSeconds) instead of snapping to 0
      timeoutRef.current = window.setTimeout(() => {
        const a = audioRef.current;
        if (a) {
          try {
            a.pause();
          } catch {
            // ignore
          }
          // keep visual progress at end of clip; reset to 0 happens on next play()
          try {
            a.currentTime = stageSeconds;
          } catch {
            // ignore
          }
          setCurrentTime(stageSeconds);
        }
        clearTimers();
        setIsPlaying(false);
      }, timeoutMs) as unknown as number;

      // rAF guard (fallback to setTimeout if rAF missing) — use elapsed for smooth progress even when audio.currentTime lags (short clips 0.1s)
      const startTime = Date.now();
      const rafGuard = () => {
        const a = audioRef.current;
        if (!a) return;
        const elapsed = Date.now() - startTime;
        const elapsedSec = elapsed / 1000;
        // check via currentTime or elapsed (currentTime may not advance in jsdom / short clips)
        let shouldStop = false;
        try {
          if (a.currentTime >= stageSeconds) shouldStop = true;
        } catch {
          // ignore
        }
        if (elapsed >= timeoutMs) shouldStop = true;
        if (shouldStop) {
          try {
            a.pause();
          } catch {
            // ignore
          }
          try {
            a.currentTime = stageSeconds;
          } catch {
            // ignore
          }
          setCurrentTime(stageSeconds);
          clearTimers();
          setIsPlaying(false);
          return;
        }
        // Smooth progress: use max of audio time and elapsed, so bar moves even if audio lags
        try {
          const audioTime = a.currentTime;
          const smooth = Math.max(audioTime, Math.min(elapsedSec, stageSeconds));
          setCurrentTime(smooth);
        } catch {
          setCurrentTime(Math.min(elapsedSec, stageSeconds));
        }
        if (typeof window.requestAnimationFrame === "function") {
          rafRef.current = window.requestAnimationFrame(rafGuard);
        } else {
          rafRef.current = window.setTimeout(rafGuard, 16) as unknown as number;
        }
      };
      if (typeof window.requestAnimationFrame === "function") {
        rafRef.current = window.requestAnimationFrame(rafGuard);
      } else {
        rafRef.current = window.setTimeout(rafGuard, 16) as unknown as number;
      }

      // fallback setInterval 20ms guard
      intervalRef.current = window.setInterval(() => {
        const a = audioRef.current;
        if (!a) return;
        try {
          if (a.currentTime >= stageSeconds) {
            a.pause();
            a.currentTime = stageSeconds;
            setCurrentTime(stageSeconds);
            clearTimers();
            setIsPlaying(false);
          }
        } catch {
          // ignore
        }
      }, 20) as unknown as number;
    },
    [previewUrl, clearTimers]
  );

  const playFull = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!previewUrl) {
      setError(AUDIO_ERRORS.previewUnavailable);
      return;
    }

    clearTimers();
    setError(null);

    if (audio.src !== previewUrl) {
      audio.src = previewUrl;
    }

    // enable looping for background playback until Nouveau morceau
    try {
      (audio as HTMLAudioElement & { loop?: boolean }).loop = true;
    } catch {
      // ignore
    }

    const waitCanPlay = () =>
      new Promise<void>((resolve, reject) => {
        if (audio.readyState >= 3) {
          resolve();
          return;
        }
        let timeoutId: number | null = null;
        const onCanPlay = () => {
          cleanup();
          resolve();
        };
        const onErr = () => {
          cleanup();
          reject(new Error("load error"));
        };
        const cleanup = () => {
          audio.removeEventListener("canplay", onCanPlay);
          audio.removeEventListener("loadedmetadata", onCanPlay);
          audio.removeEventListener("error", onErr);
          if (timeoutId !== null) window.clearTimeout(timeoutId);
          canPlayListenersRef.current = null;
        };
        audio.addEventListener("canplay", onCanPlay);
        audio.addEventListener("loadedmetadata", onCanPlay);
        audio.addEventListener("error", onErr);
        canPlayListenersRef.current = {
          canplay: onCanPlay,
          loadedmetadata: onCanPlay,
          error: onErr,
        };
        timeoutId = window.setTimeout(() => {
          cleanup();
          resolve();
        }, 5000) as unknown as number;
      });

    try {
      await waitCanPlay();
    } catch {
      setError(AUDIO_ERRORS.previewUnavailable);
      return;
    }

    try {
      audio.currentTime = 0;
    } catch {
      // ignore
    }
    setCurrentTime(0);
    try {
      const d = audio.duration;
      if (Number.isFinite(d) && d > 0) setDuration(d);
      else setDuration(30);
    } catch { setDuration(30); }

    try {
      await audio.play();
    } catch (e: unknown) {
      setError(mapPlayError(e));
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);
    setError(null);
    // rAF loop for full preview so progress bar stays smooth (previously only timeupdate 250ms)
    const fullRaf = () => {
      const a = audioRef.current;
      if (!a) return;
      if (!a.loop && a.paused) return;
      try {
        const ct = a.currentTime;
        if (Number.isFinite(ct)) setCurrentTime(ct);
      } catch {}
      if (typeof window.requestAnimationFrame === "function") {
        rafRef.current = window.requestAnimationFrame(fullRaf);
      } else {
        rafRef.current = window.setTimeout(fullRaf, 32) as unknown as number;
      }
    };
    if (typeof window.requestAnimationFrame === "function") {
      rafRef.current = window.requestAnimationFrame(fullRaf);
    } else {
      rafRef.current = window.setTimeout(fullRaf, 32) as unknown as number;
    }
    // also keep interval for safety
    intervalRef.current = window.setInterval(() => {
      const a = audioRef.current;
      if (!a) return;
      try { setCurrentTime(a.currentTime); } catch {}
    }, 50) as unknown as number;
  }, [previewUrl, clearTimers]);

  return { play, playFull, pause, seek0, setVolume, isPlaying, currentTime, duration, error, isIOS: isIOSState };
}

export default useAudioClip;
