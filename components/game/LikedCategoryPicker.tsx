"use client";

import * as React from "react";
import {
  DEFAULT_LIKED_SCOPE_SELECTION,
  STORAGE_KEYS,
  type LikedScope,
  type LikedScopeSelection,
} from "@/lib/constants";
import { formatGenreLabel } from "@/lib/likedCategories";
import type { LikedArtistCategory, LikedGenreCategory } from "@/lib/likedCategories";
import LikedArtistPicker from "@/components/game/LikedArtistPicker";

export type LikedCategoryPickerProps = {
  selection: LikedScopeSelection;
  onSelectionChange: (next: LikedScopeSelection) => void;
  artists: LikedArtistCategory[];
  genres: LikedGenreCategory[];
  totalLiked: number | null;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  poolSize: number | null;
  likedInPool: number | null;
  enrichedInPool: number | null;
  enrichWarning: string | null;
  poolLoading: boolean;
};

const SCOPES: { id: LikedScope; label: string }[] = [
  { id: "all", label: "Tous mes titres" },
  { id: "artist", label: "Par artiste" },
  { id: "genre", label: "Par genre" },
];

export function loadLikedScopeSelection(): LikedScopeSelection {
  if (typeof window === "undefined") return DEFAULT_LIKED_SCOPE_SELECTION;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.likedScope);
    if (!raw) return DEFAULT_LIKED_SCOPE_SELECTION;
    const parsed = JSON.parse(raw) as Partial<LikedScopeSelection>;
    const scope =
      parsed.scope === "artist" || parsed.scope === "genre" || parsed.scope === "all"
        ? parsed.scope
        : "all";
    return {
      scope,
      artistId: typeof parsed.artistId === "string" ? parsed.artistId : null,
      genre: typeof parsed.genre === "string" ? parsed.genre : null,
      enrich: parsed.enrich === true,
    };
  } catch {
    return DEFAULT_LIKED_SCOPE_SELECTION;
  }
}

export function persistLikedScopeSelection(selection: LikedScopeSelection) {
  try {
    window.localStorage.setItem(STORAGE_KEYS.likedScope, JSON.stringify(selection));
  } catch {
    // ignore
  }
}

export default function LikedCategoryPicker({
  selection,
  onSelectionChange,
  artists,
  genres,
  totalLiked,
  loading,
  error,
  onRetry,
  poolSize,
  likedInPool,
  enrichedInPool,
  enrichWarning,
  poolLoading,
}: LikedCategoryPickerProps) {
  const [search, setSearch] = React.useState("");

  const filteredGenres = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return genres;
    return genres.filter(
      (g) => g.name.toLowerCase().includes(q) || formatGenreLabel(g.name).toLowerCase().includes(q),
    );
  }, [genres, search]);

  const handleScopeChange = (scope: LikedScope) => {
    onSelectionChange({
      ...selection,
      scope,
      enrich: scope === "all" ? false : selection.enrich,
    });
  };

  const selectedGenre = genres.find((g) => g.name === selection.genre) ?? null;
  const artistLocked = selection.scope === "artist" && selection.artistId !== null;

  const poolHint = React.useMemo(() => {
    if (selection.scope === "all") {
      if (totalLiked !== null) return `${totalLiked} titres dans le pool`;
      return null;
    }
    if (poolLoading) return "Calcul du pool…";
    if (poolSize === null) return "Sélectionnez une catégorie";
    if (poolSize === 0) return "Aucun titre dans ce pool";
    if (selection.enrich && enrichedInPool && enrichedInPool > 0) {
      return `${likedInPool ?? poolSize} titres aimés + ${enrichedInPool} enrichis = ${poolSize} titres`;
    }
    return `${poolSize} titres aimés dans le pool`;
  }, [selection.scope, selection.enrich, totalLiked, poolLoading, poolSize, likedInPool, enrichedInPool]);

  return (
    <div className="w-full rounded-lg border border-zinc-800 bg-zinc-950/50 p-4 space-y-3">
      {!artistLocked && (
        <>
          <p className="text-xs font-semibold tracking-widest text-zinc-500">CATÉGORIE SPOTIFY</p>

          <div className="flex flex-wrap gap-2">
            {SCOPES.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleScopeChange(id)}
                aria-pressed={selection.scope === id}
                disabled={loading}
                className={`rounded-md px-3 py-2 text-xs font-medium min-h-9 transition-colors ${
                  selection.scope === id
                    ? "bg-green-500 text-black shadow"
                    : "bg-zinc-900 text-zinc-300 border border-zinc-800 hover:bg-zinc-800 disabled:opacity-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-900/50 bg-red-950/20 px-3 py-2 text-xs text-red-300 flex items-center justify-between gap-2"
        >
          <span>Erreur de chargement des catégories : {error}</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="shrink-0 px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-200 hover:bg-zinc-800"
            >
              Réessayer
            </button>
          )}
        </div>
      )}

      {selection.scope !== "all" && !error && (
        <>
          {selection.scope === "artist" ? (
            <LikedArtistPicker
              artists={artists}
              selection={selection}
              onSelectionChange={onSelectionChange}
              loading={loading}
              search={search}
              onSearchChange={setSearch}
              enrichWarning={enrichWarning}
              poolLoading={poolLoading}
            />
          ) : (
            <>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un genre…"
                disabled={loading}
                className="w-full rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 min-h-10"
              />

              {filteredGenres.length === 0 ? (
                <div role="status" className="px-3 py-2 text-xs text-zinc-500">
                  {loading ? "Chargement…" : "Aucun genre trouvé dans vos titres aimés"}
                </div>
              ) : (
                <div
                  className="max-h-40 overflow-y-auto rounded-md border border-zinc-800 divide-y divide-zinc-800/80"
                  role="listbox"
                  aria-label="Genres"
                >
                  {filteredGenres.map((g) => (
                    <button
                      key={g.name}
                      type="button"
                      role="option"
                      aria-selected={selection.genre === g.name}
                      onClick={() =>
                        onSelectionChange({ ...selection, genre: g.name, enrich: selection.enrich })
                      }
                      className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 min-h-10 transition-colors ${
                        selection.genre === g.name
                          ? "bg-green-500/15 text-green-300"
                          : "text-zinc-300 hover:bg-zinc-900"
                      }`}
                    >
                      <span className="truncate">{formatGenreLabel(g.name)}</span>
                      <span className="text-xs text-zinc-500 shrink-0">{g.likedCount} aimés</span>
                    </button>
                  ))}
                </div>
              )}

              {selectedGenre && (
                <label className="flex items-start gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selection.enrich}
                    onChange={(e) => onSelectionChange({ ...selection, enrich: e.target.checked })}
                    disabled={poolLoading}
                    className="mt-0.5 rounded border-zinc-600"
                  />
                  <span className="text-xs text-zinc-300">
                    Enrichir avec d&apos;autres titres du genre {formatGenreLabel(selectedGenre.name)}
                  </span>
                </label>
              )}

              {selection.enrich && enrichWarning && !poolLoading && (
                <p
                  role="status"
                  className="text-xs text-amber-400 bg-amber-950/20 border border-amber-900/50 rounded px-3 py-2"
                >
                  {enrichWarning}
                </p>
              )}
            </>
          )}
        </>
      )}

      {poolHint && (selection.scope !== "artist" || selection.artistId) && (
        <p className={`text-xs ${poolSize !== null && poolSize < 5 && selection.scope !== "all" ? "text-amber-400" : "text-zinc-500"}`}>
          {poolHint}
          {poolSize !== null && poolSize < 5 && selection.scope !== "all" && (
            <span> — le jeu sera plus répétitif avec moins de 5 titres.</span>
          )}
        </p>
      )}
    </div>
  );
}
