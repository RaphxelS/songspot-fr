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

  // fetchAll: load EVERY liked track (Spotify returns newest-first), then shuffle
  // so older likes get fair weight. No 100 cap. `maxTracks` optional (kept for
  // backward-compat callers) — when omitted, the whole library is kept.
  const fetchAll = React.useCallback(async (maxTracks?: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/me/liked/catalog?scope=all", { cache: "no-store" });
      if (res.status === 401) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || "Non authentifié");
      }
      if (res.status === 429) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || "Spotify limite les requêtes — réessayez dans une minute.");
      }
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `Erreur ${res.status}`);
      }
      const j = (await res.json()) as { tracks: Track[]; likedCount?: number };
      const all = j.tracks ?? [];
      setTracks(
        typeof maxTracks === "number" && maxTracks > 0 ? all.slice(0, maxTracks) : all,
      );
      setTotal(j.likedCount ?? all.length);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      setError(msg);
      setTracks(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = React.useCallback(() => {
    setTracks(null);
    setTotal(null);
    setError(null);
  }, []);

  // Auto-fetch when enabled becomes true and we have no data yet
  React.useEffect(() => {
    if (enabled && tracks === null && !loading && !error) {
      void fetchAll();
    }
    if (!enabled) {
      // keep cache; don't clear automatically to allow quick switch back
    }
  }, [enabled, tracks, loading, error, fetchAll]);

  return { tracks, total, loading, error, fetchLiked, fetchAll, clear };
}
