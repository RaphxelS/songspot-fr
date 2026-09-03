"use client";

import * as React from "react";
import type { LikedArtistCategory, LikedGenreCategory } from "@/lib/likedCategories";

export type LikedCategoriesState = {
  artists: LikedArtistCategory[];
  genres: LikedGenreCategory[];
  totalLiked: number | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  clear: () => void;
};

type CategoriesResponse = {
  artists: LikedArtistCategory[];
  genres: LikedGenreCategory[];
  totalLiked: number;
};

export function useLikedCategories(enabled: boolean): LikedCategoriesState {
  const [artists, setArtists] = React.useState<LikedArtistCategory[]>([]);
  const [genres, setGenres] = React.useState<LikedGenreCategory[]>([]);
  const [totalLiked, setTotalLiked] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fetchedRef = React.useRef(false);

  const refetch = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/me/liked/categories", { cache: "no-store" });
      if (res.status === 401) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || "Non authentifié");
      }
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `Erreur ${res.status}`);
      }
      const j = (await res.json()) as CategoriesResponse;
      setArtists(j.artists ?? []);
      setGenres(j.genres ?? []);
      setTotalLiked(j.totalLiked ?? null);
      fetchedRef.current = true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      setError(msg);
      setArtists([]);
      setGenres([]);
      setTotalLiked(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = React.useCallback(() => {
    setArtists([]);
    setGenres([]);
    setTotalLiked(null);
    setError(null);
    fetchedRef.current = false;
  }, []);

  React.useEffect(() => {
    if (enabled && !fetchedRef.current && !loading && !error) {
      void refetch();
    }
  }, [enabled, loading, error, refetch]);

  return { artists, genres, totalLiked, loading, error, refetch, clear };
}
