"use client";

import * as React from "react";
import { formatKey } from "@/lib/keybinds";
import type { Keybinds } from "@/lib/keybinds";
import { DEFAULT_KEYBINDS } from "@/lib/keybinds";

export type OptionsPanelProps = {
  keybinds: Keybinds;
  onChange: (next: Keybinds) => void;
};

export default function OptionsPanel({ keybinds, onChange }: OptionsPanelProps) {
  const [capturing, setCapturing] = React.useState<"play" | "skip" | null>(null);

  React.useEffect(() => {
    if (!capturing) return;
    const handler = (e: KeyboardEvent) => {
      // Annule avec Escape ou Enter
      if (e.key === "Escape" || e.key === "Enter") {
        e.preventDefault();
        setCapturing(null);
        return;
      }
      // Ignore pure modifiers
      if (["Control", "Alt", "Meta", "Shift"].includes(e.key)) return;

      e.preventDefault();
      const raw = e.key;
      let normalized: string;
      if (raw === " " || raw === "Spacebar" || raw === "Space") normalized = " ";
      else if (raw.length === 1) normalized = raw.toLowerCase();
      else {
        // Named keys like "ArrowLeft" -> lowercased?
        normalized = raw.toLowerCase();
        // only allow single char or space for keybinds; fallback
        if (normalized.length !== 1 && normalized !== " ") {
          // For MVP, only allow single char: ignore named keys
          setCapturing(null);
          return;
        }
      }
      const next: Keybinds = { ...keybinds, [capturing]: normalized };
      // Avoid duplicate: if duplicate, keep but allow? Normalize will handle but we prevent same
      if (next.play === next.skip) {
        // if same, don't apply, show toast? just ignore
      } else {
        onChange(next);
      }
      setCapturing(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [capturing, keybinds, onChange]);

  const handleReset = React.useCallback(() => {
    onChange({ ...DEFAULT_KEYBINDS });
  }, [onChange]);

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold tracking-widest text-zinc-500">RACCOURCIS</p>
      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2">
          <span className="text-sm text-zinc-300">Lecture</span>
          <button
            type="button"
            data-testid="keybind-play"
            aria-label="Changer raccourci Lecture"
            onClick={() => setCapturing(capturing === "play" ? null : "play")}
            className={`min-h-7 rounded-md border px-3 py-1 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 min-w-[72px] text-center ${capturing === "play" ? "border-green-500 bg-green-500/20 text-green-400 animate-pulse" : "border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700"}`}
          >
            {capturing === "play" ? "Appuyez sur une touche…" : formatKey(keybinds.play)}
          </button>
        </div>
        <div className="flex items-center justify-between rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2">
          <span className="text-sm text-zinc-300">Passer</span>
          <button
            type="button"
            data-testid="keybind-skip"
            aria-label="Changer raccourci Passer"
            onClick={() => setCapturing(capturing === "skip" ? null : "skip")}
            className={`min-h-7 rounded-md border px-3 py-1 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 min-w-[72px] text-center ${capturing === "skip" ? "border-green-500 bg-green-500/20 text-green-400 animate-pulse" : "border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700"}`}
          >
            {capturing === "skip" ? "Appuyez sur une touche…" : formatKey(keybinds.skip)}
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-zinc-600">Astuce : cliquez puis appuyez sur une touche. Échap pour annuler.</p>
        <button
          type="button"
          data-testid="keybind-reset"
          onClick={handleReset}
          className="text-xs font-medium text-zinc-400 hover:text-zinc-200 min-h-11 px-2"
        >
          Réinitialiser
        </button>
      </div>
      <p className="text-[11px] text-zinc-500">Par défaut : Espace = Lecture, S = Passer. Ignoré dans les champs de saisie.</p>
    </div>
  );
}
