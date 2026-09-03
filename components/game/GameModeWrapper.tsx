"use client";

import * as React from "react";
import GameContainer from "@/components/game/GameContainer";
import GameModeSelector, { type GameMode } from "@/components/game/GameModeSelector";
import LikedCategoryPicker, {
  loadLikedScopeSelection,
  persistLikedScopeSelection,
} from "@/components/game/LikedCategoryPicker";
import { useSpotifyAuth } from "@/hooks/useSpotifyAuth";
import { useLikedCatalog } from "@/hooks/useLikedCatalog";
import { useLikedCategories } from "@/hooks/useLikedCategories";
import { useLikedScopedCatalog } from "@/hooks/useLikedScopedCatalog";
import {
  DEFAULT_LIKED_SCOPE_SELECTION,
  STORAGE_KEYS,
  type LikedScopeSelection,
} from "@/lib/constants";
import { formatGenreLabel } from "@/lib/likedCategories";
import { isValidScopedSelection } from "@/lib/likedScope";
import type { Track } from "@/lib/catalog";

type Props = {
  catalog: Track[];
};

function getInitialMode(): GameMode {
  if (typeof window === "undefined") return "top";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.gameMode);
    if (raw === "liked" || raw === "top") return raw as GameMode;
    const prefsRaw = window.localStorage.getItem(STORAGE_KEYS.prefs);
    if (prefsRaw) {
      const parsed = JSON.parse(prefsRaw) as { mode?: string };
      if (parsed.mode === "liked" || parsed.mode === "top") return parsed.mode as GameMode;
    }
  } catch {}
  return "top";
}

function persistMode(mode: GameMode) {
  try {
    window.localStorage.setItem(STORAGE_KEYS.gameMode, mode);
    const raw = window.localStorage.getItem(STORAGE_KEYS.prefs);
    let prefs: Record<string, unknown> = {};
    if (raw) {
      try {
        prefs = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        prefs = {};
      }
    }
    prefs["mode"] = mode;
    window.localStorage.setItem(STORAGE_KEYS.prefs, JSON.stringify(prefs));
  } catch {}
}

export default function GameModeWrapper({ catalog }: Props) {
  const [mode, setMode] = React.useState<GameMode>("top");
  const [likedSelection, setLikedSelection] = React.useState<LikedScopeSelection>(
    DEFAULT_LIKED_SCOPE_SELECTION,
  );
  const [toast, setToast] = React.useState<string | null>(null);
  const auth = useSpotifyAuth();
  const fetchAllLiked =
    mode === "liked" && auth.authenticated && likedSelection.scope === "all";
  const liked = useLikedCatalog(fetchAllLiked);
  const needsCategories =
    mode === "liked" &&
    auth.authenticated &&
    likedSelection.scope !== "all";
  const categories = useLikedCategories(needsCategories);
  const scopedCatalog = useLikedScopedCatalog(
    mode === "liked" && auth.authenticated,
    likedSelection,
  );

  React.useEffect(() => {
    const m = getInitialMode();
    if (m !== mode) setMode(m);
    setLikedSelection(loadLikedScopeSelection());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Validate persisted selection once categories load
  React.useEffect(() => {
    const noCategories =
      categories.artists.length === 0 && categories.genres.length === 0;
    if (categories.loading || noCategories) return;

    if (isValidScopedSelection(likedSelection, categories.artists, categories.genres)) {
      return;
    }

    const next = {
      ...likedSelection,
      scope: "all" as const,
      artistId: null,
      genre: null,
      enrich: false,
    };
    setLikedSelection(next);
    persistLikedScopeSelection(next);
  }, [categories.loading, categories.artists, categories.genres, likedSelection]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const val = sp.get("spotify");
    if (val === "connected") {
      setToast("Connecté à Spotify ! Vous pouvez maintenant choisir Titres aimés.");
      setTimeout(() => setToast(null), 4000);
    } else if (val === "denied") {
      setToast("Connexion Spotify refusée");
      setTimeout(() => setToast(null), 4000);
    } else if (val === "error") {
      const reason = sp.get("reason");
      let msg = "Erreur de connexion Spotify";
      if (reason === "state_mismatch") msg = "Erreur de sécurité (state) — réessayez (vérifiez que vous utilisez localhost, pas 127.0.0.1, et que SPOTIFY_REDIRECT_URI correspond)";
      else if (reason === "not_configured") msg = "Spotify non configuré — vérifiez SPOTIFY_CLIENT_ID/SECRET dans .env.local";
      else if (reason === "token_exchange") msg = "Échange de token échoué — vérifiez SPOTIFY_REDIRECT_URI dans le dashboard Spotify";
      else if (reason === "missing_code") msg = "Code manquant — réessayez";
      setToast(msg);
      setTimeout(() => setToast(null), 5000);
    }
  }, [auth.authenticated, auth.loading]);

  const handleLikedSelectionChange = React.useCallback((next: LikedScopeSelection) => {
    setLikedSelection(next);
    persistLikedScopeSelection(next);
  }, []);

  const handleModeChange = React.useCallback(
    (m: GameMode) => {
      if (m === "liked" && !auth.authenticated) {
        setToast("Connectez votre compte Spotify pour jouer avec vos Titres aimés");
        setTimeout(() => setToast(null), 3000);
        return;
      }
      setMode(m);
      persistMode(m);
      if (m === "liked") {
        const count = liked.tracks?.length ?? liked.total ?? 0;
        setToast(count ? `Mode : Titres aimés (${count} morceaux)` : "Mode : Titres aimés");
      } else {
        setToast("Mode : Top France");
      }
      setTimeout(() => setToast(null), 2500);
    },
    [auth.authenticated, liked.tracks, liked.total],
  );

  const handleConnect = React.useCallback(() => {
    window.location.href = "/api/auth/spotify/login";
  }, []);

  const handleDisconnect = React.useCallback(async () => {
    await auth.logout();
    liked.clear();
    categories.clear();
    scopedCatalog.clear();
    setLikedSelection(DEFAULT_LIKED_SCOPE_SELECTION);
    persistLikedScopeSelection(DEFAULT_LIKED_SCOPE_SELECTION);
    setMode("top");
    persistMode("top");
    setToast("Déconnecté de Spotify");
    setTimeout(() => setToast(null), 2500);
  }, [auth, liked, categories, scopedCatalog]);

  React.useEffect(() => {
    if (!auth.loading && !auth.authenticated && mode === "liked") {
      setMode("top");
      persistMode("top");
    }
  }, [auth.loading, auth.authenticated, mode]);

  const hasAutoSwitched = React.useRef(false);
  React.useEffect(() => {
    if (hasAutoSwitched.current) return;
    if (auth.loading || !auth.authenticated) return;
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("spotify") === "connected" && mode === "top") {
      hasAutoSwitched.current = true;
      setMode("liked");
      persistMode("liked");
      setToast("Mode Titres aimés activé — chargement de vos morceaux…");
      setTimeout(() => setToast(null), 3000);
    }
  }, [auth.loading, auth.authenticated, mode]);

  let effectiveCatalog: Track[] | null = catalog;
  let catalogStatus: "ready" | "loading" | "error" | "empty" | "pick_category" = "ready";

  if (mode === "liked") {
    const waitingForAll = likedSelection.scope === "all";
    if ((waitingForAll && liked.loading) || (likedSelection.scope !== "all" && scopedCatalog.loading)) {
      catalogStatus = "loading";
      effectiveCatalog = null;
    } else if (waitingForAll && liked.error) {
      catalogStatus = "error";
      effectiveCatalog = null;
    } else if (likedSelection.scope === "all") {
      if (liked.tracks) {
        if (liked.tracks.length === 0) {
          catalogStatus = "empty";
          effectiveCatalog = null;
        } else {
          effectiveCatalog = liked.tracks;
          catalogStatus = "ready";
        }
      } else if (auth.authenticated && !auth.loading) {
        catalogStatus = "loading";
        effectiveCatalog = null;
      }
    } else if (scopedCatalog.error) {
      catalogStatus = "error";
      effectiveCatalog = null;
    } else if (!likedSelection.artistId && likedSelection.scope === "artist") {
      catalogStatus = "pick_category";
      effectiveCatalog = null;
    } else if (!likedSelection.genre && likedSelection.scope === "genre") {
      catalogStatus = "pick_category";
      effectiveCatalog = null;
    } else if (scopedCatalog.tracks) {
      if (scopedCatalog.tracks.length === 0) {
        catalogStatus = "empty";
        effectiveCatalog = null;
      } else {
        effectiveCatalog = scopedCatalog.tracks;
        catalogStatus = "ready";
      }
    } else if (auth.authenticated && !auth.loading) {
      catalogStatus = "loading";
      effectiveCatalog = null;
    }
  }

  const poolSize =
    likedSelection.scope === "all"
      ? liked.tracks?.length ?? categories.totalLiked ?? liked.total
      : scopedCatalog.tracks?.length ?? null;

  const displayLikedCount =
    likedSelection.scope === "all"
      ? liked.tracks?.length ?? null
      : categories.totalLiked ?? liked.tracks?.length ?? null;

  const displayTotalLiked = categories.totalLiked ?? liked.total;

  const showCategoryPicker = mode === "liked" && auth.authenticated;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 flex flex-col gap-6">
      <GameModeSelector
        mode={mode}
        onModeChange={handleModeChange}
        isAuthenticated={auth.authenticated}
        isConfigured={auth.configured}
        isAuthLoading={auth.loading}
        likedCount={displayLikedCount}
        totalLiked={displayTotalLiked}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        displayName={auth.user?.display_name ?? null}
      />

      {showCategoryPicker && (
        <LikedCategoryPicker
          selection={likedSelection}
          onSelectionChange={handleLikedSelectionChange}
          artists={categories.artists}
          genres={categories.genres}
          totalLiked={categories.totalLiked ?? liked.total}
          loading={categories.loading}
          error={categories.error}
          onRetry={() => void categories.refetch()}
          poolSize={poolSize ?? null}
          likedInPool={scopedCatalog.likedCount}
          enrichedInPool={scopedCatalog.enrichedCount}
          enrichWarning={scopedCatalog.enrichWarning}
          poolLoading={scopedCatalog.loading}
        />
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="w-full max-w-2xl mx-auto rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-zinc-200 text-center"
        >
          {toast}
        </div>
      )}

      {mode === "liked" && catalogStatus === "loading" && (
        <div className="w-full max-w-7xl mx-auto animate-pulse space-y-4 py-8" aria-busy="true">
          <div className="h-8 rounded bg-zinc-900 w-1/3 mx-auto" />
          <div className="h-32 rounded-lg bg-zinc-900" />
          <div className="h-12 rounded-md bg-zinc-900" />
          <p className="text-center text-xs text-zinc-600">Chargement de vos titres aimés…</p>
        </div>
      )}

      {mode === "liked" && catalogStatus === "pick_category" && likedSelection.scope === "genre" && (
        <div className="w-full max-w-2xl mx-auto rounded-lg border border-zinc-800 bg-zinc-950 p-6 text-center space-y-2">
          <p className="text-sm font-medium text-zinc-200">Choisissez un genre dans la liste ci-dessus</p>
          <p className="text-xs text-zinc-500">
            Le jeu utilisera uniquement vos titres aimés correspondant à cette catégorie.
          </p>
        </div>
      )}

      {mode === "liked" && catalogStatus === "error" && (
        <div className="w-full max-w-2xl mx-auto rounded-lg border border-red-900/50 bg-red-950/20 p-6 text-center space-y-3">
          <p className="text-sm text-red-300">
            Erreur de chargement : {liked.error || scopedCatalog.error}
          </p>
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (likedSelection.scope === "all") void liked.fetchAll();
                else void scopedCatalog.refetch();
              }}
              className="px-4 py-2 rounded-md bg-zinc-900 border border-zinc-800 text-sm text-zinc-200 hover:bg-zinc-800 min-h-11"
            >
              Réessayer
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("top")}
              className="px-4 py-2 rounded-md bg-green-600 text-white text-sm hover:bg-green-500 min-h-11"
            >
              Retour Top France
            </button>
          </div>
        </div>
      )}

      {mode === "liked" && catalogStatus === "empty" && (
        <div className="w-full max-w-2xl mx-auto rounded-lg border border-zinc-800 bg-zinc-950 p-6 text-center space-y-3">
          <p className="text-sm font-medium text-zinc-200">Aucun titre trouvé pour cette sélection</p>
          <p className="text-xs text-zinc-500">
            {likedSelection.scope === "all"
              ? "Aimez des morceaux sur Spotify puis revenez ici."
              : likedSelection.enrich
                ? "Essayez sans enrichissement ou choisissez une autre catégorie."
                : "Activez l'enrichissement pour ajouter d'autres titres, ou choisissez une autre catégorie."}
          </p>
          <div className="flex justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                if (likedSelection.scope === "all") void liked.fetchAll();
                else void scopedCatalog.refetch();
              }}
              className="px-4 py-2 rounded-md bg-zinc-900 border border-zinc-800 text-sm text-zinc-200 hover:bg-zinc-800 min-h-11"
            >
              Actualiser
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("top")}
              className="px-4 py-2 rounded-md bg-green-600 text-white text-sm hover:bg-green-500 min-h-11"
            >
              Jouer Top France
            </button>
          </div>
        </div>
      )}

      {effectiveCatalog && <GameContainer catalog={effectiveCatalog} />}

      {mode === "liked" && effectiveCatalog && effectiveCatalog.length < 5 && (
        <p className="text-xs text-amber-400 text-center max-w-2xl mx-auto bg-amber-950/20 border border-amber-900/50 rounded px-3 py-2">
          {likedSelection.scope === "artist" && likedSelection.artistId
            ? `Peu de titres dans ce pool (${effectiveCatalog.length}).`
            : likedSelection.scope === "genre" && likedSelection.genre
              ? `Peu de titres pour ${formatGenreLabel(likedSelection.genre)} (${effectiveCatalog.length}).`
              : `Vous avez peu de titres aimés (${effectiveCatalog.length}).`}{" "}
          Le jeu sera plus répétitif — ajoutez des titres sur Spotify ou activez l'enrichissement.
        </p>
      )}
    </div>
  );
}
