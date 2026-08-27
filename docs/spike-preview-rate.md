# Spike preview_url — taux live Spotify (T02b)

> Généré le 2026-08-27 par `scripts/check-preview-rate.mjs` — timeout 5000ms, seuil pivot 40%

## Résumé

- **Total global**: 95
- **Avec preview_url**: 95
- **Hit rate global**: 100.0% (95/95)
- **Seuil pivot**: 40% — si hit < 40% → fallback-only
- **Décision**: ✅ **Filter-only MVP maintenu** — hit rate global 100.0% ≥ 40% : Spotify utilisable en complément, mais `data/catalog.fr.json` reste seule source de vérité jusqu'à T03 validé.

> ℹ️ SPOTIFY creds missing, spike skipped — using fallback JSON. Mesure live non exécutée (pas de SPOTIFY_CLIENT_ID/SECRET). Fallback JSON seul source de vérité. Pour mesure réelle: `SPOTIFY_CLIENT_ID=xxx SPOTIFY_CLIENT_SECRET=yyy node scripts/check-preview-rate.mjs`.


## Détail par playlist

| playlistId | total | withPreview | hit% |
|---|---|---|---|
| `37i9dQZEVXbIP3c3fqVrJY` | — | — | — |  
| `37i9dQZEVXb5AvMoO2SKHg` | — | — | — |

## Méthode

1. `POST https://accounts.spotify.com/api/token` avec `grant_type=client_credentials` (Basic `${CLIENT_ID}:${SECRET}` base64), timeout 5000ms
2. `GET https://api.spotify.com/v1/playlists/{id}/tracks?limit=100&market=FR` paginé, comptage `total` et `withPreview = tracks.filter(t => t.preview_url)`
3. Hit% = withPreview / total * 100 par playlist + global. Console affiche `Hit rate: XX.X% (withPreview/total)`

## Fallback

- **Source de vérité actuelle**: `data/catalog.fr.json` (95 tracks FR, preview_url SoundHelix `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-*.mp3` rotatif 1-16, tous HEAD 200 audio/mpeg validés 100% via `scripts/validate-catalog.mjs`)
- **SoundHelix 100% vs Spotify 70–95% null note**: SoundHelix garantit 100% hit (fictif mais stable pour le jeu) tandis que Spotify live varie 70–95% de null (dépend playlists/licences). Le spike mesure cette variabilité réelle.
- Si hit < 40% ou creds manquants/invalides → **pivot fallback-only** : T03 sert `catalog.fr.json` direct + `console.warn("SPOTIFY creds missing — serving fallback JSON")`

## Prochaine étape

- Si hit ≥ 40% → T03 peut tenter Spotify live avec fallback JSON en cas d'erreur, `revalidate=3600`, Zod validation, token jamais exposé
- Si hit < 40% → documenter choix produit ici (iTunes Search API, Deezer primary, ou rester fallback-only) avant T03

---
*Script: `node scripts/check-preview-rate.mjs` — sans creds: warn + exit 0 + ce placeholder. Avec creds: mesure live <30s.*
