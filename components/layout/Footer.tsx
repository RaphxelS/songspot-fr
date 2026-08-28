import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-auto w-full border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-4 text-sm text-zinc-600 dark:text-zinc-400 sm:flex-row sm:justify-between sm:items-start">
          <div className="max-w-xl">
            <p>
              Les extraits audio proviennent de Spotify. Toutes les marques et
              contenus appartiennent à leurs propriétaires respectifs.
            </p>
            <p className="mt-2">
              Attribution : données catalogue via Spotify Web API — ce projet
              n&apos;est pas affilié à Spotify.
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              Songspot FR — Inspiré par songspot.net — Catalogue : Top 50
              France &amp; Top Titres France
            </p>
          </div>

          <nav aria-label="Pied de page" className="flex flex-col gap-2 sm:items-end">
            <Link
              href="/faq"
              className="font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-100 rounded px-1 py-1 min-h-11 inline-flex items-center"
            >
              Foire aux questions
            </Link>
            <Link
              href="/"
              className="text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 rounded px-1 py-1 min-h-11 inline-flex items-center"
            >
              Accueil
            </Link>
          </nav>
        </div>

        <div className="mt-6 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <p className="text-xs text-zinc-400">
            © {new Date().getFullYear()} Songspot FR — Jeu musical gratuit —
            Aucune donnée personnelle stockée hors navigateur (localStorage).
          </p>
        </div>
      </div>
    </footer>
  );
}
