---
version: "1.0"
status: confirmed
created: "2026-08-28T16:00:00Z"
project_name: "songspot-liked-songs"
type: feature
coverage:
  goal: CLEAR
  constraints: CLEAR
  success_criteria: CLEAR
  existing_context: CLEAR
---

# Songspot — Liked Songs Game Mode — Requirements Specification

## Goal

Ajouter un **mode de jeu « Titres aimés »** à Songspot FR : l'utilisateur connecte son compte Spotify (OAuth), l'app charge ses titres likés (`GET /v1/me/tracks`) et lance la même boucle de jeu (0.1 → 0.5 → 2 → 8 → 15s) mais uniquement sur ce catalogue personnel. Le mode coexiste avec le mode existant **Top France** ; un sélecteur « Mode de jeu » permet de basculer. Aucun stockage PII côté serveur au-delà des tokens en cookies httpOnly.

Audience : joueurs déjà sur Songspot FR qui veulent jouer avec leur bibliothèque personnelle.

## Constraints

- **Technique**:
  - Next.js 15 App Router (existant). Tout code OAuth côté serveur uniquement (`server-only`).
  - Spotify Authorization Code Flow (avec `client_secret`) — scopes : `user-library-read`. Optionally `user-read-email` pour affichage nom.
  - Variables d'env : réutilise `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` existants, ajoute `SPOTIFY_REDIRECT_URI` (ex: `http://localhost:3000/api/auth/spotify/callback`) et/ou `NEXT_PUBLIC_BASE_URL` pour dériver la redirect. Sans `SPOTIFY_CLIENT_ID` → mode désactivé (bouton grisé + tooltip).
  - Cookies httpOnly `spotify_access_token`, `spotify_refresh_token`, `spotify_token_expires_at` (ou JSON unique), `spotify_auth_state` pour CSRF. `SameSite=Lax`, `Secure` en prod, `Path=/`, `Max-Age` aligné sur expires_in/refresh long-lived. Jamais exposer le token au client sauf via endpoints authentifiés.
  - Endpoints serveur :
    - `GET /api/auth/spotify/login` → 302 vers `https://accounts.spotify.com/authorize?...&scope=user-library-read&state=...`
    - `GET /api/auth/spotify/callback?code=&state=` → échange `POST https://accounts.spotify.com/api/token` (Basic base64), pose cookies, redirect `/?spotify=connected` ou `/?spotify=error`. Vérifie `state`, gère `error` param (user denied).
    - `GET /api/auth/spotify/status` → `{ authenticated: boolean, user?: { id, display_name } }` (utilise `GET https://api.spotify.com/v1/me` avec token frais). Si 401 → tente refresh, sinon `authenticated:false`.
    - `POST /api/auth/spotify/logout` → supprime cookies, `{ ok: true }`.
    - `GET /api/me/liked?limit=50&offset=0` → utilise token frais (refresh si besoin), `GET https://api.spotify.com/v1/me/tracks?limit=50&offset=...&market=FR`, mappe via `mapSpotifyTrack` (réutilise logique existante), enrichit preview manquants via iTunes/Deezer seulement à la demande client (`/api/preview`), ne bloque pas. Retourne tableau Track filtré ou enrichis lazy (retourne tous, client appellera `/api/preview` si `preview_url` null). Pagination possible mais pour MVP fetch 1–2 pages (jusqu'à 100).
  - Token refresh : helper `getValidAccessToken(cookies)` qui lit `expiresAt`, si `< now + 60s` → `POST /api/token` avec `refresh_token`.
  - Preview manquant : depuis fin 2024 `preview_url` Spotify vaut souvent `null`. Pour Titres aimés on ne filtre pas côté serveur ; on retourne `preview_url` tel quel (peut être null — l'app cliente interprète). `GameContainer` existant rafraîchit déjà les previews Deezer expirés via `/api/preview`; on étend pour gérer `preview_url == null` → fetch `/api/preview?artist=&title=` et remplace `resolvedPreview`. Si `null` persiste → carte d'erreur « Extrait indisponible » et `Reroll`.
  - Pas de base de données ; état côté client en `localStorage` clé séparée pour le mode liked (`songspot-fr:liked:playedIds` ou suffixe) afin de ne pas mélanger les pools, mais réutilise `songspot-fr:prefs` pour `difficulty/era`.
  - Tous les textes FR.
- **Resources**: Single dev, quotas Spotify gratuits (limite 50/me/tracks par page).
- **Compatibilité**: Dégradation gracieuse sans OAuth (mode Liked désactivé). Mobile + desktop.
- **Timeline**: Une itération autopilot (spec → plan → ralph).
- **Sécurité**: State CSRF 16+ bytes, httpOnly cookies, validation `redirect_uri` strict, pas de log de tokens, timeout 5s sur fetch Spotify, SSRF hardening sur `next` URL déjà en place à conserver.

## Success Criteria

1. **Connexion Spotify** — Bouton « Connecter Spotify » visible dans le sélecteur de mode (ou header). Sans `SPOTIFY_CLIENT_ID`, bouton désactivé avec tooltip « Connexion Spotify non configurée ». Avec creds, clic → redirection Spotify authorize avec `scope=user-library-read`, `state` aléatoire, `redirect_uri` depuis `SPOTIFY_REDIRECT_URI` ou `NEXT_PUBLIC_BASE_URL`. Login → consent → callback → cookies posés → redirect accueil avec toast « Connecté à Spotify ».
2. **Callback robuste** — `state` mismatch → 400 + message FR. Spotify `error=access_denied` → redirect `/?spotify=denied` + toast FR « Connexion refusée ». `code` manquant → 400. Échange token en erreur (400/401) → log warn + redirect `/?spotify=error`. Jamais crasher.
3. **Statut & déconnexion** — `GET /api/auth/spotify/status` retourne `authenticated:false` sans cookies, `true` avec token valide (après refresh si expiré). UI affiche « Connecté en tant que <display_name> » et bouton « Déconnecter ». Déconnecter → `POST /logout` → cookies supprimés → UI repasse à Top France.
4. **Chargement Titres aimés** — Après connexion, mode « Titres aimés » devient sélectionnable. Au switch, l'app `fetch /api/me/liked` (limit 50, offset 0) puis éventuellement page suivante, map → Track[] (id,title,artist,album,cover,preview_url peut être null, popularity, release_date, era, source). Si 0 titre liké → affiche carte « Aucun titre aimé — aime des morceaux sur Spotify puis réessaie » + bouton retour Top France. Si <5 titres → warning mais jouable.
5. **Jeu sur Titres aimés** — `GameContainer` reçoit le catalogue liké (au lieu du catalogue Top). Mêmes paliers 0.1/0.5/2/8/15, même difficulté/ère, même autocomplete (suggère depuis le catalogue liké), même no-repeat via `playedIds` scoped par mode. Partage (`/api/catalog` inchangé) reste sur catalogue global ; partage liked n'est PAS requis (on peut désactiver Share quand en mode liked ou générer link avec warning).
6. **Preview manquant** — Si `track.preview_url == null`, GameContainer déclenche `fetch /api/preview?artist=&title=` (timeout 5s). Si trouvé → joue le preview iTunes/Deezer ; sinon affiche `AUDIO_ERROR_MESSAGE` « Extrait indisponible, nouveau morceau » et auto-reroll possible. Aucune erreur non gérée.
7. **Switch de mode** — Sélecteur « Mode » : 2 options Top France / Titres aimés (Titres aimés disabled si non connecté). Switch → `selectNewTrack()` immédiat dans le nouveau pool, `difficulty/era` conservés, `toast` « Mode : Top France » / « Mode : Titres aimés (N morceaux) ». `localStorage` persiste le mode (`songspot-fr:prefs.mode` ou `songspot-fr:mode`). Hydration sans mismatch (default Top).
8. **Sécurité & perfs** — Tokens jamais dans HTML/JS client (seulement via cookies httpOnly). Refresh auto <60s avant expiry. Fetch Spotify avec `AbortController` 5s. Test `spotifyAuth` unitaire : échange code → tokens, refresh, state generation/verify, cookie helpers. Lint/build/typecheck verts, tests ≥95% des nouveaux fichiers >70% coverage, build inclut 5 routes supplémentaires (≈+5kB).
9. **Build & deploy** — `npm run build` OK, `npm run lint` 0 erreur, `npx tsc --noEmit` 0 erreur, `npm test` tous verts (anciens 246 + nouveaux). `.env.example` documente `SPOTIFY_REDIRECT_URI` et `NEXT_PUBLIC_BASE_URL`.

## Existing Context

Projet Next.js 15 à `C:/Users/Raphael/Documents/CODE/Songspot-fr` — 15 tâches terminées, 2 passes validation APPROVE. Artefacts : `lib/spotify.ts` (client-credentials + Playlists), `lib/preview.ts` (iTunes/Deezer), `app/api/catalog/route.ts`, `hooks/useGameState.ts` (STAGES, filtres, no-repeat, difficulty/era), `components/game/GameContainer.tsx` (jeu principal), `lib/storage.ts` unifié (`songspot-fr:prefs` + `playedIds`), `.env.example` (CLIENT_ID/SECRET).

À réutiliser : `mapSpotifyTrack`, `normalizeReleaseDate`, `deriveEra`, `TrackSchema`, `fetchWithTimeout`, `fetchBestPreview`, `STAGES`, `STORAGE_KEYS`.

## Assumptions

- `preview_url` Spotify reste globalement `null` → la stratégie preview lazy via `/api/preview` (iTunes → Deezer) est la voie primaire pour le mode liked, pas le `preview_url` natif.
- Un utilisateur typique a 20–500 titres aimés ; paginer 2 pages ×50 = 100 suffit MVP (au-delà, on affichera N= total mais on ne chargera que 100 premiers pour perfs).
- `SPOTIFY_REDIRECT_URI` non défini → dériver de `NEXT_PUBLIC_BASE_URL || http://localhost:3000` + `/api/auth/spotify/callback`. On valide que `redirect_uri` enregistré côté dashboard Spotify doit matcher exactement.
- La route `/api/preview` existante suffit pour fallback individuel ; pas besoin de batch enrichment serveur pour MVP.
- Partage en mode liked peu pertinent (idiosyncratique) → on le garde actif mais le link pointe sur Top global (documenté) ou on affiche « Partage indisponible en mode Titres aimés ».

## Open Questions

- Faut-il un daily challenge liked ? Deferred V2.
- Faut-il stocker `liked:playedIds` séparément ou partager ? Choix : séparé (évite de marquer un liked comme joué dans Top).
- Doit-on chiffrer les cookies refresh_token ? Pour MVP httpOnly Secure Lax suffit ; chiffrage AES peut être V2 si besoin.
