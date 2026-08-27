"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

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

type MobileMenuProps = {
  isOpen: boolean;
  onClose: () => void;
  difficulte?: string;
  epoque?: string;
  onDifficulteChange?: (val: string) => void;
  onEpoqueChange?: (val: string) => void;
};

export default function MobileMenu({
  isOpen,
  onClose,
  difficulte = "Toutes",
  epoque = "Toutes",
  onDifficulteChange,
  onEpoqueChange,
}: MobileMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  // Mémoriser le focus précédent et donner le focus au premier élément
  useEffect(() => {
    if (isOpen) {
      prevFocusRef.current = document.activeElement as HTMLElement | null;
      const first = menuRef.current?.querySelector<HTMLElement>(
        'a, button, select, [tabindex]:not([tabindex="-1"])'
      );
      first?.focus();
      // Empêcher le défilement de l'arrière-plan
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      prevFocusRef.current?.focus();
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Piège de focus + fermeture Échap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab" && menuRef.current) {
        const focusables = menuRef.current.querySelectorAll<HTMLElement>(
          'a, button, select, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 sm:hidden"
      aria-hidden={!isOpen}
    >
      {/* Fond assombri */}
      <button
        type="button"
        aria-label="Fermer le menu"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        tabIndex={-1}
      />

      <div
        ref={menuRef}
        id="menu-mobile"
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navigation"
        className="absolute right-0 top-0 h-full w-80 max-w-[85vw] bg-white p-6 shadow-xl dark:bg-zinc-900 overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold">Menu</span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-zinc-200 bg-white p-2 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 dark:border-zinc-800 dark:bg-zinc-800"
            aria-label="Fermer le menu"
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
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="mt-6 flex flex-col gap-4" aria-label="Navigation mobile">
          <Link
            href="/faq"
            onClick={onClose}
            className="rounded-md px-2 py-3 text-base font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 min-h-11 flex items-center"
          >
            FAQ — Foire aux questions
          </Link>

          <div className="flex flex-col gap-2">
            <label htmlFor="mobile-difficulte" className="text-sm font-medium">
              Difficulté
            </label>
            <select
              id="mobile-difficulte"
              value={difficulte}
              onChange={(e) => onDifficulteChange?.(e.target.value)}
              className="rounded-md border border-zinc-200 bg-white px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-800 dark:bg-zinc-800 min-h-11"
              aria-label="Choisir la difficulté"
            >
              {DIFFICULTES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="mobile-epoque" className="text-sm font-medium">
              Époque
            </label>
            <select
              id="mobile-epoque"
              value={epoque}
              onChange={(e) => onEpoqueChange?.(e.target.value)}
              className="rounded-md border border-zinc-200 bg-white px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-800 dark:bg-zinc-800 min-h-11"
              aria-label="Choisir l'époque"
            >
              {EPOQUES.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>

          <Link
            href="/"
            onClick={onClose}
            className="mt-2 rounded-md bg-zinc-900 px-4 py-3 text-center text-sm font-medium text-white hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 dark:bg-white dark:text-zinc-900 min-h-11 flex items-center justify-center"
          >
            Retour au jeu
          </Link>
        </nav>
      </div>
    </div>
  );
}
