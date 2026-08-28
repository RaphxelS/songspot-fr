"use client";

import Link from "next/link";
import { useState, useCallback } from "react";
import MobileMenu from "./MobileMenu";
import { useDifficulty } from "@/components/game/DifficultyContext";

export default function Header() {
  const [menuOuvert, setMenuOuvert] = useState(false);
  const ctx = useDifficulty();

  const toggleMenu = useCallback(() => {
    setMenuOuvert((o) => !o);
  }, []);

  const closeMenu = useCallback(() => setMenuOuvert(false), []);

  return (
    <header className="w-full bg-[#0a0a0a]/80 backdrop-blur border-b border-zinc-800/50">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="text-lg font-bold tracking-tight text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 rounded px-1"
          aria-label="Accueil Songspot FR"
        >
          <span className="text-zinc-100">songspot</span>
          <span className="text-green-500"> fr</span>
        </Link>

        <nav className="hidden items-center gap-4 sm:flex" aria-label="Navigation principale">
          <Link
            href="/faq"
            className="text-sm text-zinc-400 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 rounded px-2 py-1 min-h-11 inline-flex items-center"
          >
            FAQ
          </Link>
        </nav>

        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 sm:hidden"
          aria-expanded={menuOuvert}
          aria-controls="menu-mobile"
          aria-label={menuOuvert ? "Fermer le menu" : "Ouvrir le menu"}
          onClick={toggleMenu}
        >
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {menuOuvert ? <path d="M6 18L18 6M6 6l12 12" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>
      </div>

      <MobileMenu
        isOpen={menuOuvert}
        onClose={closeMenu}
        difficulte={ctx.difficulty}
        epoque={ctx.era}
        onDifficulteChange={ctx.setDifficulty}
        onEpoqueChange={ctx.setEra}
      />
    </header>
  );
}
