# Backlog V2 — Styles avancés wide/tight + simple/arcade (T09 DEFERRED)

> **Statut:** `DEFERRED` — non bloquant MVP — `ENABLE_V2_STYLES=false`  
> **Tâche source:** `T09` (priority 14, deps `T07`) — `.omh/plans/ralplan-songspot-fr.md` §T09 + Q09  
> **Itération créée:** 14 — 2026-08-28 — executor T09  
> **Thème MVP actuel:** single theme unique `max-w-4xl` (T07) — aucun code wide/tight/arcade requis pour `npm run build`

---

## 1. Contexte MVP vs V2

| Aspect | MVP (T07 + T11) | V2 (T09 backlog) |
|---|---|---|
| Layout container | `max-w-4xl` unique sur `<main>` + Header/Footer (`896px`, `w-full` cap 375) | `wide` `max-w-6xl` (1152px) vs `tight` `max-w-3xl` (768px) via classe sur `<main>` |
| Style visuel | Single theme clair/sombre `prefers-color-scheme`, tokens Tailwind v4 `@import "tailwindcss"` | `simple` (flat, minimal) vs `arcade` (gradient/glow, néon, ombres) via vars `data-style` |
| Flag | `ENABLE_V2_STYLES=false` dans `.env.example` — non lu en code (grep 0 hit `app/` `components/` `lib/`) | `ENABLE_V2_STYLES=true` active le switch layout/style + persistance `prefs.layout`/`prefs.style` |
| Responsive | T11 réduit ≤640px `sm:640px`, hamburger, hit ≥44px, pas de scroll à 375px (audit 24 `min-h-11`) | Même base + variantes wide/tight testées à 375/768/1280 + arcade `prefers-reduced-motion` |
| Build | `npm run build` MVP passe sans T09 (T14 deps T01+T02+T05+T06+T08 uniquement) | Build conditionnel derrière flag, pas de régression si flag false |

**Décision C2 (plan v2):** MVP = un seul layout / un seul thème. `wide/tight` + `simple/arcade` déplacés en V2 backlog (flag `ENABLE_V2_STYLES=false`). T07 est unique owner de `app/globals.css` pour éviter race.

---

## 2. Scope V2 détaillé

### 2.1 Layout wide / tight via classe sur `<main>`

- **wide:** `max-w-6xl` (1152px) — `class="mx-auto w-full max-w-6xl px-4 sm:px-6"` — pour desktop large, grille StageProgress/GameContainer étendue, covers plus grandes.
- **tight:** `max-w-3xl` (768px) — `class="mx-auto w-full max-w-3xl px-4 sm:px-6"` — pour lecture concentrée, mobile-like même sur desktop.
- **Implémentation prévue:**
  ```tsx
  // app/layout.tsx (V2)
  <main className={`mx-auto w-full flex-1 px-4 py-6 sm:px-6 ${layout === "wide" ? "max-w-6xl" : "max-w-3xl"}`} data-layout={layout}>
  ```
  ou `data-layout="wide"|"tight"` + CSS `[data-layout="wide"] { max-width: 72rem }`.
- **Persistance:** `lib/storage.ts` → `Prefs { layout: "wide"|"tight" }` dans `songspot-fr:prefs`, toggle UI dans Header/MobileMenu (sélecteur Layout).
- **Tests V2:** à 375px `scrollWidth === innerWidth` reste vrai (wide 1152 mais `w-full` borne), à 1280px wide occupe 1152, tight reste 768 centré.

### 2.2 Style simple vs arcade (gradient / glow)

- **simple:** flat, `bg-white dark:bg-zinc-950`, `border-zinc-200`, pas de gradient, `shadow-sm` max. Tokens actuels MVP.
- **arcade:** gradient `from-violet-600 via-fuchsia-500 to-cyan-400`, glow `shadow-[0_0_30px_rgba(139,92,246,0.5)]`, `backdrop-blur`, néon `text-transparent bg-clip-text`, animations `animate-pulse` sur pills actifs (respect `prefers-reduced-motion`).
- **Implémentation prévue:**
  ```css
  /* app/globals.css (V2, derrière flag) */
  :root[data-style="arcade"] {
    --bg: linear-gradient(135deg, #7c3aed 0%, #ec4899 50%, #06b6d4 100%);
    --glow: 0 0 30px rgba(139,92,246,0.5);
  }
  [data-style="simple"] { --bg: #fff; --glow: none; }
  ```
  ```tsx
  <html lang="fr" data-style={style}> / <body className={style === "arcade" ? "arcade" : ""}>
  ```
- **Persistance:** `Prefs { style: "simple"|"arcade" }`, toggle Header.
- **A11y:** arcade désactivé si `prefers-reduced-motion: reduce` → fallback simple (pas de pulse/glow).

### 2.3 Flag `ENABLE_V2_STYLES`

- **`.env.example` MVP:**
  ```
  ENABLE_V2_STYLES=false
  ```
  Documenté mais **jamais importé** en code `app/` `components/` `lib/` (grep 0 hit, vérifié T11 + T13). Seule occurrence `docs/spike-...` + `.env.example` + tests `responsive` (pattern `ENABLE_V2` comme garde anti-régression).
- **V2 activation:**
  ```
  ENABLE_V2_STYLES=true
  ```
  Alors `lib/constants.ts` exporte `ENABLE_V2_STYLES = process.env.ENABLE_V2_STYLES === "true"` (server-only ou `NEXT_PUBLIC_` si client), et `app/layout.tsx` branche conditionnelle `if (ENABLE_V2_STYLES) { /* layout/style switch */ }`.
- **Estimation activation:** 1 ligne `.env.example` + 1 constante + 2 toggles UI + CSS vars = ~30 LOC hors styles.

---

## 3. Estimation & backlog

| Lot | Contenu | Estimation | Dépendances |
|---|---|---|---|
| **V2-1 Layout switch** | `max-w-6xl` vs `max-w-3xl` via classe sur `<main>`, `storage` `prefs.layout`, UI sélecteur Header/MobileMenu, tests `scrollWidth` 375/768/1280 | **1h** | T07 |
| **V2-2 Arcade style** | `globals.css` vars `data-style`, gradient/glow, `prefers-reduced-motion` guard, Header toggle style | **1h** | T07, V2-1 |
| **V2-3 QA responsive V2** | Audit `docs/v2-audit.md` wide/tight à 375/768/1280, Lighthouse ≥90, `tracking-widest` faux positifs documentés, `grep wide\|arcade` derrière flag | **1h** | V2-1, V2-2 |
| **Total** | | **3h (M)** | |

**Complexité plan:** M (3h) — non bloquant build. T09 priority 14, T14 priority 15 ne dépend pas de T09 (T14 deps T01+T02+T05+T06+T08 uniquement).

**Backlog ordonné (après MVP):**
1. Spécifier UX exacte wide/tight (maquette 6xl vs 3xl) — Q09.
2. Spécifier palette arcade (gradient stops, glow radius, dark mode).
3. Impl V2-1 layout switch + persistance + tests.
4. Impl V2-2 arcade + `prefers-reduced-motion`.
5. QA V2-3 + `docs/v2-audit.md` + `npm run build` avec `ENABLE_V2_STYLES=true` + `false` (régression MVP).

---

## 4. Non requis pour MVP — garanties

- [x] **`docs/v2-styles-backlog.md` existe** — ce fichier (placeholder V2, T14 l'exige).
- [x] **`.env.example` `ENABLE_V2_STYLES=false` documenté** — ligne 6 `.env.example`, jamais lu en code MVP.
- [x] **`grep -r "wide\|arcade" app/ components/ lib/` vide ou faux positif `tracking-widest` uniquement** — vérifié T11: 0 hit `arcade`, 0 hit `wide` logique (4 hits `tracking-widest` Tailwind + `tracking-tight` non V2), 0 hit `ENABLE_V2` dans `app/components/lib`.
- [x] **T07 single theme `max-w-4xl` unique** — `app/layout.tsx` `max-w-4xl`, `Header` `max-w-4xl`, `Footer` `max-w-4xl`, `page.tsx` `max-w-4xl`/`max-w-2xl` (pas de `max-w-6xl`/`max-w-3xl`), `app/globals.css` unique owner T07, `@import "tailwindcss"` seul, pas de `wide`/`tight`/`arcade`/`data-style`.
- [x] **`npm run build` MVP passe sans T09** — T14 gate vertical `T01+T02+T05+T06+T08` uniquement, T09 V2 defer ne bloque pas build (vérifié `npx tsc --noEmit` 0, `npm run build` 5 routes, `npm run lint` 0, `npm test` 241/241).

**S'assurer que T14 peut build sans T09 (déjà true):** `lib/constants.ts` `STAGES`/`STORAGE_KEYS`/`PLAYLIST_IDS` seuls, `app/globals.css` single theme, aucune import `ENABLE_V2_STYLES` en runtime MVP.

---

## 5. Références

- Plan: `.omh/plans/ralplan-songspot-fr.md` §T09 (V2 DEFERRED, priority 14, deps T07, acceptance 4 critères) + §T07 ownership `globals.css` + §T11 responsive réduit + Q09 wide/tight+arcade.
- Spec: `.omh/specs/songspot-fr-spec.md` — Q09, C2, STORAGE_KEYS unifiés.
- Audits MVP: `docs/responsive-audit.md` (T11, 8865 bytes, 375px no scroll, 24 `min-h-11`, hamburger `sm:hidden`, V2 grep vide) + `tests/responsive.test.ts` 18 tests (wide/arcade/ENABLE_V2 garde).
- T07 shell: `app/layout.tsx` `max-w-4xl` + `app/globals.css` `@import "tailwindcss"` + `Header`/`Footer`/`MobileMenu` single theme.
- Flag: `.env.example` ligne `ENABLE_V2_STYLES=false` (5 vars totales).

---

## 6. Checklist T09 acceptance (MVP)

- [x] `docs/v2-styles-backlog.md` existe, décrit `wide/tight` (max-w-6xl vs max-w-3xl via classe sur `<main>`) + `simple/arcade` (gradient/glow) scope V2 — **ce fichier**.
- [x] `.env.example` `ENABLE_V2_STYLES=false` documenté — `.env.example:6`.
- [x] T07 responsive de base suffit : à 375px pas de scroll horizontal, hamburger présent (`Header` `sm:hidden` + `MobileMenu` `fixed inset-0 z-50 sm:hidden w-80 max-w-[85vw]`), sinon documenté comme V2 — `docs/responsive-audit.md` §1-3.
- [x] Aucun code `wide/tight` n'est requis pour `npm run build` MVP — build 1180ms 5 routes T13, max-w-4xl unique (grep `max-w-6xl`/`max-w-3xl` 0 hit).

---

*Placeholder créé par executor T09 iteration 14 — ne pas bloquer T14. Pour activer V2: passer `ENABLE_V2_STYLES=true` + impl V2-1..V2-3 ci-dessus. T07 single theme MVP reste par défaut si flag false.*
