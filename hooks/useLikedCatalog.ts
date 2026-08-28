"use client";

import * as React from "react";
import type { Track } from "@/lib/catalog";

export type LikedCatalogState = {
  tracks: Track[] | null;
  total: number | null;
  loading: boolean;
  error: string | null;
  fetchLiked: (opts?: { limit?: number; offset?: number }) => Promise<void>;
  fetchAll: (maxTracks?: number) => Promise<void>;
  clear: () => void;
};

type LikedResponse = {
  tracks: Track[];
  total: number | null;
  limit: number;
  offset: number;
  playableCount: number;
};

export function useLikedCatalog(enabled: boolean): LikedCatalogState {
  const [tracks, setTracks] = React.useState<Track[] | null>(null);
  const [total, setTotal] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchLiked = React.useCallback(async (opts?: { limit?: number; offset?: number }) => {
    const limit = opts?.limit ?? 50;
    const offset = opts?.offset ?? 0;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      const res = await fetch(`/api/me/liked?${qs.toString()}`, { cache: "no-store" });
      if (res.status === 401) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || "Non authentifié");
      }
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `Erreur ${res.status}`);
      }
      const j = (await res.json()) as LikedResponse;
      setTracks(j.tracks);
      setTotal(j.total);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      setError(msg);
      setTracks(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAll = React.useCallback(
    async (maxTracks = 100) => {
      setLoading(true);
      setError(null);
      try {
        const all: Track[] = [];
        let offset = 0;
        const pageSize = 50;
        let totalVal: number | null = null;

        while (all.length < maxTracks) {
          const qs = new URLSearchParams({ limit: String(pageSize), offset: String(offset) });
          const res = await fetch(`/api/me/liked?${qs.toString()}`, { cache: "no-store" });
          if (res.status === 401) {
            const j = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(j.error || "Non authentifié");
          }
          if (!res.ok) {
            const j = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(j.error || `Erreur ${res.status}`);
          }
          const j = (await res.json()) as LikedResponse;
          if (totalVal === null) totalVal = j.total;
          if (j.tracks.length === 0) break;
          all.push(...j.tracks);
          offset += pageSize;
          if (totalVal !== null && all.length >= totalVal) break;
          if (totalVal !== null && offset >= totalVal) break;
          if (offset > 1000) break;
          // continue even if j.tracks.length < pageSize when filtering may have dropped tracks
          // next iteration will get empty and break, ensuring we reach maxTracks=100
        }

        setTracks(all.slice(0, maxTracks));
        setTotal(totalVal);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erreur inconnue";
        setError(msg);
        setTracks(null);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const clear = React.useCallback(() => {
    setTracks(null);
    setTotal(null);
    setError(null);
  }, []);

  // Auto-fetch when enabled becomes true and we have no data yet
  React.useEffect(() => {
    if (enabled && tracks === null && !loading && !error) {
      void fetchAll(100);
    }
    if (!enabled) {
      // keep cache; don't clear automatically to allow quick switch back
    }
  }, [enabled, tracks, loading, error, fetchAll]);

  return { tracks, total, loading, error, fetchLiked, fetchAll, clear };
}
