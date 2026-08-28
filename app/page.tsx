import { Suspense } from "react";
import GameContainer from "@/components/game/GameContainer";
import catalog from "@/data/catalog.fr.json";
import type { Track } from "@/lib/catalog";

export default function Home() {
  const tracks = catalog as unknown as Track[];

  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-8">
      <div className="w-full max-w-4xl">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Songspot FR
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Devine la chanson française en 0,1 seconde !
        </p>

        <div className="mt-8 flex justify-center">
          <Suspense
            fallback={
              <div className="w-full max-w-2xl animate-pulse space-y-4" aria-busy="true">
                <div className="h-32 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
                <div className="h-12 rounded-md bg-zinc-100 dark:bg-zinc-800" />
              </div>
            }
          >
            <GameContainer catalog={tracks} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
