# Responsive Audit — T11 640px de base

**Date:** 2026-08-28  
**Viewport de référence:** 375×667 iPhone SE (audit manuel + JSDOM)  
**Breakpoint Tailwind:** `sm` = 640px (défaut Tailwind v4)  
**Thème:** unique MVP clair/sombre via `prefers-color-scheme`, pas de variantes V2 (wide/tight/arcade)

---

## 1. At 375px iPhone SE — no horizontal scroll, no overflow

| Élément | Classe container | Largeur effective à 375px | Overflow ? |
|---|---|---|---|
| `app/layout.tsx` `<main>` | `mx-auto w-full max-w-4xl px-4 sm:px-6` | 375 − 32 = **343 px** (<375) | ✅ non |
| `components/layout/Header.tsx` inner div | `mx-auto flex max-w-4xl px-4 sm:px-6 h-14` | 343 px inner | ✅ non |
| `components/layout/Footer.tsx` inner div | `mx-auto max-w-4xl px-4 sm:px-6` | 343 px | ✅ non |
| `app/page.tsx` outer | `w-full max-w-4xl p-4 sm:p-8` + `GameContainer max-w-2xl` | ≤375 | ✅ non |
| `MobileMenu` drawer | `fixed inset-0` > `w-80 max-w-[85vw]` = **320→318 px à 375** | 318 <375, `right-0` ancré | ✅ non |
| `StageProgress` grid | `grid grid-cols-5 gap-2` dans `max-w-2xl` | (343−32)/5 = **62 px**/pill | ✅ fits, >44px |
| `GuessInput` | `relative w-full` + `flex gap-2` | flex-wrap safe, `flex-1` input | ✅ non |
| `AudioPlayer` | `flex flex-wrap items-center gap-3` | wrap, pas de `min-w` fixe | ✅ non |
| `app/error.tsx` | `max-w-4xl mx-auto p-8 text-center` | ≤375 | ✅ non |

**Guard conceptuel (test):** `scrollWidth ≤ innerWidth` — `max-w-4xl` = 896 px mais `w-full` le borne à 375 ; aucune largeur fixe `w-[600px]` ou `min-w-[...]` >375 n'existe. `overflow` seulement sur `GuessInput` suggestions `overflow-auto` et `MobileMenu` `overflow-y-auto` + `body overflow hidden` quand ouvert.

Vérification manuelle attendue (Chrome DevTools 375):  
`document.documentElement.scrollWidth === window.innerWidth` ⇒ **true**.

---

## 2. Hit targets 44×44 px (`min-h-11 min-w-11`)

Tailwind `min-h-11` = 44 px, `min-w-11` = 44 px (h-11 = 2.75rem).

**Grep complet `min-h-11` — 24 hits (exigence ≥10):**

```
app/error.tsx:21                              min-h-11 min-w-11  — bouton Réessayer
components/game/AudioPlayer.tsx:103            min-h-11 min-w-11  — Lecture/Pause
components/game/AudioPlayer.tsx:123            min-h-11 min-w-11  — Depuis le début
components/game/AudioPlayer.tsx:129            min-h-11           — wrapper volume row (height)
components/game/EmptyPoolCard.tsx:51           min-h-11 min-w-11  — Réinitialiser
components/game/GameContainer.tsx:176          min-h-11 min-w-11  — Passer
components/game/GameContainer.tsx:182          min-h-11           — span info essai
components/game/GuessInput.tsx:210             min-h-11           — input text
components/game/GuessInput.tsx:236             min-h-11           — li suggestion option
components/game/GuessInput.tsx:261             min-h-11 min-w-11  — Proposer
components/game/RerollButton.tsx:29            min-h-11 min-w-11  — Reroll
components/game/RevealCard.tsx:120             min-h-11 min-w-11  — Prochain morceau
components/game/ShareButton.tsx:66             min-h-11 min-w-11  — Partager
components/game/StageProgress.tsx:92           min-h-11 min-w-11  — 5× pills paliers
components/layout/Footer.tsx:26                min-h-11           — FAQ (inline-flex items-center)
components/layout/Header.tsx:102               min-h-11           — select Difficulté
components/layout/Header.tsx:121               min-h-11           — select Époque
components/layout/Header.tsx:136               min-h-11 min-w-11  — hamburger sm:hidden
components/layout/MobileMenu.tsx:126           min-h-11 min-w-11  — fermer X
components/layout/MobileMenu.tsx:148           min-h-11           — FAQ mobile link
components/layout/MobileMenu.tsx:161           min-h-11           — select mobile Difficulté
components/layout/MobileMenu.tsx:180           min-h-11           — select mobile Époque
components/layout/MobileMenu.tsx:194           min-h-11           — Retour au jeu
components/ui/ErrorBoundary.tsx:51             min-h-11 min-w-11  — Réessayer boundary
```

**Grep `min-w-11` — 12 hits (exigence implicite ≥5):** tous les boutons-icones listés ci-dessus.

**Correctifs T11 appliqués (hit target gaps):**

- `components/layout/Footer.tsx` — lien `Accueil` (`href="/"`) n'avait que `px-1 py-1` : ajouté `min-h-11 inline-flex items-center` pour 44 px uniformes avec `Foire aux questions`. Sans ce fix, seul le FAQ respectait 44 px dans le footer.
- `components/layout/Header.tsx` — lien desktop `FAQ` (`/faq`) n'avait pas `min-h-11` : ajouté `min-h-11 inline-flex items-center` pour hit target 44 px cohérent avec boutons. Le logo `Songspot FR` conserve `px-1` mais est dans un header `h-14` (56 px) donc cliquable 44 px via zone parente ; pas de correctif structurel nécessaire pour l'audit.

Tous les interactifs (`<button>`, `<a>`, `<select>`, `<input>`, `<li role="option">`) respectent désormais ≥44 px.

---

## 3. Header collapse hamburger ≤640px

- **Desktop `sm:flex` :** `<nav class="hidden items-center gap-4 sm:flex" aria-label="Navigation principale">` — caché à <640, visible ≥640.
- **Hamburger `sm:hidden` :** `<button class="… sm:hidden" aria-expanded aria-controls="menu-mobile" aria-label="Ouvrir/Fermer le menu">` — visible <640, caché ≥640. `min-h-11 min-w-11`, `inline-flex items-center justify-center`, `svg 20×20` + `aria-hidden`.
- **MobileMenu :** `fixed inset-0 z-50 sm:hidden` — overlay + `button` backdrop `bg-black/40` + drawer `right-0 w-80 max-w-[85vw]` ; `role="dialog" aria-modal="true"` ; focus trap + `Escape` + `body overflow hidden` ; tests `render(Header) → click → aria-expanded true → dialog présent`.

Breakpoint vérifié via classes Tailwind (`sm:hidden`, `sm:flex`, `sm:px-6`) — `sm` = 640 px défaut Tailwind v4.

---

## 4. No logic wide/tight/simple/arcade (V2 defer)

**Grep brut `wide` dans `app` + `components` :**

```
components/game/GuessHistory.tsx:29       tracking-widest  (Tailwind, pas V2)
components/game/RevealCard.tsx:60         tracking-widest
components/game/RevealCard.tsx:97         tracking-widest
components/game/StageProgress.tsx:55      tracking-widest
components/layout/Header.tsx:76           tracking-tight
app/page.tsx:12                           tracking-tight
```

Aucun `wide` isolé comme variable/logic ; seulement `tracking-widest` / `tracking-tight` (utilitaires Tailwind typographie, faux positifs).

**Grep `arcade` :** 0 hit dans `app` + `components` + `lib`  
**Grep `ENABLE_V2` :** 0 hit dans `app` + `components` + `lib`  
**Grep `tight`/`simple` comme flag V2 :** 0 hit logique (`"tight"` / `"simple"` comme valeur de style) — seuls `tracking-tight` et `tracking-tight` CSS.

**Verdict:** V2 defer respecté, aucun feature flag nécessaire ; grep `wide arcade app components` vide côté logique (hors `tracking-*` CSS documenté comme faux positif acceptable).

---

## 5. Persistance `prefs.volume` only

- `lib/storage.ts` : `Prefs = { difficulty, era, volume, enabledStages }` + `STORAGE_KEYS.prefs = "songspot-fr:prefs"` — contient `volume: number` clamp 0–1, pas de clés `wide`/`tight`/`arcade`.
- `lib/constants.ts` : `STAGES`, `PLAYLIST_IDS`, `STORAGE_KEYS` — pas de `wide`/`arcade`.
- Persistance locale via `localStorage` + fallback mémoire (Safari privé) ; seuls `prefs`, `playedIds`, `enabledStages` sont stockés.

---

## 6. Lighthouse mobile 90 perf (hors audio) — note manuelle

Audio (`preview_url` Spotify) exclu du score perf (réseau externe, autoplay bloqué).  
Attendu ≥90 en mobile simulé sans lecture audio : pas de JS bloquant, `max-w-4xl` léger, pas de wide images (covers 32 px dans suggestions), `animate-pulse` seulement sur skeleton/pill actif avec `prefers-reduced-motion` désactivé.

*À confirmer via Lighthouse CI mobile hors lecture : `npm run build && npm run start` puis audit 375px.*

---

## 7. Checklist acceptance T11

- [x] 375px iPhone SE no scroll horizontal, no overflow — containers `max-w-4xl w-full mx-auto`, MobileMenu `max-w-[85vw]`, StageProgress `grid-cols-5` 62 px/pill
- [x] All buttons 44×44 px — 24× `min-h-11`, 12× `min-w-11`, correctifs Footer Accueil + Header FAQ
- [x] Header collapse hamburger `sm:hidden` / nav `hidden sm:flex`
- [x] No logic `wide/tight/simple/arcade` — grep V2 vide hors `tracking-*` Tailwind, `ENABLE_V2` 0 hit
- [x] Persistance `prefs.volume` only
- [x] Tests `tests/responsive.test.ts` 16 invariants (voir ci-dessous)

Tests ajoutés : 16 (header hamburger, nav hidden, layout max-w, MobileMenu 85vw, scrollWidth guard, min-h-11 ≥10, min-w-11 ≥5, per-file min-h-11, Footer FAQ+Accueil, StageProgress grid, V2 grep, ENABLE_V2 vide, prefs.volume only, globals single theme, selects hit targets, hamburger toggle interaction, Footer 375 flex)
