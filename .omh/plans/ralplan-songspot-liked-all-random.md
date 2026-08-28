# Plan : Liked Songs — load ALL + fair random

## Overview
Corrige le plafond 100 du mode « Titres aimés » : charger toutes les pages likées
et mélanger la liste pour donner aux titres anciens la même probabilité que les récents.

## Tasks

### T01 — hooks/useLikedCatalog.ts : fetchAll sans plafond + shuffle
- `fetchAll(maxTracks?)` : boucle `while (true)` qui fetch `/api/me/liked?limit=50&offset=`
  jusqu'à `all.length >= total` (lu depuis la 1re réponse) ou page vide ;
  garde un `hardCeiling` (ex. 10000) anti-boucle infinie si `total` null.
- Après collecte : `shuffle(all)` (Fisher-Yates uniforme) puis `setTracks` ;
  `setTotal(totalVal ?? all.length)`.
- `maxTracks` optionnel : si fourni et >0, `slice(0, maxTracks)` (rétro-compat) ;
  sinon on garde tout.
- Auto-fetch useEffect : `void fetchAll()` (au lieu de `fetchAll(100)`).

### T02 — components/game/GameModeWrapper.tsx : retirer le 100
- Remplacer les 2 appels `liked.fetchAll(100)` (boutons « Réessayer » / « Actualiser »)
  par `liked.fetchAll()`.

### T03 — Vérification
- `npm run lint`, `npx tsc --noEmit`, `npm run test`, `npm run build`.
- Pas de régression mode Top / déconnexion / empty-error-loading.

## Dependencies
T01 → T02 → T03

## Verification
- `fetchAll()` charge N titres (N = total réel), liste mélangée.
- Lint/tsc/test/build verts.
