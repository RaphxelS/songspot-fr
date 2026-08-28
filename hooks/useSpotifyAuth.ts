"use client";

import * as React from "react";

export type SpotifyAuthState = {
  authenticated: boolean;
  configured: boolean;
  loading: boolean;
  user: { id: string; display_name: string | null } | null;
  error: string | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

export function useSpotifyAuth(): SpotifyAuthState {
  const [authenticated, setAuthenticated] = React.useState(false);
  const [configured, setConfigured] = React.useState(true);
  const [loading, setLoading] = React.useState(true);
  const [user, setUser] = React.useState<{ id: string; display_name: string | null } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const fetchStatus = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/spotify/status", { cache: "no-store" });
      if (!res.ok) {
        setAuthenticated(false);
        setUser(null);
        return;
      }
      const j = (await res.json()) as {
        authenticated: boolean;
        configured?: boolean;
        user?: { id: string; display_name: string | null } | null;
      };
      setAuthenticated(Boolean(j.authenticated));
      setUser(j.user ?? null);
      if (typeof j.configured === "boolean") setConfigured(j.configured);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
      setAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  // Also re-check when spotify query param present (after login redirect)
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.has("spotify")) {
      void fetchStatus();
      // Clean URL after short delay so other components can read the param first
      const clean = window.location.pathname;
      setTimeout(() => {
        try {
          window.history.replaceState({}, "", clean);
        } catch {}
      }, 1500);
    }
  }, [fetchStatus]);

  const logout = React.useCallback(async () => {
    try {
      await fetch("/api/auth/spotify/logout", { method: "POST" });
    } catch {}
    setAuthenticated(false);
    setUser(null);
  }, []);

  return {
    authenticated,
    configured,
    loading,
    user,
    error,
    refresh: fetchStatus,
    logout,
  };
}
