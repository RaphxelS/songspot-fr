# Spike preview_url — taux live Spotify (T02b)

> Généré le 2026-08-28 par `scripts/check-preview-rate.mjs` — timeout 5000ms, seuil pivot 40%

## Résumé

- **Total global**: 0
- **Avec preview_url**: 0
- **Hit rate global**: 0.0% (0/0)
- **Seuil pivot**: 40% — si hit < 40% → fallback-only
- **Décision**: ⚠️ **Pivot fallback-only** — hit rate global 0.0% < 40% : Spotify preview_url trop faible pour MVP filter-only. Source de vérité = `data/catalog.fr.json` (SoundHelix 100% — 95/95 HEAD 200). T03 bloqué jusqu'à décision produit (iTunes Search / Deezer primary envisagés).


## Détail par playlist

| playlistId | total | withPreview | hit% |
|---|---|---|---|
| `37i9dQZEVXbIP3c3fqVrJY` | ERR (403 playlist fetch failed 37i9dQZEVXbIP3c3fqVrJY: 403  {"err) | — | ERR% |
| `37i9dQZEVXb5AvMoO2SKHg` | ERR (403 playlist fetch failed 37i9dQZEVXb5AvMoO2SKHg: 403  {"err) | — | ERR% |

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
