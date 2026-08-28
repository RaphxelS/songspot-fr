# QA Manuelle — Matrice Audio & Smoke Tests — T13

> Artefact T13 — gate léger tests unitaires + QA manuelle pour SC2 audio timing réel.
> Les tests `tests/audio.test.ts` sont **smoke only** : jsdom n’a pas de moteur média, le timing réel (0,1s→15s) doit être vérifié manuellement sur appareils/browsers réels. Ce document décrit la matrice minimale, la procédure, et la checklist manuelle.

**Date:** 2026-08-28 — iteration 13 — coverage gate léger
**Scope:** SC2 `STAGES=[0.1,0.5,2,8,15]` exact, SC4 Play/pause/volume/Depuis le début, SC3 guess normalize ligatures
**Référence plan:** `ralplan-songspot-fr.md` T05 (audio rAF+setTimeout guard), T06 (STAGES toggle), T08 (AudioPlayer), T13 (ce doc)

---

## 1) Matrice navigateurs — audio timing réel (SC2)

Le moteur `hooks/useAudioClip.ts` utilise `setTimeout(stageSeconds*1000)` **primary** + `requestAnimationFrame` loop ou `setInterval(20ms)` guard vérifiant `currentTime >= stageSeconds` (pas `timeupdate` — trop lent 250ms pour 0,1s, C3/C6). Doit être smoke-testé manuellement : clip s’arrête audiblement à chaque palier ±≈50ms, pas de fuite >1s en background tab, pas d’autoplay au mount, erreurs gérées sans crash.

| # | Device / OS | Browser | Stages à vérifier (audible) | Procédure (5 étapes) | Critère PASS | Notes |
|---|-------------|---------|------------------------------|----------------------|--------------|-------|
| 1 | **iPhone SE / iOS 16+** | **Safari** (iOS) | 0,1s → 0,5s → 2s → 8s → 15s | 1. Charger `/` (dev/prod) <br>2. **Ne pas** autoplay — vérifier silence au mount <br>3. Cliquer **Lecture** — écouter arrêt à 0,1s <br>4. Cliquer **Passer** (ou faux guess) → stage 0,5s → Lecture → arrêt à 0,5s, idem 2s/8s/15s <br>5. Couper onglet arrière-plan 5s puis revenir | Clip s’arrête à chaque palier (±0,5s perçu), pas de fuite >1s en bg, bouton bascule Pause/Play, slider **Volume désactivé** + tooltip « Volume via boutons matériels sur iOS » | `isIOS()` → `isVolumeSliderDisabled()` true, volume matériel uniquement. `play().catch(NotAllowedError)` → toast « Lecture bloquée » si tap hors geste |
| 2 | **Android Pixel / Samsung** | **Chrome 120+** | idem 0,1→15 | Mêmes 5 étapes + tester volume slider 0→1 | Arrêt à ±50ms (mesure console: `performance.now()` au play vs pause), seek `Depuis le début` remet `currentTime=0` sans toggle play | Volume `audio.volume` clamp 0–1 fonctionnel, pas de read-only |
| 3 | **Desktop macOS / Windows** | **Chrome 120+** (Desktop) | idem 0,1→15 + prev_url change | 1. idem + 2. DevTools console : `audio.currentTime` guard <br>3. Changer `track` (Reroll **Nouveau morceau**) → vérifier `currentTime=0` + timer précédent `clearTimeout`/`cancelAnimationFrame` <br>4. Double `play` sans `pause` → premier timer annulé | `play(0.1)` 100ms±50, `play(15)` 15000ms ; double-play annule, `pause()` `clearTimeout+cancelAnimationFrame`; `error` 404 → « Extrait indisponible, nouveau morceau » | Vérifier `rAF` + `setInterval(20ms)` guard, pas `timeupdate`. Vérifier `preload=auto`, timeout 5s `canplay` |
| 4 | **Desktop Safari / Firefox** (optionnel) | Safari/Firefox | 0,1s et 15s smoke | Lecture/pause + error `NotAllowed` si autoplay tenté | Pas de crash, `mapPlayError` classe `NotAllowed→playBlocked`, `Abort→playAborted` | Smoke only, rapporter si écart |

**Comment smoke-tester le timing ±50ms sans outil :**
- Chrome: `performance.now()` au clic Play, `setTimeout` log quand `pause()` appelé, vérifier delta ≈ stage*1000
- À l’oreille: 0,1s = clic ultra-court (signature), 0,5s = demi-seconde, 2s = court extrait reconnaissable
- Vérifier **pas de fuite** : mettre onglet en arrière-plan pendant clip 15s → revenir, audio doit être coupé à ≤1s après `stageSeconds`

**Référence code smoke only:**
```ts
// tests/audio.test.ts — ligne 2 et 6:
// smoke only — jsdom n'a pas de moteur média, timing réel vérifié en QA manuelle (iOS Safari, Android Chrome, Desktop Chrome)
```

---

## 2) Checklist manuelle — smoke only (hors audio) + T13 gate

Cocher avant de marquer T13 `passes:true`. Exécuter `npm run test:ci`, `npx tsc --noEmit`, `npm run build`, `npm run lint` puis QA manuelle :

### 2.1 Gate automatisé (doit être PASS)
- [ ] `npm test` — 14 suites, 225+ tests PASS (catalog, difficulty, audio smoke, storage, share, normalize, gameState, gameComponents, responsive, faq, spotify, api-catalog, validation, rerollShare)
- [ ] `npx tsc --noEmit` — 0 erreur
- [ ] `npm run build` — Next build OK, 5 routes (`/`, `/faq`, `/api/catalog` dynamic), First Load ~128kB
- [ ] `npm run lint` — 0 erreur 0 warning
- [ ] `npx vitest run --coverage` ou `npm run test:ci` — coverage `lib/` **≥60%** (actuel 2026-08-28: **lib 80.87%** — voir §3)
- [ ] `docs/qa-manual-matrix.md` existe (ce fichier) + `package.json:test:ci` = `vitest run --coverage`
- [ ] `tests/audio.test.ts` contient commentaire `smoke only — real timing QA manual` (grep `smoke only`)

### 2.2 Audio timing réel — smoke only (matrice ci-dessus)
- [ ] iOS Safari : clip 0,1s audible puis stop, 0,5s/2s/8s/15s idem, **volume slider disabled** + tooltip iOS, pas de fuite bg >1s
- [ ] Android Chrome : idem timing ±50ms, volume slider 0–1 clamp, `Depuis le début` seek0
- [ ] Desktop Chrome : idem + `preview_url` change reset 0 + coupe timer, double play annule, `NotAllowedError` → toast, `error` 404 → toast
- [ ] Console: aucun `NotAllowedError` non catché, aucun `audio.play()` sans geste utilisateur (pas d’autoplay au mount — `useEffect` ne joue pas)

### 2.3 Intégration T13 — déjà couverts mais vérifiés (gate léger)
> T13 vérifie qu’ils existent dans les suites co-localisées (T02/T04/T05/T06/T10). Grep rapide attendu :

- [ ] `filterByDifficulty` sur vrai `catalog.fr.json` skew — `tests/difficulty.test.ts:246` `describe("vrai catalog.fr.json — 95 tracks, skew Top 50")` — chaque tier ≥0 total 95, seuils p20≤p40≤p60≤p80, combo `filterByDifficulty(filterByEra(2020s), Facile)` ne crash pas (EmptyPoolCard path)
- [ ] `storage` corrupt JSON `"{broken"` fallback — `tests/storage.test.ts:69` + :79 + :219 prefs & playedIds try/catch JSON.parse, fallback `DEFAULT_PREFS`/`[]` sans throw, `push` après corrupt fonctionne
- [ ] `normalize` ligatures `œ→oe` — `tests/normalize.test.ts:5-27` `Àngèle→angele`, `Cœur→coeur`, `Œuvre→oeuvre`, `œ/Œ/æ/Æ` + NFD `Élève→eleve`, case-insensitive
- [ ] `STAGES` exact `[0.1,0.5,2,8,15]` — `lib/constants.ts:8` + `hooks/useGameState.ts:29` re-export + `tests/gameState.test.ts:60` `expect(STAGES).toEqual([0.1,0.5,2,8,15])`
- [ ] `enabledStages` guard `some(Boolean)` — `tests/storage.test.ts:88` all-false → `[true,false,false,false,false]` + `tests/gameState.test.ts:121` all-false autocorrect + `hooks/useGameState.ts` guard
- [ ] `share` invalid track fallback — `tests/share.test.ts:88` `allowlist id hors catalog → false + TOAST_CHALLENGE_NOT_FOUND`, `tests/rerollShare.test.tsx` + `GameContainer` `?track=invalid` → fallback random + toast « Défi introuvable »
- [ ] `emptyPool` / tier vide — `tests/gameState.test.ts:316` `filteredPool=[] → isEmptyPool true track null`, `tests/difficulty.test.ts:141` tier inconnu `[]` sans crash, combo vide `[]` + `EmptyPoolCard` path
- [ ] `emptyPool` UI — `components/game/EmptyPoolCard.tsx` `data-testid empty-pool-card role alert aria-live polite` FR « Aucun morceau disponible » + bouton « Afficher tous les morceaux » min-h-11
- [ ] `isVolumeSliderDisabled` + `isIOS` — `tests/audio.test.ts:40-68` clampVolume, isIOS iPhone/iPad/iPod, mapPlayError

### 2.4 Partage & reroll (SC6/SC7) smoke manuel
- [ ] Charger `/?track=<id valide>&difficulty=Expert` → même cover masquée + `difficulty=Expert` + bannière « Défi : devine ce morceau ! (difficulté Expert) » (`data-testid challenge-banner`)
- [ ] `?track=invalid` → fallback random + toast « Défi introuvable, morceau aléatoire »
- [ ] Bouton **Défier un ami** copie URL `?track=&difficulty=` sans `stage` (`navigator.clipboard.writeText` mock) + toast « Lien copié ! »
- [ ] **Reroll** « Nouveau morceau » 10× sans répétition tant que pool non épuisé, au 11e si pool=10 reset pool (T10 `tests/storage.test.ts:253`)

### 2.5 Responsive & copy FR smoke (T11/T12)
- [ ] 375px iPhone SE : pas de scroll horizontal (`scrollWidth===innerWidth`), hit targets ≥44px (`min-h-11 min-w-11` 24/12 hits), header hamburger `aria-expanded`, MobileMenu `fixed inset-0 z50 sm:hidden w-80 max-w-[85vw]`
- [ ] `/faq` contient « Comment jouer », « Difficulté », « Spotify », metadata `FAQ — Songspot FR`, aucun UI anglais `Guess the song` (grep vide)

---

## 3) Rapport coverage T13 — 2026-08-28

**Commande:** `npm run test:ci` (`vitest run --coverage` avec `@vitest/coverage-v8@3.2.7`, provider v8)

**Résultat 2026-08-28T10:46:26 (225 tests, 14 suites) — extrait `lib/` :**

```
 File            | % Stmts | % Branch | % Funcs | % Lines | Uncovered
 lib/audio.ts    |   42.04 |    61.9  |     50  |   42.04 |  (helpers getStoredVolume/setStoredVolume + isVolumeSliderDisabled partiellement)
 lib/catalog.ts  |   63.88 |   100    |     40  |   63.88 |  42-44,51-57,63-65
 lib/constants.ts|   73.68 |   33.33  |    100  |   73.68 |  24-28 (PLAYLIST_IDS env override)
 lib/difficulty.ts|  90.8  |   89.36  |   83.33 |   90.8  |  72-77,148-149
 lib/normalize.ts |  100   |    80    |   100  |   100   |  28
 lib/share.ts    |   83.44 |   79.31  |     75  |   83.44 |
 lib/spotify.ts  |   85.29 |   57.53  |    100  |   85.29 |
 lib/storage.ts  |   86.59 |   75.3   |     72  |   86.59 |
 lib/validation.ts|  100  |   100    |   100  |   100   |
----------------|---------|----------|---------|---------|
 lib ALL       |   80.87 |   72.34  |   73.33 |   80.87 |  ≥60% ✅ PASS (gate léger)
 All files     |   69.31 |   72.6   |   66.94 |   69.31 |  (hors scope T13)
 hooks/useAudioClip | 60.91 | 49.12 | 37.5 | 60.91
 hooks/useGameState | 78.97 | 74.41 | 71.42| 78.97
```

**Verdict gate léger T13:** **PASS** — `lib/` statements 80.87% ≥60%, lines 80.87% ≥60% (vitest config thresholds `statements:60 lines:60 branches:55 functions:55`).

**Si coverage <60% (fallback manuel T13):** `vitest --coverage` non installé (`Cannot find '@vitest/coverage-v8'`) → rapport manuel ci-dessus documente les suites et l’existence des tests co-localisés ; coverage estimé via `grep -c "it(" tests/*.test.ts` total 225 + inspection `lib/*.ts` branches couvertes (cf. storage corrupt, difficulty skew, normalize ligatures). Mais depuis T13 `@vitest/coverage-v8` est installé, le rapport v8 fait foi.

**Config:** `vitest.config.mjs` `coverage: { provider:"v8", include:["lib/**","hooks/**","components/**","app/**"], thresholds:{statements:60,lines:60,branches:55,functions:55} }`

---

## 4) Playwright e2e optionnel — `tests/e2e/share.spec.ts` (non bloquant)

MVP T13 note : Playwright peut être `pnpm exec playwright test` si installé, sinon manuel (ce doc fait foi). Si Playwright ajouté, e2e minimal :

```ts
// tests/e2e/share.spec.ts — optionnel SC7
test("share round-trip sans stage", async ({ page }) => {
  await page.goto("/");
  const url = await page.evaluate(() => buildShareUrl("abc123","Facile")); // ou via UI ShareButton
  expect(url).not.toContain("stage");
  await page.goto(`/?track=abc123&difficulty=Facile`);
  await expect(page.getByTestId("challenge-banner")).toContainText("Défi");
});
```

**Status T13:** non installé MVP, QA manuelle §2.4 suffit. `npm run test:ci` reste gate.

---

## 5) Lien vers preuves T13 (à mettre à jour à chaque run)

- `npm test` : 225/225 PASS, 14 suites — 2026-08-28 10:45:50 5.62s
- `npx tsc --noEmit` : 0
- `npm run build` : PASS 1352ms → 5 routes, First Load 128kB
- `npm run lint` : 0
- `npm run test:ci --coverage` : lib 80.87% PASS
- `grep -n "smoke only"` : `tests/audio.test.ts:2,6,69` ✅
- `grep -rn "STAGES.*0.1"` : `lib/constants.ts:8` + `tests/gameState.test.ts:60` ✅
- `grep -rn '"{broken"'` : `tests/storage.test.ts:69,80` ✅

---

*Document généré T13 — à versionner, MAJ à chaque QA manuelle device réel avant release.*
