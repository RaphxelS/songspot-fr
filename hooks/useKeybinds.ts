"use client";

import { useEffect } from "react";
import { isTypingTarget, normalizeKey } from "@/lib/keybinds";
import type { Keybinds } from "@/lib/keybinds";

export type UseKeybindsOptions = {
  enabled?: boolean;
};

export type UseKeybindsCallbacks = {
  onPlay: () => void;
  onSkip: () => void;
};

/**
 * useKeybinds — écoute globale keydown pour play/skip
 * - ignore quand focus dans input/textarea/contenteditable
 * - ignore avec Ctrl/Alt/Meta (Cmd)
 * - normalizeKey pour matching case-insensitive (s/S) et espace " "
 * - Espace preventDefault pour éviter scroll
 */
export function useKeybinds(
  callbacks: UseKeybindsCallbacks,
  keybinds: Keybinds,
  options: UseKeybindsOptions = {}
): void {
  const { enabled = true } = options;
  const { onPlay, onSkip } = callbacks;

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    const handler = (e: KeyboardEvent) => {
      // Ignore with modifiers (Ctrl/Alt/Meta) — Shift allowed? Keep Shift but ignore AltGr
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      // Ignore when typing in field
      const active = document.activeElement as Element | null;
      if (isTypingTarget(active)) return;

      const normalized = normalizeKey(e.key);
      // Direct match for stored key (single char lowercased or " ")
      // e.key normalized lowercased, so "S" -> "s" matches "s"
      if (normalized === keybinds.play) {
        // Espace doit preventDefault (scroll)
        if (e.key === " " || e.code === "Space") {
          e.preventDefault();
        }
        onPlay();
        return;
      }
      if (normalized === keybinds.skip) {
        // For skip, also prevent if needed (no default scroll for s)
        onSkip();
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, keybinds.play, keybinds.skip, onPlay, onSkip]);
}

export default useKeybinds;
