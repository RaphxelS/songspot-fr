export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold tracking-tight">
        Songspot FR
      </h1>
      <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400 text-center">
        Devine la chanson française en 0,1 seconde !
      </p>
      <p className="mt-2 text-sm text-zinc-500">
        Catalogue français en chargement…
      </p>
    </main>
  );
}
