import { Suspense } from "react";
import GameModeWrapper from "@/components/game/GameModeWrapper";
import catalog from "@/data/catalog.fr.json";
import type { Track } from "@/lib/catalog";

export default function Home() {
  const tracks = catalog as unknown as Track[];

  return (
    <Suspense
      fallback={
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse space-y-4" aria-busy="true">
          <div className="h-32 rounded-lg bg-zinc-900" />
          <div className="h-12 rounded-md bg-zinc-900" />
        </div>
      }
    >
      <GameModeWrapper catalog={tracks} />
    </Suspense>
  );
}
