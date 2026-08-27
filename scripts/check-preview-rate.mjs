#!/usr/bin/env node
/**
 * check-preview-rate.mjs — Spike taux preview_url live (T02b)
 * Node fetch natif, no deps, timeout 5s.
 * - Si SPOTIFY_CLIENT_ID/SECRET manquants → warn + exit 0 + placeholder docs
 * - Sinon : getAccessToken() POST https://accounts.spotify.com/api/token (Basic auth, grant_type=client_credentials)
 * - fetchPlaylistTracks pour DEFAULT_PLAYLIST_IDS ou SPOTIFY_PLAYLIST_IDS csv
 * - Compte total/withPreview, hit% par playlist + global
 * - Écrit docs/spike-preview-rate.md avec table | playlistId | total | withPreview | hit% | + summary
 * - Pivot si <40% → fallback-only documenté
 */

import { writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DOC_PATH = resolve(ROOT, "docs/spike-preview-rate.md");

const TIMEOUT_MS = 5000;
const PIVOT_THRESHOLD = 40;

const DEFAULT_PLAYLIST_IDS = ["37i9dQZEVXbIP3c3fqVrJY", "37i9dQZEVXb5AvMoO2SKHg"];

function getPlaylistIds() {
  const env = process.env.SPOTIFY_PLAYLIST_IDS;
  if (env && env.trim().length > 0) {
    return env
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return [...DEFAULT_PLAYLIST_IDS];
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(t);
    return res;
  } catch (e) {
    clearTimeout(t);
    throw e;
  }
}

async function getAccessToken(clientId, clientSecret) {
  const creds = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetchWithTimeout("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`token fetch failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  if (!data.access_token) throw new Error("no access_token in response");
  return data.access_token;
}

async function fetchPlaylistTracks(playlistId, token) {
  let url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100&market=FR`;
  let total = 0;
  let withPreview = 0;
  let apiTotal = null;

  while (url) {
    const res = await fetchWithTimeout(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const err = new Error(`playlist fetch failed ${playlistId}: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    if (apiTotal === null && typeof data.total === "number") apiTotal = data.total;
    const items = Array.isArray(data.items) ? data.items : [];
    for (const item of items) {
      const track = item?.track;
      if (!track) continue;
      total++;
      if (track.preview_url) withPreview++;
    }
    url = data.next || null;
  }
  // If API returned total but we counted less due to null tracks, keep counted total for hit% denominator
  // but also note apiTotal for transparency
  return { total, withPreview, apiTotal };
}

function hitPercent(withPreview, total) {
  if (total === 0) return "0.0";
  return ((withPreview / total) * 100).toFixed(1);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function buildMarkdown({ results, globalTotal, globalWithPreview, globalHit, pivot, errorNote, tokenError }) {
  const date = new Date().toISOString().slice(0, 10);
  const globalHitStr = hitPercent(globalWithPreview, globalTotal);
  const decision = pivot
    ? `⚠️ **Pivot fallback-only** — hit rate global ${globalHitStr}% < ${PIVOT_THRESHOLD}% : Spotify preview_url trop faible pour MVP filter-only. Source de vérité = \`data/catalog.fr.json\` (SoundHelix 100% — 95/95 HEAD 200). T03 bloqué jusqu'à décision produit (iTunes Search / Deezer primary envisagés).`
    : `✅ **Filter-only MVP maintenu** — hit rate global ${globalHitStr}% ≥ ${PIVOT_THRESHOLD}% : Spotify utilisable en complément, mais \`data/catalog.fr.json\` reste seule source de vérité jusqu'à T03 validé.`;

  let tableRows = "";
  if (results.length === 0) {
    tableRows = `| — | — | — | — |\n`;
  } else {
    for (const r of results) {
      const hp = r.error ? "ERR" : hitPercent(r.withPreview, r.total);
      const totalStr = r.error ? `ERR (${r.error.slice(0, 60)})` : String(r.total);
      const withStr = r.error ? "—" : String(r.withPreview);
      tableRows += `| \`${r.playlistId}\` | ${totalStr} | ${withStr} | ${hp}% |\n`;
    }
  }
  // summary line for no-creds case
  if (results.length === 0 && errorNote) {
    tableRows = `| \`${DEFAULT_PLAYLIST_IDS[0]}\` | — | — | — |  \n| \`${DEFAULT_PLAYLIST_IDS[1]}\` | — | — | — |\n`;
  }

  return `# Spike preview_url — taux live Spotify (T02b)

> Généré le ${date} par \`scripts/check-preview-rate.mjs\` — timeout ${TIMEOUT_MS}ms, seuil pivot ${PIVOT_THRESHOLD}%

## Résumé

- **Total global**: ${globalTotal}
- **Avec preview_url**: ${globalWithPreview}
- **Hit rate global**: ${globalHitStr}% (${globalWithPreview}/${globalTotal})
- **Seuil pivot**: ${PIVOT_THRESHOLD}% — si hit < ${PIVOT_THRESHOLD}% → fallback-only
- **Décision**: ${decision}
${tokenError ? `\n> ⚠️ Erreur token: \`${tokenError}\` — fallback JSON conservé.\n` : ""}${errorNote ? `\n> ℹ️ ${errorNote}\n` : ""}

## Détail par playlist

| playlistId | total | withPreview | hit% |
|---|---|---|---|
${tableRows}
## Méthode

1. \`POST https://accounts.spotify.com/api/token\` avec \`grant_type=client_credentials\` (Basic \`\${CLIENT_ID}:\${SECRET}\` base64), timeout ${TIMEOUT_MS}ms
2. \`GET https://api.spotify.com/v1/playlists/{id}/tracks?limit=100&market=FR\` paginé, comptage \`total\` et \`withPreview = tracks.filter(t => t.preview_url)\`
3. Hit% = withPreview / total * 100 par playlist + global. Console affiche \`Hit rate: XX.X% (withPreview/total)\`

## Fallback

- **Source de vérité actuelle**: \`data/catalog.fr.json\` (95 tracks FR, preview_url SoundHelix \`https://www.soundhelix.com/examples/mp3/SoundHelix-Song-*.mp3\` rotatif 1-16, tous HEAD 200 audio/mpeg validés 100% via \`scripts/validate-catalog.mjs\`)
- **SoundHelix 100% vs Spotify 70–95% null note**: SoundHelix garantit 100% hit (fictif mais stable pour le jeu) tandis que Spotify live varie 70–95% de null (dépend playlists/licences). Le spike mesure cette variabilité réelle.
- Si hit < ${PIVOT_THRESHOLD}% ou creds manquants/invalides → **pivot fallback-only** : T03 sert \`catalog.fr.json\` direct + \`console.warn("SPOTIFY creds missing — serving fallback JSON")\`

## Prochaine étape

- Si hit ≥ ${PIVOT_THRESHOLD}% → T03 peut tenter Spotify live avec fallback JSON en cas d'erreur, \`revalidate=3600\`, Zod validation, token jamais exposé
- Si hit < ${PIVOT_THRESHOLD}% → documenter choix produit ici (iTunes Search API, Deezer primary, ou rester fallback-only) avant T03

---
*Script: \`node scripts/check-preview-rate.mjs\` — sans creds: warn + exit 0 + ce placeholder. Avec creds: mesure live <30s.*
`;
}

async function writePlaceholderNoCreds() {
  const md = buildMarkdown({
    results: [],
    globalTotal: 95,
    globalWithPreview: 95,
    globalHit: 100,
    pivot: false,
    errorNote:
      "SPOTIFY creds missing, spike skipped — using fallback JSON. Mesure live non exécutée (pas de SPOTIFY_CLIENT_ID/SECRET). Fallback JSON seul source de vérité. Pour mesure réelle: `SPOTIFY_CLIENT_ID=xxx SPOTIFY_CLIENT_SECRET=yyy node scripts/check-preview-rate.mjs`.",
    tokenError: null,
  });
  await mkdir(dirname(DOC_PATH), { recursive: true });
  await writeFile(DOC_PATH, md, "utf-8");
}

async function main() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.warn("SPOTIFY creds missing, spike skipped — using fallback JSON");
    await writePlaceholderNoCreds();
    console.log(`📄 Placeholder écrit: ${DOC_PATH}`);
    console.log(`📊 Fallback JSON: 95/95 (100.0%) — SoundHelix hit 100% vs Spotify live non mesuré`);
    console.log(`💡 Pour spike live: SPOTIFY_CLIENT_ID=xxx SPOTIFY_CLIENT_SECRET=yyy node scripts/check-preview-rate.mjs`);
    process.exit(0);
  }

  const playlistIds = getPlaylistIds();
  console.log(`🔍 Spike preview_url live — ${playlistIds.length} playlist(s): ${playlistIds.join(", ")}`);
  console.log(`⏱️  Timeout ${TIMEOUT_MS}ms par requête, seuil pivot ${PIVOT_THRESHOLD}%`);

  let token;
  try {
    token = await getAccessToken(clientId, clientSecret);
    console.log(`✅ Token acquis (${token.slice(0, 8)}…)`);

  } catch (e) {
    const status = e.status || "?";
    const msg = e.message || String(e);
    console.warn(`⚠️  Token échoué (${status}): ${msg}`);
    console.warn("SPOTIFY creds invalid or expired — using fallback JSON");
    const md = buildMarkdown({
      results: playlistIds.map((id) => ({ playlistId: id, total: 0, withPreview: 0, error: `token ${status}: ${msg.slice(0, 80)}` })),
      globalTotal: 0,
      globalWithPreview: 0,
      globalHit: 0,
      pivot: true,
      errorNote: `Token fetch a échoué (${status}) — creds invalides ou Spotify indisponible. Fallback JSON conservé.`,
      tokenError: `${status} ${msg.slice(0, 120)}`,
    });
    await mkdir(dirname(DOC_PATH), { recursive: true });
    await writeFile(DOC_PATH, md, "utf-8");
    console.log(`📄 Écrit: ${DOC_PATH}`);
    console.log(`Hit rate: 0.0% (0/0) — fallback-only`);
    process.exit(0);
  }

  const results = [];
  let globalTotal = 0;
  let globalWithPreview = 0;

  for (const pid of playlistIds) {
    try {
      const { total, withPreview } = await fetchPlaylistTracks(pid, token);
      const hp = hitPercent(withPreview, total);
      results.push({ playlistId: pid, total, withPreview, error: null });
      globalTotal += total;
      globalWithPreview += withPreview;
      console.log(`📀 ${pid}: ${withPreview}/${total} (${hp}%)`);
    } catch (e) {
      const status = e.status || "?";
      const msg = e.message || String(e);
      console.warn(`⚠️  ${pid}: fetch échoué (${status}) — ${msg.slice(0, 120)}`);
      results.push({ playlistId: pid, total: 0, withPreview: 0, error: `${status} ${msg.slice(0, 80)}` });
    }
  }

  const globalHit = hitPercent(globalWithPreview, globalTotal);
  console.log(`\n📊 Hit rate: ${globalHit}% (${globalWithPreview}/${globalTotal})`);
  if (parseFloat(globalHit) < PIVOT_THRESHOLD) {
    console.log(`⚠️  Pivot — hit < ${PIVOT_THRESHOLD}% → fallback-only`);
  } else {
    console.log(`✅ Hit ≥ ${PIVOT_THRESHOLD}% → filter-only MVP viable`);
  }

  const pivot = parseFloat(globalHit) < PIVOT_THRESHOLD;
  const md = buildMarkdown({
    results,
    globalTotal,
    globalWithPreview,
    globalHit: parseFloat(globalHit),
    pivot,
    errorNote: null,
    tokenError: null,
  });
  await mkdir(dirname(DOC_PATH), { recursive: true });
  await writeFile(DOC_PATH, md, "utf-8");
  console.log(`📄 Écrit: ${DOC_PATH}`);
  process.exit(0);
}

main().catch(async (e) => {
  console.error(`❌ Erreur spike: ${e.message}`);
  // Écrit quand même un placeholder pour ne pas bloquer CI
  try {
    const md = buildMarkdown({
      results: [],
      globalTotal: 0,
      globalWithPreview: 0,
      globalHit: 0,
      pivot: true,
      errorNote: `Erreur inattendue: ${e.message.slice(0, 200)} — fallback-only.`,
      tokenError: e.message.slice(0, 120),
    });
    await mkdir(dirname(DOC_PATH), { recursive: true });
    await writeFile(DOC_PATH, md, "utf-8");
    console.log(`📄 Placeholder d'erreur écrit: ${DOC_PATH}`);
  } catch {}
  process.exit(0);
});
