"use client";

import * as React from "react";
import { DIFFICULTY_LABELS } from "@/lib/difficulty";

const DIFFICULTES = [...DIFFICULTY_LABELS] as const;
export type DifficultySelectorProps = {
  value: string;
  onChange: (val: string) => void;
  id?: string;
  label?: string;
};

export default function DifficultySelector({ value, onChange, id = "difficulte-selector", label = "Difficulté" }: DifficultySelectorProps) {
  return (
    <div className="flex flex-col gap-1.5" role="group" aria-label={label}>
      <span className="text-sm font-medium" id={`${id}-label`}>{label}</span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby={`${id}-label`}>
        {DIFFICULTES.map((d) => {
          const active = value === d;
          return (
            <button key={d} type="button" role="button" aria-pressed={active} aria-label={`Difficulté ${d}`} data-testid={`difficulty-${d}`} onClick={() => onChange(d)} className={`min-h-11 rounded-full border px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-100 ${active ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900" : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"}`}>{d}</button>
          );
        })}
      </div>
    </div>
  );
}
export { DIFFICULTES };
