export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 max-w-4xl mx-auto animate-pulse">
      <div className="h-10 w-48 bg-zinc-200 dark:bg-zinc-800 rounded" />
      <div className="mt-4 h-6 w-72 bg-zinc-200 dark:bg-zinc-800 rounded" />
      <div className="mt-8 h-32 w-full max-w-xl bg-zinc-100 dark:bg-zinc-900 rounded-lg" />
      <p className="sr-only" aria-live="polite" aria-busy="true">
        Chargement en cours…
      </p>
    </div>
  );
}
