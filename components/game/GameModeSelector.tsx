"use client";

import * as React from "react";

export type GameMode = "top" | "liked";

export type GameModeSelectorProps = {
  mode: GameMode;
  onModeChange: (m: GameMode) => void;
  isAuthenticated: boolean;
  isConfigured: boolean;
  isAuthLoading: boolean;
  likedCount: number | null;
  totalLiked: number | null;
  onConnect: () => void;
  onDisconnect: () => void;
  displayName: string | null;
};

export default function GameModeSelector({
  mode,
  onModeChange,
  isAuthenticated,
  isConfigured,
  isAuthLoading,
  likedCount,
  totalLiked,
  onConnect,
  onDisconnect,
  displayName,
}: GameModeSelectorProps) {
  const hasLikedCatalog = likedCount !== null && likedCount > 0;

  return (
    <div className="w-full rounded-lg border border-zinc-800 bg-zinc-950/50 p-4 space-y-3">
      <p className="text-xs font-semibold tracking-widest text-zinc-500">MODE DE JEU</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onModeChange("top")}
          aria-pressed={mode === "top"}
          className={`rounded-md px-3 py-2.5 text-sm font-medium min-h-11 flex flex-col items-start justify-center transition-colors ${
            mode === "top"
              ? "bg-green-500 text-black shadow"
              : "bg-zinc-900 text-zinc-300 border border-zinc-800 hover:bg-zinc-800"
          }`}
        >
          <span className="font-bold">Top France</span>
          <span className={`text-xs ${mode === "top" ? "text-black/70" : "text-zinc-500"}`}>Top 50 + Top Titres France</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (!isAuthenticated) return;
            onModeChange("liked");
          }}
          disabled={!isAuthenticated}
          aria-pressed={mode === "liked"}
          title={
            !isConfigured
              ? "Connexion Spotify non configurée (SPOTIFY_CLIENT_ID manquant)"
              : !isAuthenticated
                ? "Connectez votre compte Spotify pour jouer avec vos Titres aimés"
                : undefined
          }
          className={`rounded-md px-3 py-2.5 text-sm font-medium min-h-11 flex flex-col items-start justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            mode === "liked"
              ? "bg-green-500 text-black shadow"
              : isAuthenticated
                ? "bg-zinc-900 text-zinc-300 border border-zinc-800 hover:bg-zinc-800"
                : "bg-zinc-900 text-zinc-500 border border-zinc-800"
          }`}
        >
          <span className="font-bold flex items-center gap-1.5">
            Titres aimés
            {isAuthenticated && hasLikedCatalog && (
              <span className="text-xs font-normal opacity-80">· {likedCount} titres</span>
            )}
          </span>
          <span className={`text-xs ${mode === "liked" ? "text-black/70" : "text-zinc-500"}`}>
            {isAuthenticated ? (totalLiked !== null ? `${totalLiked} titres aimés` : "Vos titres Spotify") : "Connexion Spotify requise"}
          </span>
        </button>
      </div>

      <div className="pt-2 border-t border-zinc-800/50 flex items-center justify-between gap-3">
        {isAuthLoading ? (
          <span className="text-xs text-zinc-500">Vérification...</span>
        ) : isAuthenticated ? (
          <span className="text-xs text-zinc-400">
            Connecté{displayName ? ` en tant que ${displayName}` : ""}{" "}
            <span aria-hidden="true" className="text-green-500">●</span>
          </span>
        ) : !isConfigured ? (
          <span className="text-xs text-zinc-500" title="SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET manquants">
            Connexion Spotify non configurée
          </span>
        ) : (
          <span className="text-xs text-zinc-500">Non connecté à Spotify</span>
        )}

        {isAuthenticated ? (
          <button
            type="button"
            onClick={onDisconnect}
            className="text-xs px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 min-h-8"
          >
            Déconnecter
          </button>
        ) : (
          <a
            href="/api/auth/spotify/login"
            onClick={(e) => {
              e.preventDefault();
              if (!isConfigured) return;
              onConnect();
            }}
            aria-disabled={!isConfigured}
            title={!isConfigured ? "Connexion Spotify non configurée (SPOTIFY_CLIENT_ID manquant)" : undefined}
            className={`text-xs px-3 py-1.5 rounded-md font-semibold min-h-8 inline-flex items-center ${
              isConfigured
                ? "bg-[#1DB954] text-black hover:bg-[#1ed760]"
                : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
            }`}
          >
            Connecter Spotify
          </a>
        )}
      </div>

      {!isAuthenticated && mode === "liked" && (
        <p role="alert" className="text-xs text-amber-400 bg-amber-950/20 border border-amber-900/50 rounded px-2 py-1.5">
          Vous devez connecter Spotify pour jouer en mode Titres aimés.
        </p>
      )}
    </div>
  );
}
