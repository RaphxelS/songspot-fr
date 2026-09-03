"use client";

import * as React from "react";
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

function artistInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join("")
    .toUpperCase();
}

function ArtistAvatar({
  name,
  imageUrl,
  size,
}: {
  name: string;
  imageUrl?: string;
  size: number;
}) {
  const [imgError, setImgError] = React.useState(false);

  React.useEffect(() => {
    setImgError(false);
  }, [imageUrl]);

  const initials = artistInitials(name);
  const boxStyle = { width: size, height: size, minWidth: size, minHeight: size };

  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-full border border-zinc-700 bg-zinc-800"
      style={boxStyle}
      aria-hidden="true"
    >
      <div
        className="absolute inset-0 flex items-center justify-center font-semibold text-zinc-300"
        style={{ fontSize: Math.max(12, Math.round(size * 0.32)) }}
      >
        {initials || "?"}
      </div>
      {imageUrl && !imgError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          width={size}
          height={size}
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : null}
    </div>
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
  const withImages = artists.filter((a) => a.imageUrl).length;

  if (selectedArtist) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 p-3">
          <ArtistAvatar name={selectedArtist.name} imageUrl={selectedArtist.imageUrl} size={56} />
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

      {!loading && artists.length > 0 && withImages === 0 && (
        <p role="status" className="text-xs text-amber-400">
          Aucune pochette trouvée — affichage des initiales. Rechargez la page ou réessayez.
        </p>
      )}

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
              className="group rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 flex flex-col items-center gap-2 text-center transition-colors hover:border-green-500/50 hover:bg-zinc-900"
            >
              <ArtistAvatar name={artist.name} imageUrl={artist.imageUrl} size={80} />
              <span className="text-sm font-medium text-zinc-100 truncate w-full">{artist.name}</span>
              <span className="text-xs text-zinc-500">{artist.likedCount} aimés</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
