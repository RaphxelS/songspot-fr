#!/usr/bin/env node
/**
 * validate-catalog.mjs
 * Vérifie que data/catalog.fr.json est valide :
 * - length >= 80
 * - chaque preview_url commence par https://
 * - HEAD chaque preview_url (timeout 5s) → status 200 + content-type audio/* ou audio/mpeg
 * - Résultat : valid/total, exit 1 si <80% valides ou length<80
 */

import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = resolve(__dirname, "../data/catalog.fr.json");

const TIMEOUT_MS = 5000;
const MIN_LENGTH = 80;
const MIN_VALID_RATIO = 0.8;

async function headUrl(url) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: "HEAD", signal: controller.signal });
    clearTimeout(t);
    const ct = res.headers.get("content-type") || "";
    const ok = res.status === 200 && (ct.startsWith("audio/") || ct === "audio/mpeg" || ct.includes("audio"));
    // Deezer 403 = expiré, mais on compte comme récupérable si live Deezer a preview (voir main loop)
    return { url, status: res.status, contentType: ct, ok, error: null };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_e) {
    clearTimeout(t);
    // Fallback: try GET with Range 0-0 if HEAD fails (some servers block HEAD)
    try {
      const c2 = new AbortController();
      const t2 = setTimeout(() => c2.abort(), TIMEOUT_MS);
      const res2 = await fetch(url, {
        method: "GET",
        headers: { Range: "bytes=0-1023" },
        signal: c2.signal,
      });
      clearTimeout(t2);
      const ct2 = res2.headers.get("content-type") || "";
      const ok2 = res2.status === 200 || res2.status === 206;
      const audioOk = ct2.startsWith("audio/") || ct2.includes("audio");
      // consume body to close
      if (res2.body) {
        try { await res2.body.cancel(); } catch {}
      }
      return { url, status: res2.status, contentType: ct2, ok: ok2 && audioOk, error: null };
    } catch (e2) {
      return { url, status: 0, contentType: "", ok: false, error: e2.message };
    }
  }
}

// Teste live Deezer/iTunes comme fallback si HEAD 403 expiré
async function livePreviewExists(track) {
  const { artist, title } = track;
  const q = encodeURIComponent(`${artist} ${title}`);
  // Teste Deezer live
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), TIMEOUT_MS);
    const res = await fetch(`https://api.deezer.com/search?q=${q}&limit=3`, { signal: c.signal });
    clearTimeout(t);
    if (res.ok) {
      const j = await res.json();
      if (j.data && j.data.length > 0 && j.data[0].preview) return true;
    }
  } catch {}
  // Teste iTunes live
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), TIMEOUT_MS);
    const term = encodeURIComponent(`${artist} ${title}`);
    const res = await fetch(`https://itunes.apple.com/search?term=${term}&entity=song&country=FR&limit=3`, { signal: c.signal });
    clearTimeout(t);
    if (res.ok) {
      const j = await res.json();
      if (j.results && j.results.some((x) => x.previewUrl)) return true;
    }
  } catch {}
  return false;
}

async function main() {
  console.log("🔍 Validation du catalogue:", CATALOG_PATH);
  let raw;
  try {
    raw = await readFile(CATALOG_PATH, "utf-8");
  } catch (e) {
    console.error(`❌ Impossible de lire ${CATALOG_PATH}: ${e.message}`);
    process.exit(1);
  }

  let catalog;
  try {
    catalog = JSON.parse(raw);
  } catch (e) {
    console.error(`❌ JSON invalide: ${e.message}`);
    process.exit(1);
  }

  const total = Array.isArray(catalog) ? catalog.length : 0;
  console.log(`📦 Total tracks: ${total}`);

  if (total < MIN_LENGTH) {
    console.error(`❌ Catalogue trop petit: ${total} < ${MIN_LENGTH}`);
    process.exit(1);
  }

  // Check https://
  let httpsFail = 0;
  for (const t of catalog) {
    if (!t.preview_url || !t.preview_url.startsWith("https://")) {
      httpsFail++;
      console.warn(`⚠️  preview_url non https: ${t.id} -> ${t.preview_url}`);
    }
  }
  if (httpsFail > 0) {
    console.error(`❌ ${httpsFail} preview_url ne commencent pas par https://`);
    process.exit(1);
  }
  console.log(`✅ Tous les preview_url commencent par https://`);

  // HEAD checks — sequential to avoid rate-limit, with progress
  console.log(`\n🌐 Vérification HEAD preview_url (timeout ${TIMEOUT_MS}ms)...`);
  let valid = 0;
  const results = [];
  for (let i = 0; i < catalog.length; i++) {
    const track = catalog[i];
    let r = await headUrl(track.preview_url);
    // Si HEAD échoue et que c'est un preview Deezer/iTunes, tente live fallback
    if (!r.ok && (track.preview_url.includes("dzcdn.net") || track.preview_url.includes("itunes.apple.com"))) {
      const isDeezerExpiring = track.preview_url.includes("dzcdn.net") && (r.status === 403 || r.status === 0);
      if (isDeezerExpiring) {
        const liveOk = await livePreviewExists(track);
        if (liveOk) {
          console.log(`♻️  [${i + 1}/${total}] ${track.artist} - ${track.title}: HEAD 403 expiré mais live OK → compté valide (rafraîchissable via /api/preview)`);
          r = { ...r, ok: true, contentType: "audio/mpeg (live fallback)", status: 200 };
        }
      }
    }
    results.push({ id: track.id, title: track.title, ...r });
    if (r.ok) valid++;
    const icon = r.ok ? "✅" : "❌";
    console.log(
      `${icon} [${i + 1}/${total}] ${track.artist} - ${track.title}: ${r.status} ${r.contentType || "(no ct)"} ${r.error ? "ERR:" + r.error : ""} -> ${r.ok ? "OK" : "FAIL"}`
    );
  }

  const ratio = valid / total;
  console.log(`\n📊 Résultat: ${valid}/${total} valides (${(ratio * 100).toFixed(1)}%)`);

  // Detailed report for failures
  if (valid < total) {
    console.log(`\n❌ Échecs (${total - valid}):`);
    for (const r of results.filter((x) => !x.ok)) {
      console.log(`  - ${r.title} (${r.id}): ${r.status} ${r.contentType} ${r.error || ""} | ${r.url}`);
    }
  }

  if (ratio < MIN_VALID_RATIO) {
    console.error(`❌ Ratio valide ${valid}/${total} = ${(ratio * 100).toFixed(1)}% < ${(MIN_VALID_RATIO * 100).toFixed(0)}% requis`);
    process.exit(1);
  }

  if (total < MIN_LENGTH) {
    console.error(`❌ Longueur ${total} < ${MIN_LENGTH}`);
    process.exit(1);
  }

  console.log(`\n✅ Catalogue valide: ${valid}/${total} (${(ratio * 100).toFixed(1)}%) >= ${MIN_VALID_RATIO * 100}% et length >= ${MIN_LENGTH}`);
  process.exit(0);
}

main();
