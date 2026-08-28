# Plan d'implémentation — Keybinds + Progress + Remove Toutes (Consensus v1)

> **Source:** `.omh/specs/songspot-keybinds-progress-spec.md` v1.0
> **Cible:** `C:/Users/Raphael/Documents/CODE/Songspot-fr`
> **Stack:** Next.js 15 · React 19 · Tailwind v4 · TS · HTMLAudioElement
> **Langue:** FR 100%

## Architecture Overview

- Keybinds stockés dans `songspot-fr:prefs.keybinds = { play: " ", skip: "s" }` via `lib/storage.ts` + `lib/keybinds.ts` (helpers normalize/format/isInputTarget). Hook `hooks/useKeybinds.ts` écoute `window keydown` (ignore inputs/modifiers, `preventDefault` pour ` `).
- OPTIONS UI : `components/game/OptionsPanel.tsx` (deux capture-boutons + reset) intégré dans `GameContainer` colonne droite `OPTIONS` + mobile sous volume.
- Remove Toutes : `DifficultySelector` → export `DIFFICULTY_TIERS = DIFFICULTY_LABELS` seuls, `DEFAULT_PREFS.difficulty="Facile"`, migration `Toutes→Facile` dans `getPrefs`/`DifficultyContext`/`useGameState`/`share`/`EmptyPoolCard`/`MobileMenu`/`FAQ`.
- Progress bar : `components/game/SongProgressBar.tsx` (`currentTime/duration/isPlaying`, `role=progressbar`, `data-testid="song-progress-bar"`) remplace `StageProgress` en haut centre.

## Tâches atomiques (5)

### T01 — Keybinds lib + storage + hook
- Créer `lib/keybinds.ts` : `DEFAULT_KEYBINDS`, `Keybinds` type, `normalizeKey(key)`, `formatKey(key)` (`" "`→`Espace`, sinon majuscule), `isTypingTarget(el)`, `DEFAULT_KEYBINDS = { play:" ", skip:"s" }` + `STORAGE_KEYS` inchangé (via prefs).
- Étendre `lib/storage.ts` : `Prefs.keybinds?: Keybinds`, `DEFAULT_PREFS.keybinds=DEFAULT_KEYBINDS`, `getPrefs` merge + migration si ancien `Toutes`? non ici keybinds, `normalizeKeybinds(raw)`, `getKeybinds/setKeybinds` helpers + fallback, tests.
- Créer `hooks/useKeybinds.ts` : `(callbacks:{onPlay, onSkip}, keybinds:Keybinds, opts?:{enabled?:boolean})` → `useEffect addEventListener keydown`, ignore si `e.ctrlKey||e.altKey||e.metaKey||isTypingTarget(activeElement)`, `e.key` normalisé `toLowerCase()` sauf `" "` (espace), match `keybinds.play/skip`, `preventDefault`+callback. Cleanup. Export `useKeybinds`.
- Tests `tests/keybinds.test.ts` + `tests/useKeybinds.test.tsx`.

### T02 — OptionsPanel UI + intégration GameContainer
- Créer `components/game/OptionsPanel.tsx` : affiche `Raccourcis` avec 2 lignes (`Lecture : [Espace]` / `Passer : [S]`). Boutons `data-testid="keybind-play"`/`"keybind-skip"` avec `aria-label="Changer raccourci Lecture"`. Au clic, passe en mode `capturing:"play"|"skip"|null`, affiche `Appuyez sur une touche…`, écoute `window keydown` une fois (Enter/Esc annule, sinon `setKeybinds({play:newKey})`). Bouton `Réinitialiser` → `DEFAULT_KEYBINDS`. Persist via `setPrefs({keybinds})` + callback `onChange`.
- Intégrer dans `GameContainer.tsx` colonne droite sous `VOLUME` : remplacer placeholder `Thème sombre` par `<OptionsPanel keybinds={prefs.keybinds} onChange={...} />`. Aussi ajouter version mobile sous `<div className="lg:hidden mt-6 ...">` (après volume mobile).
- Hook usage : `const keybinds = getPrefs().keybinds ?? DEFAULT_KEYBINDS` avec `useState` + `useEffect` sync localStorage, puis `useKeybinds({onPlay: handlePlayPause, onSkip: handleSkip}, keybinds, {enabled: !disabled && isHydrated})`.
- Tests `tests/optionsPanel.test.tsx`.

### T03 — Remove "Toutes" difficulté
- Modifier `components/game/DifficultySelector.tsx` : `const DIFFICULTES = [...DIFFICULTY_LABELS]` sans `Toutes`, export `DIFFICULTES`.
- `lib/storage.ts` : `DEFAULT_PREFS.difficulty="Facile"`, `getPrefs` migre `if (result.difficulty==="Toutes") result.difficulty="Facile"`, `setPrefs` idem guard.
- `components/game/DifficultyContext.tsx` : default `difficulty="Facile"`, `useEffect` migre `Toutes→Facile`.
- `hooks/useGameState.ts` : default `difficulty="Facile"` init state, `getPrefs` fallback `Facile` pas `Toutes`, `filteredPool` supprime branche `difficulty==="Toutes"` (plus de mode progressif); supprimer/commente `touteProgress*` & `progressiveTier` (garder déprécié pour compat mais retourner null), `selectNewTrack` supprime branche progressive `if (difficulty==="Toutes")` → ne garder que pool non-progressif, `resetFilters` → `Facile/Toutes` ère, `forceTrack` allowedDiffs sans `Toutes`.
- `lib/share.ts` : `ShareDifficultySchema = z.enum(DIFFICULTY_LABELS)`, `isValidDifficulty` sans `Toutes`, fallback ancien `Toutes` → `null` puis `Facile` en caller.
- `components/game/EmptyPoolCard.tsx` : message fallback `Facile` pas `Toutes` difficulté, aria-label `Réinitialiser les filtres`.
- `components/layout/MobileMenu.tsx` : retirer `"Toutes"` des listes difficulté, value par défaut `Facile` si `Toutes`.
- `app/faq/page.tsx` : remplacer phrase « Toutes » difficultés par « 5 difficultés ».
- Tests adaptés : `difficultyContext.test`, `filterByDifficulty` etc.

### T04 — SongProgressBar + remplacement top timing
- Créer `components/game/SongProgressBar.tsx` : props `{ currentTime:number, duration:number, isPlaying?:boolean, className?:string }`, calcul `pct = duration>0 ? Math.min(100, Math.max(0,(currentTime/duration)*100)) : 0`, rendu `data-testid="song-progress-bar"` outer `role="group"` avec inner `role="progressbar"` `aria-valuenow=Math.round(currentTime*100)/100` `aria-valuemin=0` `aria-valuemax=duration` `aria-label="Progression de l'extrait"`, track `bg-zinc-800 h-2 rounded-full overflow-hidden w-full` + fill `bg-green-500 h-full transition-all duration-100 ease-linear`, infoline `formatSec(currentTime) / formatSec(duration)` (`0,1 s` virgule) + `isPlaying ? "Lecture" : "En pause"` sr-only.
- Helper `formatSec(sec:number): string` : `sec<1 ? sec.toFixed(1).replace('.', ',')+"s" : sec+"s"`.
- Modifier `components/game/GameContainer.tsx` : importer `SongProgressBar`, remplacer haut `<StageProgress>` par `<SongProgressBar currentTime={audio.currentTime} duration={game.currentStageSeconds} isPlaying={audio.isPlaying} />`, supprimer bloc `progressive indicator Toutes`, garder `DEVINER APRÈS` grid (right sidebar) intact. Ajouter import `useKeybinds` et wiring `handlePlayPause/handleSkip` déjà existants pour keybinds.
- `hooks/useAudioClip.ts` : s'assurer `currentTime` update fréquent via rAF+interval déjà OK (existant), pas de changement majeur mais vérifier que `currentTime` reflète bien `audio.currentTime` pendant lecture clip.
- Tests `tests/songProgressBar.test.tsx` : pct calcul, aria attrs, format.

### T05 — Build gate + QA
- `npm run lint` 0, `npx tsc --noEmit` 0, `npm run build` OK, `npm test` tous verts (adapter anciens tests qui attendaient 6 boutons difficulté → 5, retirer progressive tests ou marquer skip).
- Mettre à jour `README` section difficulté (sans Toutes) et `docs/`.
