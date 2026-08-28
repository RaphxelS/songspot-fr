"use client";

import * as React from "react";
import { getPrefs, setPrefs } from "@/lib/storage";

export type DifficultyContextValue = {
  difficulty: string;
  era: string;
  setDifficulty: (val: string) => void;
  setEra: (val: string) => void;
};

const DifficultyContext = React.createContext<DifficultyContextValue>({
  difficulty: "Toutes",
  era: "Toutes",
  setDifficulty: () => {},
  setEra: () => {},
});

export function DifficultyProvider({ children }: { children: React.ReactNode }) {
  const [difficulty, setDifficultyState] = React.useState<string>("Toutes");
  const [era, setEraState] = React.useState<string>("Toutes");

  React.useEffect(() => {
    try {
      const prefs = getPrefs();
      if (typeof prefs.difficulty === "string" && prefs.difficulty.length > 0) {
        setDifficultyState(prefs.difficulty);
      }
      if (typeof prefs.era === "string" && prefs.era.length > 0) {
        setEraState(prefs.era);
      }
    } catch {}
  }, []);

  const setDifficulty = React.useCallback((val: string) => {
    setDifficultyState(val);
    try { setPrefs({ difficulty: val }); } catch {}
  }, []);

  const setEra = React.useCallback((val: string) => {
    setEraState(val);
    try { setPrefs({ era: val }); } catch {}
  }, []);

  const value = React.useMemo(() => ({ difficulty, era, setDifficulty, setEra }), [difficulty, era, setDifficulty, setEra]);

  return <DifficultyContext.Provider value={value}>{children}</DifficultyContext.Provider>;
}

export function useDifficulty(): DifficultyContextValue {
  return React.useContext(DifficultyContext);
}

export default DifficultyContext;
