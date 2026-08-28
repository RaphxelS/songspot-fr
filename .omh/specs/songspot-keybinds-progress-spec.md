---
version: "1.0"
status: confirmed
created: "2026-08-28T18:00:00Z"
project_name: "songspot-keybinds-progress"
type: feature
coverage:
  goal: CLEAR
  constraints: CLEAR
  success_criteria: CLEAR
---

# Songspot — Keybinds + Progress bar + Remove Toutes — Requirements Spec

## Goal

Améliorer Songspot FR avec 3 évolutions demandées :

1. **Raccourcis clavier** configurables pour *Lecture* et *Passer* : par défaut `Espace` = lecture/pause et `S` = passer au palier suivant. Paramétrage dans la zone **OPTIONS** (panneau droit sous VOLUME) — l'utilisateur peut redéfinir chaque touche.
2. **Supprimer la difficulté « Toutes »** — seules `Facile / Moyen / Difficile / Expert / Impossible` restent. Migration : les prefs stockées `Toutes` basculent vers `Facile`. Le mode progressif lié à `Toutes` est retiré.
3. **Barre de progression du morceau** qui **remplace** l'affichage du timing en haut (StageProgress 5 segments en haut). La barre reflète `audio.currentTime / stageSeconds` en temps réel et reste accessible.

Toutes les chaînes en français. Aucun stockage PII supplémentaire.

## Constraints

- Stack existante : Next.js 15 App Router · React 19 · Tailwind v4 · TS strict · HTMLAudioElement · localStorage `songspot-fr:prefs`.
- Raccourcis : écoute `window.keydown`, ignorés quand focus dans `INPUT / TEXTAREA / SELECT / [contenteditable]` ou avec modificateurs `Ctrl/Alt/Meta`. `Espace` doit `preventDefault` (évite scroll). Touches capturées via `event.key` (ex. `" "` pour espace, `"s"`/`"S"` → normalisé en minuscule sauf espace). Stockage dans `prefs.keybinds = { play: " ", skip: "s" }`.
- OPTIONS UI : section droite `OPTIONS` (desktop) + équivalent mobile (sous volume). Deux champs « appuyez sur une touche » + bouton Réinitialiser. Affichage formaté : `" "` → `Espace`, sinon majuscule. `localStorage` persistant, migration immédiate.
- Suppression `Toutes` : `DIFFICULTES` n'exporte plus que les 5 labels. `DEFAULT_PREFS.difficulty="Facile"`, migration `getPrefs()` et `DifficultyContext` et `useGameState`. `share.ts` allowlist sans `Toutes` (fallback `Facile` si lien ancien). EmptyPool reset → `Facile`. FAQ mise à jour. Pas de régression build.
- Progress bar : nouveau composant `SongProgressBar` (`currentTime`, `duration`, `isPlaying`). `role="progressbar"` `aria-valuenow/valueMin/valueMax`, `aria-label="Progression de l'extrait"`. Largeur `width = min(100, (currentTime/duration)*100)%` avec `transition-all`. Remplace le `StageProgress` du haut (center `max-w-xl`). `StageProgress` conservé pour tests rétro-compat mais non rendu au centre haut.
- Accessibilité : hit targets ≥44 px conservés, `aria-live` inchangée, pas d'autoplay.

## Success Criteria

1. **Keybinds par défaut** : sans prefs, `prefs.keybinds = { play:" ", skip:"s" }`. Appuyer sur `Espace` hors input déclenche `play/pause` (même que clic bouton), `S` déclenche `skip` (même que bouton Passer). `Espace` ne scrolle pas la page. Dans un `<input>`, les touches ne déclenchent pas le jeu.
2. **OPTIONS UI** : panneau droit affiche « Raccourcis » avec deux lignes : `Lecture : [Espace]` et `Passer : [S]`, chaque `[ ]` est un bouton `aria-label="Changer raccourci Lecture"` qui, en mode édition, affiche « Appuyez sur une touche… » et capture la prochaine `keyDown` (Enter/Escape annule). Bouton « Réinitialiser » remet `Espace/S`. Changement persiste après reload (`localStorage`).
3. **Plus de « Toutes »** : `DifficultySelector` n'affiche que 5 boutons (test `screen.getAllByRole(button).length ===5`, pas de `Toutes`). `grep -rn "Toutes" components/game/DifficultySelector` → 0. `DEFAULT_PREFS.difficulty==="Facile"`, `getPrefs()` migre ancien `"Toutes"` → `"Facile"`. `useGameState` default `Facile`, `filterByDifficulty` n'est plus appelé avec `Toutes`. Lien de partage ancien `?track=...&difficulty=Toutes` → fallback `Facile` (parseShareUrl → `Facile` ou `null` bandé). `EmptyPoolCard` reset → `Facile` / `Toutes` ère seulement.
4. **Barre de progression** : en haut au centre, `SongProgressBar` remplace `StageProgress` (plus de texte « Palier actuel : 0,1 s · 1/5 » en haut). Test : `data-testid="song-progress-bar"` présent, `role="progressbar"` avec `aria-valuenow` reflétant `currentTime`. À `currentTime=0 / duration=0.1`, largeur `0%`; à `0.05/0.1`, `50%`. La barre utilise `audio.currentTime` (mis à jour via `timeupdate` + rAF + setInterval 20 ms). Pas de régression build/tsc/lint/tests.
5. **Build & tests** : `npm run build` OK, `npx tsc --noEmit` 0 erreur, `npm run lint` 0 erreur, `npm test` tous verts (suites existantes adaptées + nouvelles suites `keybinds`/`songProgressBar` ≥5 tests chacune).
