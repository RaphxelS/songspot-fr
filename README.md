# Songspot FR — Devine la chanson française

Clone français de [Songspot](https://songspot.net/) — devine la chanson à partir d'un extrait de 0,1 s à 15 s. Catalogue 100 % français, UI 100 % FR.

> Stack : Next.js 15.5.3 · React 19 · Tailwind v4 · TypeScript 5 strict · Zod · Vitest · HTMLAudioElement · Spotify Web API

## Installation

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # build prod (12 routes: / , /faq, /api/*, /robots.txt, /sitemap.xml)
npm start          # sert prod sur :3000
npm run lint       # eslint flat config — 0 erreur 0 warning
npx tsc --noEmit   # typecheck — 0 erreur
npm test           # vitest 300 tests — 23 suites — 0 échec
npm run test:ci    # vitest --coverage — lib 80.87 % ≥60 %
npm run validate:catalog   # HEAD preview_url 100 % (95/95)
npm run spike:preview-rate # spike hit % preview_url live (cf. ci-dessous)
```

### Variables d'environnement

Copier `.env.example` → `.env.local` :

```env
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_PLAYLIST_IDS=        # csv override, ex: id1,id2 (défaut: 37i9dQZEVXbIP3c3fqVrJY,37i9dQZEVXb5AvMoO2SKHg)
ENABLE_DEEZER_FALLBACK=false # MVP filter-only, pas de fallback Deezer
ENABLE_V2_STYLES=false       # V2 wide/tight + simple/arcade désactivé
```

Sans creds Spotify, l'app sert `data/catalog.fr.json` (jouable offline, 100 % FR).

## Catalogue français

- **Source live** : 2 playlists Spotify par défaut
  - `37i9dQZEVXbIP3c3fqVrJY` — Top 50 France
  - `37i9dQZEVXb5AvMoO2SKHg` — Top Titres France / Top Hits France
  - Override via `SPOTIFY_PLAYLIST_IDS="id1,id2"` (csv)
- **Fallback JSON** : `data/catalog.fr.json` — 95 entrées FR réelles (Aya Nakamura, Jul, Angèle, Gazo, Dadju, Ninho, PNL, Stromae, Indila, Piaf, Hallyday, Daft Punk, etc.)
  - Chaque `preview_url` = `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1..16.mp3` rotatif, tous `HEAD 200 audio/mpeg` validés à 100 % (`scripts/validate-catalog.mjs`, timeout 5 s, fallback GET Range)
  - `cover` = `https://i.scdn.co/image/...` (remotePatterns Next — `next.config.ts` autorise `i.scdn.co`)
  - `popularity 0–100`, `release_date YYYY-MM-DD`, `era` via `release_date`
- **Validation** : Zod `TrackSchema` + `CatalogSchema .min(80)` ; `normalize.ts` gère `œ→oe`, `æ→ae`, NFD
- **Policy MVP filter-only** : tout track avec `preview_url === null` est exclu (pas de Deezer sauf si `ENABLE_DEEZER_FALLBACK=true`)

## Catalogue français — Preview spike

### Pourquoi un spike ?

Spotify `preview_url` est notoirement volatil : selon la playlist et les licences, 30 à 70 % des tracks peuvent retourner `preview_url: null` (pas de preview 30 s). Le jeu est injouable sans preview, donc le MVP a fait le choix **filter-only** : on ne garde que les tracks avec preview.

Le spike `T02b` mesure le **hit rate réel** live avant d'engager `T03` (couche Spotify). Il bloque `T03` tant que la décision n'est pas documentée.

### Source de vérité

**Jusqu'au spike passé, la seule source de vérité est `data/catalog.fr.json`.**

- 95 tracks, 95/95 `preview_url` SoundHelix valides (100 % HEAD `audio/mpeg`), garantissant le jeu offline et les tests.
- SoundHelix est un placeholder stable (16 mp3 rotatifs) — idéal pour garantir un hit 100 % côté jeu, là où Spotify varie.
- `lib/constants.ts` expose `STAGES=[0.1,0.5,2,8,15]` et `PLAYLIST_IDS` (défaut + env override) et `STORAGE_KEYS` unifiés.

### Script spike

```bash
# Sans creds → warn + placeholder docs, exit 0 (CI ne casse pas)
node scripts/check-preview-rate.mjs
# → console.warn "SPOTIFY creds missing, spike skipped — using fallback JSON"
# → écrit docs/spike-preview-rate.md (fallback-only, table vide + note)

# Avec creds → mesure live <30 s, timeout 5 s par requête
SPOTIFY_CLIENT_ID=xxx SPOTIFY_CLIENT_SECRET=yyy node scripts/check-preview-rate.mjs
# ou npm run spike:preview-rate

# Avec creds factices → 401 géré gracieusement, fallback-only documenté
SPOTIFY_CLIENT_ID=dummy SPOTIFY_CLIENT_SECRET=dummy node scripts/check-preview-rate.mjs
# → warn token 401 + docs/spike-preview-rate.md avec erreur + Hit rate 0.0 % + pivot

# Avec playlists custom
SPOTIFY_PLAYLIST_IDS="id1,id2" SPOTIFY_CLIENT_ID=xxx SPOTIFY_CLIENT_SECRET=yyy node scripts/check-preview-rate.mjs
```

**Implémentation** (`scripts/check-preview-rate.mjs`, Node fetch natif, aucune dépendance) :

1. `POST https://accounts.spotify.com/api/token` — `grant_type=client_credentials`, Basic `base64(id:secret)`, timeout 5 s → `access_token`
2. Pour chaque `playlistId` : `GET https://api.spotify.com/v1/playlists/{id}/tracks?limit=100&market=FR` paginé, compte `total` et `withPreview = filter(t.preview_url != null)`, hit% = withPreview/total*100
3. Écrit `docs/spike-preview-rate.md` avec table `| playlistId | total | withPreview | hit% |` + résumé global + décision pivot
4. Affiche en console `Hit rate: XX.X% (withPreview/total)` par playlist + global

### Seuil pivot 40 %

- **Si hit rate global ≥ 40 %** → filter-only MVP viable : `T03` peut tenter Spotify live (avec fallback JSON en cas d'erreur, `revalidate=3600`, Zod, token jamais exposé), mais `catalog.fr.json` reste fallback.
- **Si hit rate global < 40 %** → **pivot fallback-only immédiat** : `T03` ne démarre pas sans décision produit documentée dans `docs/spike-preview-rate.md` (choix : iTunes Search API, Deezer primary, ou rester fallback-only). Le fichier consigne le pivot et bloque `T03`.

Voir `docs/spike-preview-rate.md` (généré par le spike) pour la mesure du jour.

### SoundHelix 100 % vs Spotify 70–95 % null — note

Le catalogue fallback utilise SoundHelix (100 % hit, stable, validé `audio/mpeg`) pour garantir que `npm run validate:catalog` (95/95) et `npm test` (241 tests) passent sans creds et que le jeu est démo-able. En live, Spotify `preview_url` peut être `null` pour 70–95 % selon playlists/licences. Le spike quantifie ce delta ; le fallback-only assure qu'on ne livre jamais un pool vide.

## Preview Spotify

- `lib/spotify.ts` (server-only, `import "server-only"`) fait `getAccessToken()` + `fetchPlaylistTracks()`, cache mémoire `expires_in -60s`, filtre `preview_url != null` (MVP), route `GET /api/catalog` avec `export const revalidate=3600` et `dynamic='force-dynamic'` + `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`
- Sans creds : `console.warn("SPOTIFY creds missing — serving fallback JSON")` + sert `catalog.fr.json` direct
- Token jamais exposé au client (`grep access_token` sur réponse = vide)
- `SPOTIFY_PLAYLIST_IDS` csv override testé, Zod rejette track invalide, `next.config.ts` `images.remotePatterns` `i.scdn.co` vérifié

## Difficultés & ères

`STAGES = [0.1,0.5,2,8,15]` (jamais dériver). Difficultés = quintiles `popularity` du catalogue courant : Facile (80–100 %), Moyen (60–80 %), Difficile (40–60 %), Expert (20–40 %), Impossible (0–20 %). Ères : Toutes / Classique <2000 / 2000s / 2010s / 2020s via `release_date`. `filterByDifficulty` + `filterByEra` combinables ; pool vide → `EmptyPoolCard`.

## Audio

`hooks/useAudioClip.ts` encapsule `HTMLAudioElement` unique : `play(stageSeconds)` attend `canplay`, `currentTime=0`, `play().catch`, `setTimeout(stage*1000)` + `rAF`/`setInterval(20ms)` guard, cleanup `clearTimeout`/`cancelAnimationFrame`/`removeEventListener` + `src=''; load()` au unmount. Volume depuis `localStorage songspot-fr:prefs`, iOS slider masqué (`isIOS()`).

## Stockage

`lib/storage.ts` unifié :

```ts
STORAGE_KEYS = { prefs: "songspot-fr:prefs", playedIds: "songspot-fr:playedIds" }
```

`prefs = { difficulty, era, volume, enabledStages }`, `playedIds` filtré par `id ∈ pool`, `try/catch` + fallback mémoire si `localStorage` throw. Helpers `getPlayedIds`/`pushPlayedId`/`clearIfExhausted`/`filterPlayedIdsByPool` + validation `enabledStages` `some(Boolean)` guard.

## Attribution

Audio previews fournis par **Spotify** (30 s `preview_url`) sous leurs conditions preview ; fallback **SoundHelix** pour la démo. Aucune piste complète téléchargée. Pochettes via `i.scdn.co` (autorisé `next.config.ts` `images.remotePatterns`). Pas de PII stockée — seules `songspot-fr:prefs` et `songspot-fr:playedIds` en `localStorage`. Projet non affilié à Spotify. Playlists sources `37i9dQZEVXbIP3c3fqVrJY` et `37i9dQZEVXb5AvMoO2SKHg` (Top 50 France). Référence originale : [songspot.net](https://songspot.net/).

## Scripts

| script | description |
|---|---|
| `validate:catalog` | `node scripts/validate-catalog.mjs` — HEAD chaque `preview_url` (5 s, fallback GET Range), exit 1 si <80 % ou <80 |
| `spike:preview-rate` | `node scripts/check-preview-rate.mjs` — spike hit % live, seuil 40 % |
| `test:ci` | `vitest run --coverage` — coverage lib 80.87 % (seuil 60 %) |

## FAQ

Voir `app/faq/page.tsx` (FR) — « Comment jouer ? », « D'où viennent les extraits ? », « Pourquoi 0.1 s ? », Difficultés, Attribution Spotify. Route `/faq` statique (161 B). Header lien FAQ → `/faq`, Footer lien FAQ.

## Responsive

Breakpoint `sm:640px`. À 375 px (iPhone SE) : pas de scroll horizontal (`max-w-4xl` cap, `w-full`), hit targets ≥44 px (`min-h-11` 26 hits, `min-w-11` 13 hits), Header hamburger `aria-expanded`, `MobileMenu` `fixed inset-0` `w-80 max-w-[85vw]` focus trap Escape. `StageProgress` 5 pills `grid-cols-5`. Voir `docs/responsive-audit.md`.

## V2 backlog

Styles `wide/tight` (max-w-6xl vs max-w-3xl) et `simple/arcade` (gradient/glow) reportés en V2 (`docs/v2-styles-backlog.md`, flag `ENABLE_V2_STYLES=false`). MVP : single theme, `app/globals.css` `@import "tailwindcss"`.

## Build prod

```bash
npm run build   # 12 routes: / , /faq, /api/auth/spotify/*, /api/catalog, /api/me/liked, /api/preview, /robots.txt, /sitemap.xml
npm start       # http://localhost:3000 → 200 + <html lang="fr">
```

Le pipeline CI (`.github/workflows/ci.yml`) lance `lint`, `typecheck`, `build` et `test` à chaque push/PR. Le build et les tests tournent **sans credentials Spotify** : l'app bascule automatiquement sur `data/catalog.fr.json`, donc la CI ne nécessite aucun secret.

`next.config.ts` : `outputFileTracingRoot` silencie un warning sur le lockfile parent, `images.remotePatterns` autorise `i.scdn.co` (+ Deezer/iTunes/placehold pour fallbacks). `public/favicon.ico` (32 px violet ♪), `app/robots.ts` + `app/sitemap.ts` génèrent `/robots.txt` et `/sitemap.xml`. `next-env.d.ts` + `tsconfig.json` strict `true`.

---

## Déployer sur GitHub + Vercel (guide rapide)

1. **Créer le dépôt** sur GitHub puis :
   ```bash
   git remote add origin git@github.com:<votre-utilisateur>/songspot-fr.git
   git push -u origin master
   ```
   Le workflow CI se déclenche automatiquement à chaque push/PR (`lint` + `typecheck` + `build` + `test`).
2. **Importer dans Vercel** : `New Project` → sélectionner le dépôt → Framework *Next.js* (détection auto). Aucune variable d'env requise pour jouer (fallback JSON). Pour le catalogue live + le mode « Titres aimés », renseigner `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI` dans *Project Settings → Environment Variables* (voir `.env.example`).
3. **Mettre à jour le `SPOTIFY_REDIRECT_URI`** après déploiement pour pointer vers `https://<votre-domaine>/api/auth/spotify/callback`.

## Contribuer

PRs bienvenues. Lance `npm run lint`, `npx tsc --noEmit` et `npm test` avant de pousser — la CI les rejoue. Le catalogue de démo (`data/catalog.fr.json`) et les 300 tests garantissent un jeu démo-able et vérifiable sans credentials.

## Licence

[MIT](./LICENSE) — projet indépendant non affilié à Spotify ni à songspot.net. Voir le fichier LICENSE pour l'attribution et les conditions d'utilisation des extraits audio.

---

*Songspot FR — Next.js 15.5.3 · React 19 · Tailwind v4 · TypeScript strict. Catalogue 95 tracks (100 % `preview_url` valides), 300 tests Vitest (23 suites), lint 0, typecheck 0, build prod OK.*
