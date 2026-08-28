"use client";

import * as React from "react";

const EPOQUES = ["Toutes", "Classique", "2000s", "2010s", "2020s"] as const;

export type EraFilterProps = {
  value: string;
  onChange: (val: string) => void;
  id?: string;
  label?: string;
};

export default function EraFilter({ value, onChange, id = "era-filter", label = "Époque" }: EraFilterProps) {
  return (
    <div className="flex flex-col gap-1.5" role="group" aria-label={label}>
      <span className="text-sm font-medium" id={`${id}-label`}>{label}</span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby={`${id}-label`}>
        {EPOQUES.map((e) => {
          const active = value === e;
          return (
            <button key={e} type="button" role="button" aria-pressed={active} aria-label={`Époque ${e}`} data-testid={`era-${e}`} onClick={() => onChange(e)} className={`min-h-11 rounded-full border px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-100 ${active ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900" : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"}`}>{e}</button>
          );
        })}
      </div>
    </div>
  );
}

export { EPOQUES };
