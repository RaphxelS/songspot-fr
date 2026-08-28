# Plan : Songspot Liked Songs — Mode Titres aimés

## Overview
Ajout du mode de jeu « Titres aimés » (catalogue personnel Spotify) à l'application existante Songspot FR.

## Tasks

### T01 — lib/spotifyAuth.ts (OAuth helpers)
- Créer `lib/spotifyAuth.ts` (server-only) : helpers `generateState`, `getRedirectUri`, `getAuthorizeUrl`, `exchangeCodeForTokens`, `refreshAccessToken`, `getValidAccessToken`, `fetchSpotifyUser`, cookie helpers (`setAuthCookies`, `getStoredTokens`, `clearAuthCookies`, `setStateCookie` etc.)
- Utilise `SPOTIFY_CLIENT_ID/SECRET`, `SPOTIFY_REDIRECT_URI` / `NEXT_PUBLIC_BASE_URL`
- Timeout 5s, Basic base64, state 16 bytes hex
- Tests : mock fetch token, refresh, state, redirectUri dérivation

### T02 — Routes OAuth
- `GET /api/auth/spotify/login` → génère state, pose cookie httpOnly, redirect 302 vers authorize Spotify avec scope user-library-read
- `GET /api/auth/spotify/callback` → vérifie state, gère error=access_denied, échange code → tokens, pose cookies httpOnly (access 3600, refresh 30d, expiresAt), redirect `/?spotify=connected`
- `GET /api/auth/spotify/status` → lit cookies, tente refresh si expiring, fetch /v1/me, retourne `{ authenticated, user, configured }`
- `POST /api/auth/spotify/logout` → clear cookies
- Vérifier CSRF, SameSite Lax, Secure prod, httpOnly, never expose token to client HTML

### T03 — Route /api/me/liked
- `GET /api/me/liked?limit=50&offset=0` → getValidAccessToken, fetch `https://api.spotify.com/v1/me/tracks?limit=&offset=&market=FR` avec timeout 5s, map via `mapSpotifyTrack` (réutilise logique catalog : normalizeReleaseDate, deriveEra, cover https, artist join, popularity clamp), keep tracks même sans preview_url (empty string) pour lazy enrichment client, retourne `{ tracks, total, limit, offset, playableCount }`
- Gestion erreurs : 401 → "Non authentifié", 502 sur fetch fail
- Pas de SSRF, Cache-Control private

### T04 — Hooks client
- `hooks/useSpotifyAuth.ts` → fetch `/api/auth/spotify/status`, expose `authenticated, configured, loading, user, logout, refresh`, re-check sur `?spotify=` param et nettoyage URL
- `hooks/useLikedCatalog.ts` → `useLikedCatalog(enabled)` expose `tracks, total, loading, error, fetchLiked, fetchAll(maxTracks)`, auto-fetch 100 when enabled & authenticated, pagination 50 par 50

### T05 — UI GameModeSelector
- `components/game/GameModeSelector.tsx` → 2 boutons Top France / Titres aimés, disabled si !authenticated, tooltip si !configured, badge likedCount, status ligne (Vérification / Connecté ● / Non configurée / Non connecté), bouton Connecter/Déconnecter, alert si mode liked non auth
- Tailwind, min-h-11

### T06 — Wrapper GameModeWrapper
- `components/game/GameModeWrapper.tsx` → gère `mode` state (top|liked) persisté `STORAGE_KEYS.gameMode` + `songspot-fr:prefs.mode`, auth via `useSpotifyAuth`, liked via `useLikedCatalog`, toasts spotify param, handleModeChange, handleConnect (redirect login), handleDisconnect (clear + switch top), auto-switch top if logged out while liked, décide `effectiveCatalog` (catalog global vs liked tracks) et `catalogStatus` (loading/error/empty/ready), affiche loaders, erreurs, emptyCard, puis `<GameContainer catalog={effectiveCatalog} />`, warning si <5 titres

### T07 — GameContainer preview manquant + page
- Modifier `components/game/GameContainer.tsx` : useEffect preview gère `preview_url == null || ""` → fetch `/api/preview?artist=&title=` lazy, setResolvedPreview ou null, isRefreshing
- Modifier `app/page.tsx` → importe `GameModeWrapper` au lieu de direct `GameContainer`, passe `catalog.fr.json` comme fallback top
- Vérifier que `useGameState` pool change déclenche selectNewTrack sur nouveau catalogue (deps catalog)

### T08 — Storage & constants
- `lib/constants.ts` → ajoute `STORAGE_KEYS.likedPlayedIds`, `STORAGE_KEYS.gameMode`, `GameMode` type
- `lib/storage.ts` → ajoute `getGameMode/setGameMode`, `getLikedPlayedIds/setLikedPlayedIds`, clear helpers, memory fallback, types
- `.env.example` → ajoute `SPOTIFY_REDIRECT_URI`, `NEXT_PUBLIC_BASE_URL`

### T09 — Vérification & docs
- `npm run build` (6 routes dynamiques attendues), `npx tsc --noEmit`, `npm run lint` (8 warnings pre-existants only), `npm run test` (246 pass), `npm run test:ci` (All 61.75 >60)
- Tester manuellement : sans creds → bouton grisé + tooltip "non configurée", avec creds → login → callback → status true → liked fetch → jeu sur liked catalog avec preview lazy

## Dependencies
T01 → T02 → T03 → T04 → T05 → T06 → T07 → T08 (constants before usage, but done early) → T09

## Verification
- Build output 28.9 kB / (vs 24.4 kB avant), 6 routes dynamiques (callback, login, logout, status, liked, preview)
- Tests 246 pass, tsc 0, lint 0 errors
- Statut endpoint configured flag
- Wrapper persiste mode + gère empty/loading/error
