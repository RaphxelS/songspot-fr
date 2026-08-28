---
version: "1.0"
status: confirmed
created: "2026-08-28T19:15:00Z"
project_name: "songspot-liked-all-random"
type: feature
coverage:
  goal: CLEAR
  constraints: CLEAR
  success_criteria: CLEAR
  existing_context: CLEAR
---

# Songspot — Liked Songs: load ALL + fair-random (older likes included)

## Goal

Améliorer le mode « Titres aimés » existant : charger **tous** les titres aimés de
l'utilisateur (pas seulement les 100 premiers), et mélanger (shuffle) la liste
chargée pour que les titres likés anciens aient autant de chance d'être joués que
les récents. Aujourd'hui la récupération est plafonnée à `maxTracks=100`
(`hooks/useLikedCatalog.ts` + `components/game/GameModeWrapper.tsx` appellent
`fetchAll(100)`), or Spotify renvoie `/v1/me/tracks` du **plus récent au plus
ancien** → seuls les 100 titres les plus récents étaient utilisables.

## Constraints

- Next.js 15 App Router (existant). Client-only changes (hook + wrapper). Pas de
  changement serveur nécessaire : `app/api/me/liked/route.ts` supporte déjà la
  pagination complète (retourne `total` + pages de 50).
- Spotify limite `limit` à 50 sur `/v1/me/tracks`. Pagination obligatoire 50/50.
- Sélection déjà uniformément aléatoire dans `useGameState.selectNewTrack`
  (`Math.random()` sur le pool filtré, exclusion des `playedIds`). Charger tous les
  titres + shuffle suffit à corriger le biais « nouveaux uniquement ».
- Aucune régression sur : mode Top France, déconnexion, empty/error/loading states.
- Tous textes FR (inchangé).

## Success Criteria

1. **Chargement complet** — Au passage en mode « Titres aimés » (ou reconnect),
   `fetchAll()` sans argument charge **toutes** les pages jusqu'à `total`
   (arrêt sur `all.length >= total` ou page vide), sans plafond 100.
2. **Shuffle** — La liste stockée (`tracks`) est mélangée (Fisher-Yates uniforme)
   avant `setTracks`, donc l'ordre nouveau→ancien de Spotify est cassé ; les
   titres anciens sont aussi tirés à jouer.
3. **UI** — `GameModeSelector` (badge `likedCount`, `totalLiked`) et les boutons
   « Réessayer » / « Actualiser » appellent `fetchAll()` (sans `100`). Le warning
   « <5 titres » reste correct.
4. **Pas de boucle de refetch** — L'auto-fetch (useEffect) ne relance pas tant que
   `tracks !== null` ; pas de re-shuffle quand on repasse top→liked (cache conservé).
5. **Qualité** — `npm run lint` 0 erreur, `npx tsc --noEmit` 0 erreur,
   `npm run test` tous verts, `npm run build` OK.

## Existing Context

Projet Next.js 15 à `C:/Users/Raphael\Documents\CODE\Songspot-fr`. Mode Titres aimés
déjà implémenté (instance `songspot-liked-songs`, complete). Fichiers en jeu :
`hooks/useLikedCatalog.ts` (`fetchAll(maxTracks=100)` + `fetchAll(100)` auto),
`components/game/GameModeWrapper.tsx` (2× `liked.fetchAll(100)`),
`app/api/me/liked/route.ts` (pagination OK, à ne pas toucher),
`hooks/useGameState.ts` (sélection uniforme déjà en place).

## Assumptions

- `total` renvoyé par Spotify est fiable pour borner la pagination.
- Bibliothèque typique 20–2000 titres ; pour les très grandes libs (>~2000) le
  chargement séquentiel reste acceptable (demande utilisateur explicite « load all »).
- Pas de doublons d'id entre pages (Spotify pages disjointes).
