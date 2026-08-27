# Plan d'implémentation — Songspot FR (Consensus v2)

> **Source:** `.omh/specs/songspot-fr-spec.md` v1.0 (confirmed 2026-08-27)  
> **Cible:** `C:/Users/Raphael/Documents/CODE/Songspot-fr` — greenfield  
> **Stack:** Next.js 15 App Router · React 19 · Tailwind CSS v4 · TypeScript 5 · HTMLAudioElement · Spotify Web API (client-credentials)  
> **Langue:** 100% FR — `<html lang="fr">`  
> **Node:** 22 LTS (≥20)  
> **Généré:** 2026-08-27 — rôle `planner` — **Consensus v2 après Round 2**

## Consensus

| Round | Planner | Architect | Critic | Verdict |
|-------|---------|-----------|--------|---------|
| 1 | v1 initial (427L, 14 tâches) | REQUEST_CHANGES (A1-A8) | REQUEST_CHANGES (C1-C8, 3 blocking) | Pas de consensus — 8 arch + 8 critic concerns |
| 2 | v2 révisé (ce fichier) — 15 tâches (T02b spike ajouté), fixes A1-A8 + C1-C8 | **APPROVE** (après patch — voir ci-dessous) | **APPROVE avec réserves** | **Consensus atteint** |

**Changements Round 2 (vs v1):**
- **A1** Server `page.tsx` → découpé en `app/page.tsx` (Server) + `components/game/GameContainer.tsx` (Client) + `<Suspense>` pour `useSearchParams`; ajout `loading.tsx`/`error.tsx`/`ErrorBoundary`
- **A2/A7/C7/C8** Unifié `lib/storage.ts` (supprime `hooks/usePersistedState` doublon), pattern `isHydrated` + skeleton, validation `enabledStages`, `playedIds` per-pool, try/catch `localStorage` + fallback mémoire, Zod pour `Track` + allowlist `?track=`
- **A3/C3** Audio: `canplay`/`loadedmetadata` avant `currentTime`, `play().catch` pour `NotAllowedError/AbortError`, `setTimeout` primary + `rAF`/`setInterval(20ms)` guard (plus de `timeupdate` 250ms), cleanup listeners, `audio.src='';load()`, volume depuis `storage`, iOS volume masqué/désactivé
- **A4/C1** `preview_url` verrouillé MVP **filter-only** (`ENABLE_DEEZER_FALLBACK=false` par défaut), `catalog.fr.json` doit être 100% vérifié `preview_url` via script `scripts/validate-catalog.mjs`, ajout **T02b Spike** `scripts/check-preview-rate.mjs`
- **A5** `loading.tsx`/`error.tsx`/`ErrorBoundary` promus à T01, checklist a11y complète (aria-live, aria-expanded, focus trap, aria-label, prefers-reduced-motion, skip-link)
- **A6/C8** `export const revalidate=3600` + `dynamic='force-dynamic'` sur route, **Tailwind v4** via `@import "tailwindcss"` (pas de `tailwind.config.ts`), `next.config.ts` `images.remotePatterns` à T01, `next/font/google`, Node 22 LTS, `STORAGE_KEYS` unifiés
- **C2** MVP scope: **un seul layout / un seul thème** — `wide/tight` + `simple/arcade` déplacés en **V2 backlog** (flag `ENABLE_V2_STYLES=false`); T11 réduit à responsive de base
- **C4/C5/C6** Dépendances strictifiées (`T06` dépend `T04+T05` strict), ownership `globals.css` → T07 seule, tests co-localisés par tâche (chaque lib shippe son `*.test.ts`), T13 devient **Coverage Gate** léger, T14 gate vertical
- **C7** 8 edge cases ajoutés aux acceptances T06/T10 (empty pool, all-disabled, pool exhausted, corrupt storage, invalid share, preview 404, hydration, normalize ligatures `œ/æ`)

> **Après ces 5 Correctifs obligatoires (A1-A4 + C1) + C2, architect et critic approuvent.** Les points C4-C8 restants sont notés comme dette technique trackée.

---

## 1. Architecture Overview

### 1.1 Principes
- **No DB**, `localStorage` pour la session (historique, préférences, pool sans répétition). SSR minimal, 90% client mais **page serveur** pour le catalogue.
- **Server-only Spotify** : `SPOTIFY_CLIENT_ID/SECRET` jamais exposés au client. Route API fait le `client-credentials` flow + cache. `import "server-only"` obligatoire.
- **Fallback offline** : `data/catalog.fr.json` commité (~100 titres) — l'app est jouable sans credentials. **Seule source de vérité** jusqu'au spike T02b passé. Chaque entrée vérifiée `preview_url` valide.
- **Audio précis** : `HTMLAudioElement` unique, clip fenêtré par `setTimeout(stage*1000)` + `requestAnimationFrame`/`setInterval(20ms)` guard, départ à `0s` dans le `preview_url` (30s Spotify). `canplay` attendu avant `play()`.
- **Déterministe & testable** : chaque module (`catalog`, `difficulty`, `storage`, `share`, `normalize`) pur + test unitaire ; UI mince.
- **Hydration safe** : `isHydrated` flag, lecture `localStorage` uniquement en `useEffect`, skeleton avant hydratation, `suppressHydrationWarning` si besoin.

### 1.2 Arborescence cible (v2 corrigée)

```
Songspot-fr/
├── app/
│   ├── layout.tsx              # <html lang="fr">, metadata FR, next/font/google (Geist)
│   ├── page.tsx                # SERVER COMPONENT: fetch catalog, <Suspense><GameContainer /></Suspense>
│   ├── loading.tsx             # skeleton (promu T01)
│   ├── error.tsx               # ErrorBoundary client (promu T01)
│   ├── faq/
│   │   └── page.tsx            # FAQ FR (static)
│   ├── api/
│   │   └── catalog/
│   │       └── route.ts        # GET /api/catalog — Spotify live ou fallback JSON, export const revalidate=3600
│   └── globals.css             # @import "tailwindcss" (Tailwind v4) — unique owner: T07
├── components/
│   ├── layout/
│   │   ├── Header.tsx          # logo, hamburger ≤640px, nav FAQ (aria-expanded, Escape close)
│   │   ├── Footer.tsx
│   │   └── MobileMenu.tsx      # focus trap
│   ├── game/
│   │   ├── GameContainer.tsx   # CLIENT island: useGameState + useAudioClip + Suspense for ?track=
│   │   ├── AudioPlayer.tsx     # play/pause, volume (masqué iOS), barre, stages pills
│   │   ├── StageProgress.tsx   # 5 paliers [0.1,0.5,2,8,15] + toggle persistant, aria-live
│   │   ├── GuessInput.tsx      # input + autocomplete accent-insensitive + œ/æ
│   │   ├── GuessHistory.tsx    # pills des essais
│   │   ├── EmptyPoolCard.tsx   # edge: empty pool fallback (NEW)
│   │   ├── DifficultySelector.tsx # 5 paliers quintiles popularité
│   │   ├── EraFilter.tsx       # Toutes / <2000 / 2000s / 2010s / 2020s
│   │   ├── RerollButton.tsx
│   │   ├── ShareButton.tsx     # défi ami ?track=&difficulty= (stage omis MVP)
│   │   └── RevealCard.tsx      # succès/échec — cover, titre, artiste, album, focus mgmt
│   └── ui/
│       └── ErrorBoundary.tsx   # class component (NEW, T01)
├── lib/
│   ├── spotify.ts              # getAccessToken(), fetchPlaylistTracks(), server-only, warn si creds manquants
│   ├── catalog.ts              # type Track, merge/dedup, filterByDifficulty/Era, pickRandom
│   ├── difficulty.ts           # quintiles popularity → 5 tiers FR
│   ├── audio.ts                # useAudioClip() hook — clip précis, volume, pause, rAF
│   ├── storage.ts              # typed localStorage UNIFIÉ (prefs, playedIds, enabledStages) + try/catch memory fallback
│   ├── share.ts                # build/parse ?track=&difficulty= (sans stage MVP), allowlist
│   ├── normalize.ts            # accent-insensitive NFD + œ→oe æ→ae
│   ├── validation.ts           # Zod schemas Track[] (NEW)
│   └── constants.ts            # STAGES=[0.1,0.5,2,8,15], PLAYLISTS, STORAGE_KEYS (unifiés)
├── hooks/
│   └── useGameState.ts         # état partie (stageIndex, guesses, status, track, isHydrated)
├── data/
│   └── catalog.fr.json         # snapshot ~100 titres FR (fallback) — TOUS avec preview_url vérifié
├── scripts/
│   ├── validate-catalog.mjs    # NEW: vérifie preview_url joignables, couvre HEAD
│   └── check-preview-rate.mjs  # NEW T02b: spike hit rate % preview_url live
├── tests/
│   ├── catalog.test.ts
│   ├── difficulty.test.ts      # + test sur vrai catalog.fr.json skew
│   ├── audio.test.ts           # mock rAF/setInterval, smoke ±50ms
│   ├── storage.test.ts         # + corrupt JSON test
│   ├── share.test.ts
│   ├── normalize.test.ts       # + œ/æ
│   └── e2e/
│       └── share.spec.ts       # Playwright round-trip (NEW)
├── public/
│   └── favicon.ico
├── .env.example
├── next.config.ts              # images.remotePatterns i.scdn.co — posé à T01
├── tsconfig.json
└── package.json
```

**STORAGE_KEYS unifiés (C8 fix):**
```ts
const STORAGE_KEYS = {
  prefs: "songspot-fr:prefs", // { difficulty, era, volume, enabledStages }
  playedIds: "songspot-fr:playedIds",
} as const;
// PLUS de clé séparée "songspot-fr:enabledStages" — tout dans prefs
```

### 1.3 Routes Next.js (v2)

| Route | Type | Description |
|-------|------|-------------|
| `/` | **Server Page** | `page.tsx` fetche `catalog` (direct import ou `fetch('/api/catalog', {next:{revalidate:3600}})`), rend `<Suspense><GameContainer catalog={catalog} /></Suspense>` |
| `/faq` | Static Page | FAQ 100% FR |
| `/api/catalog` | Route Handler (GET) | Retourne `Track[]` — tente Spotify live, sinon `data/catalog.fr.json`. `export const revalidate=3600; export const dynamic='force-dynamic'` + `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400` |

`GameContainer` est **Client** (`"use client"`) et contient toute la logique `useGameState`/`useAudioClip`/`useSearchParams` (dans Suspense).

### 1.4 Modèle de données

```ts
// lib/catalog.ts + lib/validation.ts (Zod)
type Track = {
  id: string;              // spotify:track:xxx
  title: string;
  artist: string;
  album: string;
  cover: string;           // 300x300+ url
  preview_url: string;     // mp3 30s — garanti https:// si présent, sinon track exclu (MVP)
  popularity: number;      // 0-100 Spotify
  release_date: string;    // YYYY-MM-DD
  era: "classic"|"2000s"|"2010s"|"2020s";
  source: "spotify";
};
```

`STAGES = [0.1, 0.5, 2, 8, 15] as const` — ne jamais dériver, test d'égalité stricte.

### 1.5 Flux de données (v2)

```
[Spotify Playlists 37i9dQZEVXbIP3c3fqVrJY + 37i9dQZEVXb5AvMoO2SKHg]  (ou SPOTIFY_PLAYLIST_IDS env)
        │  client-credentials (server, lib/spotify.ts, warn si missing)
        ▼
app/api/catalog/route.ts ──revalidate 3600──► data/catalog.fr.json (fallback, seul source vérité avant spike)
        │ JSON Track[] (Zod validé)
        ▼
app/page.tsx (Server) ──props──► components/game/GameContainer.tsx (Client, Suspense)
        │                          │ useGameState (isHydrated, empty-pool guard)
        ▼                          ▼
HTMLAudioElement (lib/audio.ts rAF) ◄──► lib/storage.ts (try/catch + memory fallback)
```

### 1.6 Gestion d'état (v2 corrigée)

- `useGameState` est la source unique : `{ track, stageIndex, enabledStages: boolean[5], guesses[], status: 'playing'|'won'|'lost', revealed, isHydrated, isLoading }`.
- Préférences persistées : `songspot-fr:prefs = { difficulty, era, volume, enabledStages }` (unique clé). `isHydrated=false` au SSR, `useEffect` lit `localStorage` → `isHydrated=true` + skeleton.
- Validation `enabledStages`: `if (!enabledStages.some(Boolean)) enabledStages=[true,false,false,false,false]` (force au moins 0.1s). Test.
- Session no-repeat : `songspot-fr:playedIds = string[]` (FIFO, `playedIds.filter(id ∈ currentPool)` à chaque changement de filtre, reset si pool épuisé).
- Défi ami : URL query `?track=<id>&difficulty=<tier>` (sans `stage` en MVP — C11). Parsée dans `GameContainer` via `useSearchParams` sous `Suspense`; si `track` existe et `id ∈ catalog` (allowlist) → force ce `track`, bannière « Défi : devine ce morceau ! (difficulté X) », sinon fallback random + toast « Défi introuvable ».

---

## 2. Graphe de dépendances (v2)

```
T01 bootstrap
 ├─► T02 catalogue statique ──► T02b spike ─┬─► T03 spotify live
 │                           │               ├─► T04 difficulté/ères (non-bloquant pour T06)
 │                           │               └─► T13 tests (partiel, co-localisé)
 ├─► T05 audio engine (rAF) ──────────► T06 game state (strict: T04+T05) ─┬─► T08 guess+playback (T08 ex T08+T09 mergé)
 │                           ▲                                            ├─► T10 reroll + partage (sans stage)
 └─► T07 shell UI (unique owner globals.css) ─┘                             └─► (tous → T14 build vertical)
      ├─► T08 (via GameContainer)
      └─► T11 responsive (base) + T12 FAQ (peuvent être parallèles après T07, mais sérialisés si touchent globals.css)
T13 coverage gate ──► T14 build
```

**Ordre d'exécution recommandé :** T01 → T02 → T02b (30min spike, bloquant T03) → T03/T04/T05/T07 en parallèle → T06 (strict T04+T05) → T08/T10 → T11/T12 → T13 → T14.  
**Note C4:** Chaque tâche lib (T02,T04,T05,T06,T10) shippe son propre `*.test.ts` dans la même PR ; T13 reste un gate léger (coverage ≥60%, pas monolithe). T07 est unique owner de `globals.css` pour éviter race T08↔T11.

---

## 3. Tâches atomiques (v2 — 15 tâches)

### T01 — Bootstrap Next.js 15 + Tailwind v4 + TS + structure + cross-cutting
- **Dépendances:** aucune
- **Complexité:** M (2–3h) — inclut ErrorBoundary + a11y baseline
- **Description:** Initialiser greenfield. `npx create-next-app@latest . --ts --app --eslint --import-alias "@/*"` (Next 15). Vérifier `react@19`, `next@15`. **Tailwind v4:** `npm install tailwindcss@4 @tailwindcss/postcss@4`, config via `app/globals.css` `@import "tailwindcss"` (PAS de `tailwind.config.ts` — R09). Créer `app/layout.tsx` avec `<html lang="fr">`, `metadata` FR (title/description FR), `next/font/google` (Geist). Créer `next.config.ts` avec `images.remotePatterns: [{hostname:'i.scdn.co'}]` (C6). Créer arborescence vide (`components/`, `lib/`, `hooks/`, `data/`, `scripts/`, `tests/`). Créer `app/loading.tsx` skeleton + `app/error.tsx` + `components/ui/ErrorBoundary.tsx`. Ajouter `.env.example` (`SPOTIFY_CLIENT_ID=`, `SPOTIFY_CLIENT_SECRET=`, `SPOTIFY_PLAYLIST_IDS=`, `ENABLE_DEEZER_FALLBACK=false`, `ENABLE_V2_STYLES=false`), `.gitignore` (`.env.local`), `tsconfig` strict. Installer `vitest`+`jsdom`+`@testing-library/react` de base.
- **Critères d'acceptation (testables):**
  - [ ] `npm run dev` démarre sans erreur sur port 3000 ; `curl http://localhost:3000` retourne 200 et contient `<html lang="fr">`.
  - [ ] `npm run build` passe (même si page vide) — avec `@import "tailwindcss"` et sans `tailwind.config.ts`.
  - [ ] `npx tsc --noEmit` passe sans erreur.
  - [ ] `.env.example` contient les 5 vars commentées (dont `ENABLE_DEEZER_FALLBACK`, `ENABLE_V2_STYLES`).
  - [ ] `app/layout.tsx` exporte `metadata.title` en français et `html lang="fr"` vérifiable via `grep -r 'lang="fr"' app/`.
  - [ ] `app/loading.tsx` et `app/error.tsx` existent ; `ErrorBoundary` rend fallback sans crasher toute l'app.
  - [ ] `next.config.ts` autorise `https://i.scdn.co/**` (vérifier `cat next.config.ts | grep i.scdn.co`).
  - [ ] `next/font/google` import présent (pas `next/font` nu).

---

### T02 — Modèle Track + catalogue statique `data/catalog.fr.json` + validation
- **Dépendances:** T01
- **Complexité:** M (3–4h, inclut curation manuelle + script validation)
- **Description:** Définir `lib/catalog.ts` (`Track` type, `normalize.ts`), `lib/constants.ts` (`STAGES`, `PLAYLIST_IDS` par défaut `["37i9dQZEVXbIP3c3fqVrJY","37i9dQZEVXb5AvMoO2SKHg"]` + override `SPOTIFY_PLAYLIST_IDS` env, `STORAGE_KEYS` unifiés), `lib/validation.ts` (Zod schema `Track`). Créer `data/catalog.fr.json` avec ≥80 entrées réelles FR (Aya Nakamura, Jul, Angèle, Gazo, Dadju, etc.) — champs obligatoires `title/artist/album/cover/preview_url/popularity/release_date`. **Policy MVP filter-only:** tout track avec `preview_url` null/absent est **exclu** (pas de Deezer). Créer `scripts/validate-catalog.mjs` : pour chaque track `HEAD preview_url` → 200 + `content-type: audio/*` (timeout 5s), rapporte `valid/total` et échoue si <80% valides ou si `length<80`. Gérer `normalize.ts` avec `NFD` + map `œ→oe, Œ→OE, æ→ae, Æ→AE`.
- **Critères d'acceptation:**
  - [ ] `data/catalog.fr.json` existe, `jq length` ≥ 80.
  - [ ] Test `tests/catalog.test.ts` : `expect(catalog.length).toBeGreaterThanOrEqual(50)` et `new Set(catalog.map(t=>t.id)).size === catalog.length` (pas de doublons) — mais **build exige ≥80** via script.
  - [ ] `node scripts/validate-catalog.mjs` passe : `valid/total ≥ 0.8` et `total ≥80`, chaque `preview_url` commence par `https://`.
  - [ ] `lib/normalize.ts` exporte `normalize(str)` qui passe `normalize("Àngèle") === "angele"`, `normalize("Cœur") === "coeur"`, `normalize("Œuvre") === "oeuvre"`, `normalize("Été") === "ete"`.
  - [ ] `lib/validation.ts` Zod `TrackSchema.safeParse` valide `catalog.fr.json` sans erreur.
  - [ ] Import `import catalog from "@/data/catalog.fr.json"` compile sans erreur TS.
  - [ ] Chaque test est co-localisé dans cette PR (pas reporté à T13).

---

### T02b — Spike taux de `preview_url` live (BLOQUANT T03)
- **Dépendances:** T02 (catalogue statique prêt)
- **Complexité:** S (30min bloquant)
- **Description:** Créer `scripts/check-preview-rate.mjs` (Node 22, `fetch` natif). Avec `SPOTIFY_CLIENT_ID/SECRET` (si manquants → skip avec `console.warn` et documente fallback-only). Spike : `getAccessToken()` → `fetchPlaylistTracks` pour les 2 playlists par défaut (ou `SPOTIFY_PLAYLIST_IDS`), compte `total` et `withPreview = tracks.filter(t=>t.preview_url).length`, affiche `Hit rate: XX% (withPreview/total)`. Si hit rate <40%, **pivot immédiat** : consigner dans `docs/spike-preview-rate.md` (choix: iTunes Search API, Deezer primary, ou reste fallback-only) et bloquer T03 jusqu'à décision produit. Si ≥40%, continuer filter-only MVP. Le fallback JSON reste **seule source vérité** jusqu'au spike passé.
- **Critères d'acceptation:**
  - [ ] `node scripts/check-preview-rate.mjs` exécutable, affiche `Hit rate: NN%` sans crash même sans creds (alors `warn: SPOTIFY creds missing, spike skipped — using fallback JSON`).
  - [ ] Avec creds valides, le script termine <30s et produit `docs/spike-preview-rate.md` avec table `playlistId | total | withPreview | hit%`.
  - [ ] Si hit rate <40%, un fichier `docs/spike-preview-rate.md` est commité et T03 ne démarre pas sans décision documentée (check manuel).
  - [ ] Documentation dans `README.md` section « Preview spike » expliquant le pivot.

---

### T03 — Couche Spotify (client-credentials) + `GET /api/catalog`
- **Dépendances:** T02, T02b (spike passé)
- **Complexité:** M (4–5h)
- **Description:** Implémenter `lib/spotify.ts` **server-only** (`import "server-only"`). `getAccessToken()` : `POST https://accounts.spotify.com/api/token` avec `grant_type=client_credentials` (Basic auth). Cache token en mémoire jusqu'à `expires_in - 60s` (per-lambda, documenté — pas partagé). `fetchPlaylistTracks(playlistId)` : `GET /playlists/{id}/tracks` paginé, map vers `Track` via Zod, filtre `preview_url != null` (MVP filter-only, **pas de Deezer** sauf si `ENABLE_DEEZER_FALLBACK=true` et alors appel Deezer côté serveur uniquement avec flag). Route `app/api/catalog/route.ts` : `export const revalidate=3600; export const dynamic='force-dynamic'` ; si env manquant → `console.warn("SPOTIFY creds missing — serving fallback JSON")` + sert `catalog.fr.json` direct ; sinon tente Spotify, en cas d'erreur log + fallback JSON. Zod valide chaque Track. Header `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`. Token jamais exposé.
- **Critères d'acceptation:**
  - [ ] Sans `.env` (ou creds vides), `GET /api/catalog` retourne 200 avec `Content-Type: application/json` et `length ≥ 80` identique à `catalog.fr.json` (+ `warn` en logs serveur).
  - [ ] Avec creds valides (test manuel), `GET /api/catalog` retourne ≥80 tracks dont `popularity` est entier 0–100 et `preview_url` non null pour ≥70% si spike ≥40% sinon fallback.
  - [ ] `lib/spotify.ts` n'est jamais importé côté client — `grep -r "from.*spotify" app/ components/ hooks/` ne retourne rien hors `app/api/` et `scripts/`.
  - [ ] Token jamais exposé : réponse API ne contient pas `access_token` (`grep access_token` sur réponse = vide).
  - [ ] `SPOTIFY_PLAYLIST_IDS="id1,id2"` override les IDs par défaut (test en changeant env et en vérifiant logs).
  - [ ] Zod `TrackSchema` rejette une track invalide (test unitaire avec mock invalide).
  - [ ] Route exporte `revalidate=3600` et `dynamic` (vérifier `cat app/api/catalog/route.ts | grep revalidate`).
  - [ ] Test co-localisé dans PR.

---

### T04 — Logique Difficulté (5 paliers quintiles) + Filtres Ères (non-bloquant)
- **Dépendances:** T02 (lecture catalogue) — **non-bloquant pour T06** (T06 default `Toutes`)
- **Complexité:** S (2h)
- **Description:** `lib/difficulty.ts` : `getDifficultyTier(popularity, catalog)` calcule les quintiles du catalogue courant (tri par `popularity`, seuils à 20/40/60/80 percentiles). Map : `0-20% → Impossible (pop basse)`, `20-40% → Expert`, `40-60% → Difficile`, `60-80% → Moyen`, `80-100% → Facile` (Facile = pop ≥80, titres ultra connus — documenté). Export `DIFFICULTY_LABELS = ["Facile","Moyen","Difficile","Expert","Impossible"]`, `getTier()`, `filterByDifficulty(tracks, tier)`, `filterByEra(tracks, era)` (Toutes / Classique <2000 / 2000s / 2010s / 2020s via `release_date`). Gère catalogue skew (Top 50 FR left-skewed) : si un tier vide, retourne `[]` + caller affiche `EmptyPoolCard`. `useGameState` default `difficulty="Toutes"` si T04 pas encore chargé.
- **Critères d'acceptation:**
  - [ ] Test `tests/difficulty.test.ts` : pour catalogue mock 100 tracks `popularity 0..99`, chaque tier contient exactement 20 tracks (±1 si arrondi).
  - [ ] Test sur **vrai** `catalog.fr.json` : `filterByDifficulty(catalog, "Facile")` + chaque tier a ≥5 tracks ou documente skew + fallback `EmptyPoolCard` si vide (test vérifie pas de crash).
  - [ ] `filterByDifficulty(catalog, "Facile")` ne retourne que quintile supérieur ; `Impossible` quintile inférieur.
  - [ ] `filterByEra` : `era="2020s"` ne retourne que `release_date >= 2020-01-01` ; `era="Toutes"` retourne tout.
  - [ ] Combinaison `filterByDifficulty(filterByEra(catalog, "2020s"), "Facile")` fonctionne et retourne `[]` sans crash si pool vide.
  - [ ] Labels FR exacts `Facile/Moyen/Difficile/Expert/Impossible` présents et non traduits.
  - [ ] Test co-localisé.

---

### T05 — Moteur audio `useAudioClip` (clip précis 0 → STAGE, rAF + iOS)
- **Dépendances:** T01
- **Complexité:** M (3–4h)
- **Description:** `lib/audio.ts` + `hooks/useAudioClip.ts` : hook encapsulant `HTMLAudioElement` unique (`useRef`, `preload="auto"`). API : `{ play(stageSeconds), pause(), seek0(), setVolume(0-1), isPlaying, currentTime, error }`. Implémentation : `audio.src = preview_url` → attendre `canplay`/`loadedmetadata` (Promise avec `addEventListener('canplay', ...)` timeout 5s) → `audio.currentTime=0` → `audio.play().catch(e=>setError(map NotAllowed/Abort/NotSupported))` ; puis `setTimeout(stop, stageSeconds*1000)` **primary** + `requestAnimationFrame` loop **ou** `setInterval(20ms)` guard vérifiant `if (audio.currentTime >= stageSeconds) { pause(); audio.currentTime=0; }` (PAS `timeupdate` — trop lent 250ms pour 0.1s, C3). Cleanup : `pause()` + `clearTimeout`+`cancelAnimationFrame`+`removeEventListener` + `audio.src=''; audio.load()` au unmount/changement de track. `onError` → `setError("Extrait indisponible")` + toast. Volume : `audio.volume` depuis `storage.prefs.volume`, clamp 0–1, **iOS détection** : si `iPad|iPhone|iPod` ou `audio.volume` read-only → slider masqué/désactivé avec tooltip « Volume via boutons matériels sur iOS » (C3).
- **Critères d'acceptation:**
  - [ ] Test `tests/audio.test.ts` avec mock `HTMLAudioElement` + `vi.useFakeTimers` + mock `requestAnimationFrame` : `play(0.1)` appelle `audio.play()` et programme arrêt à ~100ms (±50ms) ; `play(15)` programme 15000ms.
  - [ ] Test marque **smoke only** — commentaire dans fichier : jsdom n'a pas de moteur média, timing réel vérifié en QA manuelle (matrix iOS Safari, Android Chrome).
  - [ ] Double `play()` sans `pause()` annule premier timer (vérifier `clearTimeout` + `cancelAnimationFrame` appelés).
  - [ ] `pause()` met `isPlaying=false` et `clearTimeout`/`cancelAnimationFrame` appelés.
  - [ ] `setVolume(0.5)` met `audio.volume === 0.5` (clamp 0–1), mais sur iOS userAgent, slider est `disabled`.
  - [ ] Changement `preview_url` reset `currentTime` à 0 et coupe timer précédent + `removeEventListener`.
  - [ ] `audio.play()` rejection `NotAllowedError` attrapée et `error` state mis à jour sans crash.
  - [ ] `audio` `error` event (404) → `error="Extrait indisponible, nouveau morceau"` + callback parent.
  - [ ] Manuel navigateur : clip s'arrête audiblement à 0.1s puis 0.5s etc., sans fuite audio, background tab ne fuite pas >1s.

---

### T06 — État de partie `useGameState` + persistance `localStorage` UNIFIÉ + edge guards
- **Dépendances:** T04, T05 strict (attendre les deux)
- **Complexité:** M (4h)
- **Description:** `hooks/useGameState.ts` : état `{ track, stageIndex, enabledStages: boolean[5], guesses: string[], status, attemptCount, isHydrated, isLoading }`. `STAGES = [0.1,0.5,2,8,15]` constant. `currentStageSeconds = STAGES[stageIndex]` filtré par `enabledStages` (skip désactivés, `enabledStages.some(Boolean)` guard). `submitGuess(guess)` : normalize guess vs `track.title`+`track.artist` (accent + ligatures + case-insensitive) — si match → `status='won'` + reveal + focus `RevealCard` ; sinon `advanceStage()` (prochain enabled) ou `status='lost'` si dernier stage. `skip()` idem. `enabledStages` toggle persistant via `lib/storage.ts` unique (`songspot-fr:prefs`). `selectNewTrack()` tire aléatoirement dans `filteredPool` (difficulté+ère) en excluant `playedIds.filter(id ∈ pool)` ; si `filteredPool.length===0` → rend `EmptyPoolCard` + fallback `Toutes` + toast (C7-1). Si `enabledStages` tous false → force `[true,false,false,false,false]` + toast (C7-2). Si `poolExhausted` → `playedIds=[]` reset (mais filtré) (C7-3). `useEffect` seul pour random pick (pas au SSR) — évite hydration mismatch (C7-7). `storage.ts` wrapper `try/catch` + mémoire fallback si `setItem` throw (Safari privé) (C7-4).
- **Critères d'acceptation:**
  - [ ] `STAGES` vaut exactement `[0.1,0.5,2,8,15]` (test `expect(STAGES).toEqual([0.1,0.5,2,8,15])`).
  - [ ] `enabledStages=[true,false,true,true,true]` fait sauter 0.5s : `currentStageSeconds` après 0.1s est 2s, pas 0.5s.
  - [ ] `enabledStages=[false,false,false,false,false]` auto-corrigé à `[true,...]` + persiste après reload.
  - [ ] `localStorage` `songspot-fr:prefs` persiste ; recharger conserve `enabledStages` ; test `isHydrated` skeleton avant `useEffect`.
  - [ ] `submitGuess("  ANGÈLE  ")` matche `track.title="Angèle"` ; `submitGuess("coeur")` matche `Cœur` (ligature).
  - [ ] `filteredPool=[]` → `EmptyPoolCard` rendu, pas de `pickRandom([])` throw, fallback `Toutes` proposé.
  - [ ] `playedIds` filtré à chaque changement de `difficulty/era` ; `localStorage` corrupt `"{broken"` → fallback mémoire, pas de crash (`try/catch` test).
  - [ ] Après 5 échecs (ou stages épuisés), `status='lost'` et `revealed=true` + focus sur `RevealCard`.
  - [ ] Succès révèle `track` (cover, titre, artiste) et coupe l'audio.
  - [ ] Random pick uniquement en `useEffect` (vérifier `page.tsx` serveur ne pick pas, `GameContainer` client `useEffect(()=>selectNewTrack(),[catalog])`).

---

### T07 — Shell UI, layout, copy FR, design tokens (unique owner globals.css)
- **Dépendances:** T01 (doit attendre, unique owner `globals.css` — C5)
- **Complexité:** M (3–4h)
- **Description:** Finaliser `app/layout.tsx` : `<html lang="fr">`, `metadata` FR, `globals.css` via `@import "tailwindcss"` (Tailwind v4), fonts `next/font/google` (Geist). CSS vars **MVP single theme** (pas de `simple/arcade` — defer V2) : définir tokens de base. `components/layout/Header.tsx` (logo « Songspot FR », nav FAQ, réglages difficulté/ère), `Footer.tsx` (mentions Spotify, lien FAQ), `components/game/EmptyPoolCard.tsx` déjà utilisé par T06. Tous textes FR ; pas d'anglais UI. Conteneur `max-w-4xl` unique (pas de `wide/tight` — V2). Installer `ErrorBoundary` usage. A11y: skip-link, `aria-live=polite` pour changement de stage, focus mgmt.
- **Critères d'acceptation:**
  - [ ] `grep -ri "Guess\\|Play\\|Skip\\|Share" app/ components/` ne retourne aucun texte UI en anglais (hors identifiers).
  - [ ] `app/layout.tsx` contient `lang="fr"` et `metadata.description` en français + `Geist` de `next/font/google`.
  - [ ] `app/globals.css` contient `@import "tailwindcss"` et pas de `tailwind.config.ts` (vérifier absence).
  - [ ] `Header` hamburger `aria-expanded`, `MobileMenu` focus trap + `Escape` ferme, skip-link présent.
  - [ ] V2 flags `ENABLE_V2_STYLES` présents dans `.env.example` mais non utilisés (UI single theme).
  - [ ] `npm run lint` ne signale pas de `lang` manquant.
  - [ ] Ownership : seul T07 touche `app/globals.css` et `app/layout.tsx` (conflit C5 évité).

---

### T08 — Composant Guess + Autocomplete + Playback + Reveal (mergé T08+T09)
- **Dépendances:** T06, T07 strict
- **Complexité:** M (4–5h) — mergé (C4) pour éviter conflit props `AudioPlayer`
- **Description:** `components/game/GuessInput.tsx` : input contrôlé, `onChange` filtre `catalog` par `normalize(title+artist).includes(normalize(query))` (≥2 caractères, max 8 suggestions) affiche `title — artist` + cover miniature. Clavier : `ArrowUp/Down` navigue, `Enter` soumet sélection ou texte brut (hint si vide). A11y : `role="listbox"`, `aria-selected`, focus clavier, `aria-live`. `GuessHistory.tsx` pills. Intégré avec `components/game/AudioPlayer.tsx` (bouton Play/Pause ≥44px, indicateur stage `0.1s / 0.5s / ...`, bouton « Depuis le début » `currentTime=0`, volume slider avec `aria-label` et iOS hidden) + `StageProgress.tsx` (5 segments, actif pulsé, toggle persistant via `prefs.enabledStages`) + `RevealCard.tsx` (succès/échec cover titre artiste album, focus après reveal). Props : `catalog`, `onGuess`, `disabled` (si won/lost), `audio` hook.
- **Critères d'acceptation:**
  - [ ] Taper `angele` propose `Angèle — ...` (test accent-insensitive + ligature `coeur` → `Cœur`).
  - [ ] Taper `jul` propose plusieurs `Jul` (title+artist match).
  - [ ] Flèches + Enter sélectionnent et soumettent ; `onGuess` reçoit string exacte du track.
  - [ ] Soumettre faux guess avance `stageIndex` +1 et ajoute pill dans `GuessHistory` + `aria-live` annonce.
  - [ ] Soumettre bon guess passe `status='won'` et affiche `RevealCard` avec focus.
  - [ ] `AudioPlayer` : clic Play lance depuis 0s ; second clic pause (toggle) ; « Depuis le début » remet `currentTime=0` sans changer `isPlaying` ; tous hit targets ≥44×44px.
  - [ ] Volume slider `aria-label="Volume"` ; sur iOS UA, slider `disabled` + tooltip matériel.
  - [ ] `StageProgress` 5 pills `0.1s/0.5s/2s/8s/15s` ; toggle persistant via `prefs` ; `enabledStages` guard ≥1.
  - [ ] Aucun `audio.play()` sans interaction utilisateur (pas d'autoplay au mount) — vérifié `useEffect` ne joue pas.
  - [ ] Dropdown accessible : `role="listbox"`, `aria-selected`.
  - [ ] Tests co-localisés dans cette PR.

---

### T09 — (V2 DEFERRED) Responsive avancée + styles wide/tight + simple/arcade
- **Dépendances:** T07 — **DEFERRED V2** (C2) — MVP ne l'exige pas
- **Complexité:** M (3h) — **non bloquant build**, flag `ENABLE_V2_STYLES=false`
- **Description:** **Pour MVP:** T07 suffit (responsive de base). Ce T09 est backlog V2 : `MobileMenu` hamburger, `wide/tight` (`max-w-6xl` vs `max-w-3xl`) via classe sur `<main>`, style `simple` vs `arcade` (gradient/glow). Si activé, `globals.css` vars + `data-style`. Pour autopilot: créer placeholder `docs/v2-styles-backlog.md` décrivant le scope V2 et laisser `ENABLE_V2_STYLES` désactivé. Ne pas bloquer T14.
- **Critères d'acceptation (MVP):**
  - [ ] `docs/v2-styles-backlog.md` existe, décrit `wide/tight` + `simple/arcade` scope V2.
  - [ ] `.env.example` `ENABLE_V2_STYLES=false` documenté.
  - [ ] T07 responsive de base suffit : à 375px pas de scroll horizontal, hamburger présent si implémenté en T07, sinon documenté comme V2.
  - [ ] Aucun code `wide/tight` n'est requis pour `npm run build` MVP.

---

### T10 — Reroll sans répétition + Partage Défi ami (URL, sans stage)
- **Dépendances:** T06
- **Complexité:** S (2–3h)
- **Description:** `lib/storage.ts` : `getPlayedIds() / pushPlayedId(id) / clearIfExhausted(poolSize)` avec `filter(id ∈ pool)` + try/catch. `RerollButton.tsx` : « Nouveau morceau » tire `pickRandom(filteredPool.filter(id∉playedIds))`, push l'id, reset si pool épuisé. `lib/share.ts` : `buildShareUrl(trackId, difficulty)` → `?track=<id>&difficulty=<tier>` (stage **omis** MVP — C11) + `navigator.clipboard.writeText` ; `parseShareUrl(searchParams)` inverse avec allowlist `id ∈ catalog` + Zod + fallback random + toast « Défi introuvable, morceau aléatoire ». Au mount de `GameContainer` (dans `Suspense`), si `?track=` présent et valide, force ce track et affiche bannière « Défi : devine ce morceau ! (difficulté X) ».
- **Critères d'acceptation:**
  - [ ] Test `tests/storage.test.ts` : 10 `pickRandom` successifs sans répétition tant que `poolSize` non atteint ; au 11e si `poolSize=10`, pool reset et id déjà vu peut ressortir ; test ajoute `localStorage` corrupt `"{broken"` → fallback mémoire sans throw.
  - [ ] `localStorage` `songspot-fr:playedIds` contient ids joués, `filter(id ∈ pool)` après changement filtre (vérifier `playedIds` nettoyé).
  - [ ] `buildShareUrl` puis `parseShareUrl` round-trip : `parse(build({track:"abc",difficulty:"Facile"}))` retrouve 2 valeurs (stage omis).
  - [ ] Charger `/?track=<id>&difficulty=Expert` affiche même cover/titre masqué et `difficulty=Expert` sélectionnée ; `?track=invalid` → fallback random + toast « Défi introuvable ».
  - [ ] Bouton « Défier un ami » copie URL (`navigator.clipboard.writeText` mock) et affiche toast « Lien copié ! ».
  - [ ] Test `tests/share.test.ts` + `tests/storage.test.ts` co-localisés.

---

### T11 — Responsive ≤640px de base (réduit, T09 V2 defer)
- **Dépendances:** T07
- **Complexité:** S (1–2h) — réduit (C2) pour éviter duplication avec T09 V2
- **Description:** Breakpoint `sm:640px` : vérifie pas de scroll horizontal (`document.documentElement.scrollWidth === window.innerWidth`), hit targets ≥44px (`min-h-11 min-w-11`), Header collapse si hamburger fait en T07 sinon simple stack vertical. Pas de `wide/tight` ni `arcade` (V2). Persistance `prefs.volume` uniquement.
- **Critères d'acceptation:**
  - [ ] À 375px (iPhone SE) : pas de scroll horizontal, pas de débordement, tous boutons ≥44×44px (audit devtools ou test `getBoundingClientRect`).
  - [ ] Lighthouse mobile ≥90 perf (hors audio) — note manuelle.
  - [ ] Aucune logique `wide/tight`/`simple/arcade` requise (vérifier `grep -r "wide\|arcade" app/ components/` vide ou derrière flag).

---

### T12 — Page FAQ FR + audit copy 100% FR
- **Dépendances:** T07
- **Complexité:** S (1–2h)
- **Description:** `app/faq/page.tsx` : contenu FR calqué sur `songspot.net/faq` mais traduit/adapté (Comment jouer ? D'où viennent les extraits ? Pourquoi 0.1s ? Difficultés ? Attribution Spotify). Vérifier `<html lang="fr">` global. Script d'audit `grep -R` pour traquer strings anglaises résiduelles. Footer lien vers FAQ. `metadata` FAQ en français.
- **Critères d'acceptation:**
  - [ ] `/faq` retourne 200 et contient « Comment jouer », « Difficulté », « Spotify » en français.
  - [ ] Aucun paragraphe UI en anglais (audit manuel + `grep -ri "Guess the song" app/ components/` vide).
  - [ ] Header → lien « FAQ » navigue vers `/faq` et retour (test e2e ou manuel).
  - [ ] `metadata` FAQ en français (`title: "FAQ — Songspot FR"`).

---

### T13 — Tests unitaires + qualité (Coverage Gate léger, tests co-localisés)
- **Dépendances:** T02, T05, T06 (mais gate final léger — C4)
- **Complexité:** M (2h) — réduit car tests déjà co-localisés
- **Description:** Gate final qui agrège les tests déjà écrits dans T02/T04/T05/T06/T10. Vérifie `npm test` passe, coverage ≥60% sur `lib/`. Ajoute tests manquants : integration `filterByDifficulty` sur vrai `catalog.fr.json` skew, `storage` corrupt JSON, `normalize` ligatures, `share` invalid track. Ajoute `tests/e2e/share.spec.ts` Playwright (optionnel, peut être `pnpm exec playwright test` si installé, sinon manuel). Ajouter `npm run test:ci`. Documente QA manuelle matrix (iOS Safari, Android Chrome) pour audio timing réel (C6).
- **Critères d'acceptation:**
  - [ ] `npm test` passe avec ≥6 suites, 0 échec (catalog, difficulty, audio smoke, storage, share, normalize).
  - [ ] Coverage ≥60% sur `lib/` (rapport `vitest --coverage` — cn coverage si installé).
  - [ ] Integration: `filterByDifficulty(catalog.fr.json, chaque tier)` ne crashe pas ; si tier vide, `EmptyPoolCard` path couvert.
  - [ ] Test `storage` corrupt JSON + `share` invalid `track` fallback.
  - [ ] `tests/audio.test.ts` marqué `// smoke only — real timing QA manual` (C6).
  - [ ] `docs/qa-manual-matrix.md` existe (iOS Safari, Android Chrome, Desktop Chrome) pour SC2.

---

### T14 — Build, lint, typecheck, polish prod (vertical slice gate)
- **Dépendances:** T01, T02, T05, T06, T08 (vertical slice minimal jouable) — **pas** T11/T12 bloquants (C5). Gate final après tout toutefois.
- **Complexité:** S (2h)
- **Description:** Vérifier `npm run build` (Next build OK), `npm run start` sert prod, `npm run lint` (ESLint flat config Next) 0 erreur, `npx tsc --noEmit` 0 erreur. Polish : favicon, `robots.txt`, `sitemap.ts` minimal, `next.config.ts` `images.remotePatterns` déjà à T01. `.env.example` complet. README FR avec instructions `npm install / npm run dev / npm run build` + section « Catalogue français » (playlists, spike, fallback) + attribution Spotify. Note: T09 V2 defer ne bloque pas build.
- **Critères d'acceptation:**
  - [ ] `npm run build` réussit (exit 0, `.next/` généré).
  - [ ] `npm run start` + `curl http://localhost:3000` → 200.
  - [ ] `npm run lint` → 0 erreur (warnings documentés).
  - [ ] `npx tsc --noEmit` → 0 erreur.
  - [ ] `next.config.ts` autorise `https://i.scdn.co/**` — image non cassée.
  - [ ] README contient sections « Installation », « Catalogue français » (spike + fallback), « Preview Spotify », « Attribution ».
  - [ ] `docs/v2-styles-backlog.md` existe (C2).

---

## 4. Risques & mitigations (v2 maj)

| # | Risque | Impact | Probabilité | Mitigation (v2) |
|---|--------|--------|-------------|-----------------|
| R01 | `preview_url` null 70-95% (Spotify déprécié) | Catalogue injouable, SC1 échoue | **Élevée (70%+)** | **T02b spike** bloque T03 ; fallback JSON seul source vérité; filter-only MVP; `scripts/validate-catalog.mjs` garantit ≥80% valides; `ENABLE_DEEZER_FALLBACK` server-only si pivot |
| R02 | IDs playlists changent/géo-bloqués | Catalogue vide live | Moyenne | `SPOTIFY_PLAYLIST_IDS` env override + fallback JSON ; recherche `search?q=Top 50 France&type=playlist` secours |
| R03 | Dérive timing audio (rAF throttlé, setTimeout background) | Clip dépasse STAGES ±50ms | Moyenne | `setTimeout` primary + `rAF`/`setInterval(20ms)` guard, pas `timeupdate`; tests smoke + QA manuelle matrix |
| R04 | Autoplay bloqué | Play ne démarre pas | Élevée | Jamais autoplay au mount ; `audio.play()` uniquement sur clic ; catch `NotAllowedError` → « Appuie sur Play » |
| R05 | normalisation accents/ligatures | Autocomplete rate titres FR | Faible | `NFD` + map `œ/æ` ; tests unitaires `Cœur/Œuvre` |
| R06 | localStorage quota / privé Safari | Prefs perdues | Faible | `storage.ts` try/catch + fallback mémoire ; ne pas crasher |
| R07 | Hydration mismatch server vs client random | Flash/erreur React 19 | Moyenne | `page.tsx` Server + `GameContainer` Client `useEffect`-only track pick ; `isHydrated` skeleton + `Suspense` |
| R08 | Deezer fallback CORS/rate-limit | Preview Deezer échoue | Moyenne | **Désactivé MVP** (`ENABLE_DEEZER=false`) ; si activé, appel serveur uniquement, flag |
| R09 | Tailwind v4 breaking avec Next 15 | Build cassé | **Corrigée** | `@import "tailwindcss"` à T01, pas de `tailwind.config.ts`; épinglé `tailwindcss@4`, `@tailwindcss/postcss@4` |
| R10 | Catalogue FR biaisé (anglophone Top 50) | SC1 « 100% français » contesté | Moyenne | Définir « français » = chart Top 50 France (même si US dedans) ; snapshot curaté manuellement ; documenté FAQ |

## 5. Questions ouvertes (v2)

| # | Question | Impact | Proposition v2 |
|---|----------|--------|----------------|
| Q01 | ID canonique « Top Titres France » | Catalogue | Vérifier via `check-preview-rate.mjs` search `Top Hits France` au début T02b ; `SPOTIFY_PLAYLIST_IDS` override |
| Q02 | Difficulté = `popularity` pur ou composite ? | T04 | **Recommandation :** quintiles `popularity` pur (simple, testable). Documenter FAQ. V2 pondérer `release_date`. |
| Q03 | Ordre Facile→Impossible = pop haute→basse ? | UX | **Recommandation :** Facile = pop ≥80 (ultra connus). Valider 2 users. |
| Q04 | Deezer fallback en MVP ? | R01 | **Recommandation v2 :** MVP **filter-only, pas Deezer** (plus simple, C1). Deezer derrière flag si spike <40% pivot. |
| Q05 | Daily challenge ? | Scope | **Deferred v2** — hors P0. |
| Q06 | Autocomplete `Titre — Artiste` ? | T08 | **Recommandation :** `Titre — Artiste` (comme Songspot). |
| Q07 | Preview clip = début 0s ou milieu ? | Audio | **Recommandation :** 0s (simple, Songspot pareil). Noter FAQ. |
| Q08 | Share `stage` param ? | T10 | **Recommandation v2 (C11) :** omettre `stage` en MVP (ambigu avec `enabledStages` diff). |
| Q09 | wide/tight + arcade ? | Scope | **Recommandation v2 (C2) :** defer V2, single theme MVP. |

## 6. Mapping Success Criteria → Tâches (v2)

| SC | Critère | Tâches |
|----|---------|--------|
| 1 | Catalogue FR ≥80 tracks, test ≥50 sans doublons | T02, T02b, T03, T13 |
| 2 | 5 stages [0.1,0.5,2,8,15] exact, toggle persistant, timing ±50ms smoke | T05, T06, T13 |
| 3 | Guess accent-insensitive + ligatures, avance si faux, révèle si succès | T06, T08, T13 |
| 4 | Play/pause, volume (iOS hidden), depuis le début | T05, T08 |
| 5 | Difficulté 5 paliers quintiles | T04, T13 |
| 6 | Reroll sans répétition localStorage per-pool | T10, T13 |
| 7 | Partage Défi ami URL round-trip (sans stage) | T10, T13 (+ e2e) |
| 8 | Responsive ≤640px, hit≥44px, single theme | T07, T11 |
| 9 | Copy FR, FAQ FR | T07, T12 |
| 10 | build/start/lint/tsc ok | T01, T14 |
| + | Spike preview rate | T02b |
| + | V2 defer | T09 |

## 7. Ordre d'exécution conseillé (v2, pour autopilot ralph)

1. **T01** — bootstrap (débloque tout, loading/error/ErrorBoundary)
2. **T02** — catalogue statique + validate script
3. **T02b** — spike preview rate (30min, bloquant T03)
4. **T03 + T04 + T05 + T07** en parallèle (pas de dépendance croisée, T04 non-bloquant T06)
5. **T06** — game state (nécessite T04+T05 strict)
6. **T08 + T10** en parallèle (nécessitent T06 ; T08 déjà mergé)
7. **T11 + T12** en parallèle (nécessitent T07, sérialisés si touchent globals.css)
8. **T13** — coverage gate léger (agrège tests co-localisés)
9. **T14** — build final (après vertical slice T01+T02+T05+T06+T08)

**Estimation totale v2 :** ~26–34h dev solo (S=1–2h, M=3–5h, spike 0.5h). Premier vertical jouable (T01+T02+T02b+T05+T06+T08) ≈ 10–12h. **Économie vs v1:** -5h (YAGNI styles retirés, tests co-localisés).

## 8. Vérification finale (Definition of Done v2)
- [ ] `npm run build` + `npm run start` OK, `npm run lint` 0 erreur, `tsc --noEmit` 0 erreur (SC10)
- [ ] Spike `check-preview-rate.mjs` passé et documenté (C1)
- [ ] Catalogue ≥80, `validate-catalog.mjs` ≥80% valides, dedup OK (SC1)
- [ ] Stages exacts + timing smoke ±50ms + QA manuelle matrix (SC2)
- [ ] Guess flow complet + autocomplete accent+ligatures (SC3)
- [ ] Play/pause/volume (iOS hidden)/depuis début + rAF guard (SC4)
- [ ] 5 difficultés quintiles sur vrai catalog (SC5)
- [ ] 10 rerolls sans répétition per-pool (SC6)
- [ ] URL défi round-trip sans stage, invalid fallback (SC7)
- [ ] Responsive + single theme, hit≥44px, wide/tight deferred (SC8)
- [ ] Copy FR + FAQ (SC9)
- [ ] `.env.example` + README FR + attribution Spotify + `docs/v2-styles-backlog.md` + `docs/spike-preview-rate.md` (si créds)

---
*Plan v2 consensus — écrit après A1-A8 + C1-C8. Prêt à exécuter via ralph (1 tâche / invocation).*
