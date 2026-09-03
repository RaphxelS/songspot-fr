"use client";

import * as React from "react";
import Image from "next/image";
import type { LikedArtistCategory } from "@/lib/likedCategories";
import type { LikedScopeSelection } from "@/lib/constants";

type Props = {
  artists: LikedArtistCategory[];
  selection: LikedScopeSelection;
  onSelectionChange: (next: LikedScopeSelection) => void;
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  enrichWarning: string | null;
  poolLoading: boolean;
};

function ArtistAvatar({ name, imageUrl }: { name: string; imageUrl?: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join("")
    .toUpperCase();

  if (imageUrl) {
    return (
      <Image
        src={imageUrl}
        alt=""
        width={96}
        height={96}
        className="w-full h-full object-cover"
        unoptimized
      />
    );
  }

  return (
    <span className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-300 text-lg font-semibold">
      {initials || "?"}
    </span>
  );
}

export default function LikedArtistPicker({
  artists,
  selection,
  onSelectionChange,
  loading,
  search,
  onSearchChange,
  enrichWarning,
  poolLoading,
}: Props) {
  const filteredArtists = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return artists;
    return artists.filter((a) => a.name.toLowerCase().includes(q));
  }, [artists, search]);

  const selectedArtist = artists.find((a) => a.id === selection.artistId) ?? null;

  if (selectedArtist) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 p-3">
          <div className="relative w-14 h-14 rounded-full overflow-hidden shrink-0 border border-zinc-700">
            <ArtistAvatar name={selectedArtist.name} imageUrl={selectedArtist.imageUrl} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-zinc-100 truncate">{selectedArtist.name}</p>
            <p className="text-xs text-zinc-400">{selectedArtist.likedCount} titres aimés</p>
          </div>
          <button
            type="button"
            onClick={() => onSelectionChange({ ...selection, artistId: null })}
            className="shrink-0 text-xs px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 min-h-8"
          >
            Changer
          </button>
        </div>

        <label className="flex items-start gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={selection.enrich}
            onChange={(e) => onSelectionChange({ ...selection, enrich: e.target.checked })}
            disabled={poolLoading}
            className="mt-0.5 rounded border-zinc-600"
          />
          <span className="text-xs text-zinc-300">
            Enrichir avec d&apos;autres titres de {selectedArtist.name} (au-delà de vos{" "}
            {selectedArtist.likedCount} titres aimés)
          </span>
        </label>

        {selection.enrich && enrichWarning && !poolLoading && (
          <p
            role="status"
            className="text-xs text-amber-400 bg-amber-950/20 border border-amber-900/50 rounded px-3 py-2"
          >
            {enrichWarning}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-300">Choisissez un artiste parmi vos titres aimés</p>

      <input
        type="search"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Rechercher un artiste…"
        disabled={loading}
        className="w-full rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 min-h-10"
      />

      {filteredArtists.length === 0 ? (
        <div role="status" className="px-3 py-6 text-center text-xs text-zinc-500">
          {loading ? "Chargement…" : "Aucun artiste trouvé dans vos titres aimés"}
        </div>
      ) : (
        <div
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
          role="list"
          aria-label="Artistes"
        >
          {filteredArtists.map((artist) => (
            <button
              key={artist.id}
              type="button"
              role="listitem"
              aria-label={`${artist.name}, ${artist.likedCount} titres aimés`}
              onClick={() =>
                onSelectionChange({ ...selection, artistId: artist.id, enrich: selection.enrich })
              }
              className="group rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 flex flex-col items-center gap-2 text-center transition-colors hover:border-green-500/50 hover:bg-zinc-900 min-h-36"
            >
              <div className="relative w-20 h-20 rounded-full overflow-hidden border border-zinc-700 group-hover:border-green-500/40 transition-colors">
                <ArtistAvatar name={artist.name} imageUrl={artist.imageUrl} />
              </div>
              <span className="text-sm font-medium text-zinc-100 truncate w-full">{artist.name}</span>
              <span className="text-xs text-zinc-500">{artist.likedCount} aimés</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
