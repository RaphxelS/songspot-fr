"use client";

import * as React from "react";
import { DifficultyProvider } from "@/components/game/DifficultyContext";

export default function AppDifficultyProvider({ children }: { children: React.ReactNode }) {
  return <DifficultyProvider>{children}</DifficultyProvider>;
}
