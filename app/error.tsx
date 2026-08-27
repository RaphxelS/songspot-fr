"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      role="alert"
      className="min-h-screen flex flex-col items-center justify-center p-8 max-w-4xl mx-auto text-center"
    >
      <h2 className="text-2xl font-semibold">Une erreur est survenue</h2>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        {error.message || "Impossible de charger la page."}
      </p>
      <button
        onClick={reset}
        className="mt-6 px-6 py-3 bg-black text-white dark:bg-white dark:text-black rounded-lg font-medium min-h-11 min-w-11"
        aria-label="Réessayer"
      >
        Réessayer
      </button>
    </div>
  );
}
