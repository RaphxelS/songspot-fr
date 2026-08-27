"use client";

import Link from "next/link";
import { useState, useCallback } from "react";
import MobileMenu from "./MobileMenu";

const DIFFICULTES = [
  "Toutes",
  "Facile",
  "Moyen",
  "Difficile",
  "Expert",
  "Impossible",
] as const;

const EPOQUES = [
  "Toutes",
  "Classique",
  "2000s",
  "2010s",
  "2020s",
] as const;

export type HeaderProps = {
  difficulte?: string;
  epoque?: string;
  onDifficulteChange?: (val: string) => void;
  onEpoqueChange?: (val: string) => void;
};

export default function Header({
  difficulte,
  epoque,
  onDifficulteChange,
  onEpoqueChange,
}: HeaderProps) {
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [interneDifficulte, setInterneDifficulte] = useState<string>(
    difficulte ?? "Toutes"
  );
  const [interneEpoque, setInterneEpoque] = useState<string>(
    epoque ?? "Toutes"
  );

  const couranteDifficulte =
    difficulte !== undefined ? difficulte : interneDifficulte;
  const couranteEpoque = epoque !== undefined ? epoque : interneEpoque;

  const handleDifficulte = useCallback(
    (val: string) => {
      if (onDifficulteChange) onDifficulteChange(val);
      else setInterneDifficulte(val);
    },
    [onDifficulteChange]
  );

  const handleEpoque = useCallback(
    (val: string) => {
      if (onEpoqueChange) onEpoqueChange(val);
      else setInterneEpoque(val);
    },
    [onEpoqueChange]
  );

  const toggleMenu = useCallback(() => {
    setMenuOuvert((o) => !o);
  }, []);

  const closeMenu = useCallback(() => setMenuOuvert(false), []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="text-lg font-bold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-100 rounded px-1"
          aria-label="Accueil Songspot FR"
        >
          Songspot FR
        </Link>

        {/* Navigation bureau */}
        <nav
          className="hidden items-center gap-4 sm:flex"
          aria-label="Navigation principale"
        >
          <Link
            href="/faq"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 rounded px-2 py-1"
          >
            FAQ
          </Link>

          <div className="flex items-center gap-2">
            <label htmlFor="header-difficulte" className="text-sm font-medium">
              Difficulté
            </label>
            <select
              id="header-difficulte"
              value={couranteDifficulte}
              onChange={(e) => handleDifficulte(e.target.value)}
              className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 min-h-11"
              aria-label="Choisir la difficulté"
            >
              {DIFFICULTES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="header-epoque" className="text-sm font-medium">
              Époque
            </label>
            <select
              id="header-epoque"
              value={couranteEpoque}
              onChange={(e) => handleEpoque(e.target.value)}
              className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 min-h-11"
              aria-label="Choisir l'époque"
            >
              {EPOQUES.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
        </nav>

        {/* Bouton hamburger mobile ≤640px */}
        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-zinc-200 bg-white p-2 text-zinc-700 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 sm:hidden"
          aria-expanded={menuOuvert}
          aria-controls="menu-mobile"
          aria-label={menuOuvert ? "Fermer le menu" : "Ouvrir le menu"}
          onClick={toggleMenu}
        >
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            {menuOuvert ? (
              <path d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      <MobileMenu
        isOpen={menuOuvert}
        onClose={closeMenu}
        difficulte={couranteDifficulte}
        epoque={couranteEpoque}
        onDifficulteChange={handleDifficulte}
        onEpoqueChange={handleEpoque}
      />
    </header>
  );
}
