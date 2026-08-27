"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AUDIO_ERRORS,
  clampVolume,
  isIOS as checkIsIOS,
  mapPlayError,
} from "@/lib/audio";

export type UseAudioClipReturn = {
  play: (stageSeconds: number) => Promise<void>;
  pause: () => void;
  seek0: () => void;
  setVolume: (v: number) => void;
  isPlaying: boolean;
  currentTime: number;
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
      const raw = window.localStorage.getItem("songspot-fr:prefs");
      const prefs = raw ? JSON.parse(raw) : {};
      prefs.volume = clamped;
      window.localStorage.setItem("songspot-fr:prefs", JSON.stringify(prefs));
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
    audio.addEventListener("error", onError);
    // timeupdate is too slow (250ms) for 0.1s, but keep for currentTime display fallback
    audio.addEventListener("timeupdate", onTimeUpdate);

    // iOS detection + restore volume from storage
    try {
      setIsIOSState(checkIsIOS());
      const raw = window.localStorage.getItem("songspot-fr:prefs");
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
        await audio.play();
      } catch (e: unknown) {
        setError(mapPlayError(e));
        setIsPlaying(false);
        return;
      }

      setIsPlaying(true);
      setError(null);

      const timeoutMs = stageSeconds * 1000;

      // primary timeout
      timeoutRef.current = window.setTimeout(() => {
        const a = audioRef.current;
        if (a) {
          try {
            a.pause();
          } catch {
            // ignore
          }
          try {
            a.currentTime = 0;
          } catch {
            // ignore
          }
          setCurrentTime(0);
        }
        clearTimers();
        setIsPlaying(false);
      }, timeoutMs) as unknown as number;

      // rAF guard (fallback to setTimeout if rAF missing)
      const startTime = Date.now();
      const rafGuard = () => {
        const a = audioRef.current;
        if (!a) return;
        const elapsed = Date.now() - startTime;
        // check via currentTime or elapsed (currentTime may not advance in jsdom)
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
            a.currentTime = 0;
          } catch {
            // ignore
          }
          setCurrentTime(0);
          clearTimers();
          setIsPlaying(false);
          return;
        }
        try {
          setCurrentTime(a.currentTime);
        } catch {
          // ignore
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
            a.currentTime = 0;
            setCurrentTime(0);
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

  return { play, pause, seek0, setVolume, isPlaying, currentTime, error, isIOS: isIOSState };
}

export default useAudioClip;
