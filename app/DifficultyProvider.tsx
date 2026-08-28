"use client";

import * as React from "react";
import { DifficultyProvider } from "@/components/game/DifficultyContext";

/** Thin wrapper for layout — single re-export point; layout imports this to avoid deep game import. */
export default function AppDifficultyProvider({ children }: { children: React.ReactNode }) {
  return <DifficultyProvider>{children}</DifficultyProvider>;
}
