"use client";

import * as React from "react";
import type { Track } from "@/lib/catalog";
import type { LikedScopeSelection } from "@/lib/constants";

export type LikedScopedCatalogState = {
  tracks: Track[] | null;
  likedCount: number | null;
  enrichedCount: number | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  clear: () => void;
};

type CatalogResponse = {
  tracks: Track[];
  likedCount: number;
  enrichedCount: number;
};

function buildCatalogUrl(selection: LikedScopeSelection): string | null {
  if (selection.scope === "all") return null;
  const params = new URLSearchParams({ scope: selection.scope });
  if (selection.scope === "artist") {
    if (!selection.artistId) return null;
    params.set("artistId", selection.artistId);
  }
  if (selection.scope === "genre") {
    if (!selection.genre) return null;
    params.set("genre", selection.genre);
  }
  if (selection.enrich) params.set("enrich", "1");
  return `/api/me/liked/catalog?${params.toString()}`;
}

export function useLikedScopedCatalog(
  enabled: boolean,
  selection: LikedScopeSelection,
): LikedScopedCatalogState {
  const [tracks, setTracks] = React.useState<Track[] | null>(null);
  const [likedCount, setLikedCount] = React.useState<number | null>(null);
  const [enrichedCount, setEnrichedCount] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refetch = React.useCallback(async () => {
    const url = buildCatalogUrl(selection);
    if (!url) {
      setTracks(null);
      setLikedCount(null);
      setEnrichedCount(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.status === 401) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || "Non authentifié");
      }
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `Erreur ${res.status}`);
      }
      const j = (await res.json()) as CatalogResponse;
      setTracks(j.tracks ?? []);
      setLikedCount(j.likedCount ?? null);
      setEnrichedCount(j.enrichedCount ?? null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      setError(msg);
      setTracks(null);
      setLikedCount(null);
      setEnrichedCount(null);
    } finally {
      setLoading(false);
    }
  }, [selection]);

  const clear = React.useCallback(() => {
    setTracks(null);
    setLikedCount(null);
    setEnrichedCount(null);
    setError(null);
  }, []);

  React.useEffect(() => {
    if (!enabled || selection.scope === "all") {
      return;
    }
    const hasSelection =
      (selection.scope === "artist" && selection.artistId) ||
      (selection.scope === "genre" && selection.genre);
    if (!hasSelection) {
      setTracks(null);
      setLikedCount(null);
      setEnrichedCount(null);
      return;
    }
    void refetch();
  }, [enabled, selection, refetch]);

  return { tracks, likedCount, enrichedCount, loading, error, refetch, clear };
}
