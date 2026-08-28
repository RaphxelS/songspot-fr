#!/usr/bin/env node
/**
 * enrich-catalog.mjs — Remplace SoundHelix/placehold par vrais previews iTunes/Deezer
 * - Priorité iTunes (stable aac, previewUrl durable) → fallback Deezer (mp3, preview signé ~1 mois)
 * - Met à jour cover via iTunes artwork ou Deezer cover_big
 * - Conserve id/title/artist/album/popularity/release_date/era mais remplace preview_url/cover/source
 * - Rate-limited, scoring normalisé (œ→oe, æ→ae, NFD)
 * Usage: node scripts/enrich-catalog.mjs [--dry-run] [--force]
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = resolve(__dirname, "../data/catalog.fr.json");

const ITUNES_TIMEOUT = 6000;
const DEEZER_TIMEOUT = 6000;

function normalize(s) {
  if (!s) return "";
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/Œ/g, "oe")
    .replace(/Æ/g, "ae")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchWithTimeout(url, timeout) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeout);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { "User-Agent": "SongspotFR/1.0" } });
    clearTimeout(t);
    return r;
  } catch (e) {
    clearTimeout(t);
    throw e;
  }
}

async function searchItunes(artist, title) {
  const term = encodeURIComponent(`${artist} ${title}`);
  const url = `https://itunes.apple.com/search?term=${term}&entity=song&country=FR&limit=5`;
  try {
    const res = await fetchWithTimeout(url, ITUNES_TIMEOUT);
    if (!res.ok) return null;
    const j = await res.json();
    if (!j.results || j.results.length === 0) return null;
    const nt = normalize(title);
    const na = normalize(artist.split(/[,&]/)[0].trim());
    // Scoring
    let best = null;
    let bestScore = -1;
    for (const tr of j.results) {
      if (!tr.previewUrl) continue;
      const tn = normalize(tr.trackName || "");
      const an = normalize(tr.artistName || "");
      // REQUIRE title match — skip if no title similarity
      let titleScore = 0;
      if (tn === nt) titleScore = 3;
      else if (tn.includes(nt) || nt.includes(tn)) titleScore = 2;
      else if (nt.length >= 4 && tn.includes(nt.slice(0, 4))) titleScore = 1;
      else continue; // no title match at all → discard
      let artistScore = 0;
      if (an === na) artistScore = 3;
      else if (an.includes(na) || na.includes(an)) artistScore = 2;
      else if (na.split(" ")[0] && an.includes(na.split(" ")[0])) artistScore = 1;
      else if (na.length >= 4 && an.includes(na.slice(0, 4))) artistScore = 1;
      // Must have at least some artist match — require artist for generic titles
      if (artistScore === 0) continue;
      // Must have at least some artist match if title is weak
      if (titleScore === 1 && artistScore === 0) continue;
      let score = titleScore + artistScore;
      if (titleScore >= 2 && artistScore >= 1) score += 1; // bonus for both matching
      if (score > bestScore) {
        bestScore = score;
        best = tr;
      }
    }
    if (best && bestScore >= 3) return best;
    // Fallback: if no good title+artist match, try title-only search if first query poor
    // Attempt second query with title only
    if (!best || bestScore < 4) {
      // Try title-only query as fallback for strict failures (e.g. Gazo Die)
      // Only if first best was weak
      const term2 = encodeURIComponent(title);
      const url2 = `https://itunes.apple.com/search?term=${term2}&entity=song&country=FR&limit=5`;
      try {
        const res2 = await fetchWithTimeout(url2, ITUNES_TIMEOUT);
        if (res2.ok) {
          const j2 = await res2.json();
          let best2 = null;
          let bestScore2 = -1;
          for (const tr of j2.results || []) {
            if (!tr.previewUrl) continue;
            const tn = normalize(tr.trackName || "");
            const an = normalize(tr.artistName || "");
            let titleScore = 0;
            if (tn === nt) titleScore = 3;
            else if (tn.includes(nt) || nt.includes(tn)) titleScore = 2;
            else if (nt.length >= 4 && tn.includes(nt.slice(0, 4))) titleScore = 1;
            else continue;
            let artistScore = 0;
            if (an.includes(na) || na.includes(an)) artistScore = 2;
            else if (an === na) artistScore = 3;
            if (artistScore === 0) continue;
            if (titleScore === 1 && artistScore === 0) continue;
            let score = titleScore + artistScore;
            if (titleScore >= 2 && artistScore >= 1) score += 1;
            if (score > bestScore2) {
              bestScore2 = score;
              best2 = tr;
            }
          }
          if (best2 && bestScore2 >= 4) return best2;
        }
      } catch {}
    }
    if (best && bestScore >= 3) return best;
    return null;
  } catch (e) {
    console.warn(`  iTunes error ${artist} - ${title}: ${e.message}`);
    return null;
  }
}

async function searchDeezer(artist, title) {
  const q = encodeURIComponent(`${artist} ${title}`);
  const url = `https://api.deezer.com/search?q=${q}&limit=5`;
  try {
    const res = await fetchWithTimeout(url, DEEZER_TIMEOUT);
    if (!res.ok) return null;
    const j = await res.json();
    if (!j.data || j.data.length === 0) return null;
    const nt = normalize(title);
    const na = normalize(artist.split(/[,&]/)[0].trim());
    let best = null;
    let bestScore = -1;
    for (const tr of j.data) {
      if (!tr.preview) continue;
      const tn = normalize(tr.title || "");
      const an = normalize(tr.artist?.name || "");
      let titleScore = 0;
      if (tn === nt) titleScore = 3;
      else if (tn.includes(nt) || nt.includes(tn)) titleScore = 2;
      else if (nt.length >= 4 && tn.includes(nt.slice(0, 4))) titleScore = 1;
      else continue;
      let artistScore = 0;
      if (an === na) artistScore = 3;
      else if (an.includes(na) || na.includes(an)) artistScore = 2;
      else if (na.split(" ")[0] && an.includes(na.split(" ")[0])) artistScore = 1;
      else if (na.length >= 4 && an.includes(na.slice(0, 4))) artistScore = 1;
      if (artistScore === 0) continue;
      if (titleScore === 1 && artistScore === 0) continue;
      // Deezer rank bonus (higher rank = more relevant)
      let score = titleScore + artistScore;
      if (titleScore >= 2 && artistScore >= 1) score += 1;
      if (typeof tr.rank === "number") score += Math.min(1, tr.rank / 800000);
      if (score > bestScore) {
        bestScore = score;
        best = tr;
      }
    }
    if (best && bestScore >= 3) return best;
    // fallback title-only
    if (!best || bestScore < 4) {
      const q2 = encodeURIComponent(title);
      const url2 = `https://api.deezer.com/search?q=${q2}&limit=5`;
      try {
        const res2 = await fetchWithTimeout(url2, DEEZER_TIMEOUT);
        if (res2.ok) {
          const j2 = await res2.json();
          let best2 = null;
          let bestScore2 = -1;
          for (const tr of j2.data || []) {
            if (!tr.preview) continue;
            const tn = normalize(tr.title || "");
            const an = normalize(tr.artist?.name || "");
            let titleScore = 0;
            if (tn === nt) titleScore = 3;
            else if (tn.includes(nt) || nt.includes(tn)) titleScore = 2;
            else if (nt.length >= 4 && tn.includes(nt.slice(0, 4))) titleScore = 1;
            else continue;
            let artistScore = 0;
            if (an.includes(na) || na.includes(an)) artistScore = 2;
            else if (an === na) artistScore = 3;
            if (artistScore === 0) continue;
            if (titleScore === 1 && artistScore === 0) continue;
            let score = titleScore + artistScore;
            if (titleScore >= 2 && artistScore >= 1) score += 1;
            if (score > bestScore2) {
              bestScore2 = score;
              best2 = tr;
            }
          }
          if (best2 && bestScore2 >= 4) return best2;
        }
      } catch {}
    }
    if (best && bestScore >= 3) return best;
    return null;
  } catch (e) {
    console.warn(`  Deezer error ${artist} - ${title}: ${e.message}`);
    return null;
  }
}

function itunesCover(url100) {
  if (!url100) return null;
  // upgrade 100x100bb to 600x600bb (or 300)
  return url100.replace(/100x100bb/g, "600x600bb").replace(/60x60bb/g, "600x600bb").replace(/30x30bb/g, "600x600bb");
}

async function enrichOne(track, idx, total) {
  const { title, artist } = track;
  console.log(`[${idx + 1}/${total}] ${artist} - ${title}`);
  // Try iTunes first
  const it = await searchItunes(artist, title);
  if (it && it.previewUrl) {
    const newCover = itunesCover(it.artworkUrl100 || it.artworkUrl60) || track.cover;
    console.log(`  ✓ iTunes: ${it.trackName} — ${it.artistName} | preview ${it.previewUrl.slice(0, 60)}...`);
    return {
      ...track,
      preview_url: it.previewUrl,
      cover: newCover,
      source: "itunes",
      // enrich album if needed
      album: track.album && track.album !== "Unknown" ? track.album : (it.collectionName || track.album),
    };
  }
  console.log(`  iTunes miss, trying Deezer...`);
  await new Promise((r) => setTimeout(r, 400));
  const dz = await searchDeezer(artist, title);
  if (dz && dz.preview) {
    const newCover = dz.album?.cover_big || dz.album?.cover_medium || dz.album?.cover || track.cover;
    // Deezer cover_big is 500x500, good
    console.log(`  ✓ Deezer: ${dz.title} — ${dz.artist.name} | preview ${dz.preview.slice(0, 60)}...`);
    return {
      ...track,
      preview_url: dz.preview,
      cover: newCover,
      source: "deezer",
      album: track.album && track.album !== "Unknown" ? track.album : (dz.album?.title || track.album),
    };
  }
  console.warn(`  ✗ No preview found for ${artist} - ${title}, keeping original (will be flagged)`);
  return track;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");

  console.log(`Catalog: ${CATALOG_PATH}`);
  let raw;
  try {
    raw = await readFile(CATALOG_PATH, "utf-8");
  } catch (e) {
    console.error(`Cannot read catalog: ${e.message}`);
    process.exit(1);
  }
  const catalog = JSON.parse(raw);
  console.log(`Loaded ${catalog.length} tracks`);
  // check if already enriched
  const alreadyReal = catalog.filter((t) => !t.preview_url.includes("soundhelix.com")).length;
  console.log(`Already real previews: ${alreadyReal}/${catalog.length}`);
  if (alreadyReal > catalog.length * 0.8 && !force) {
    console.log(`Catalog already looks enriched (${alreadyReal} real). Use --force to re-enrich.`);
    // still continue validation
    if (!dryRun) {
      // optionally just validate
    }
  }

  const enriched = [];
  let itunesHits = 0;
  let deezerHits = 0;
  let misses = 0;

  // Sequential with small concurrency to respect rate limits: process 1 by 1 with delay
  for (let i = 0; i < catalog.length; i++) {
    const track = catalog[i];
    // If already real and not force, skip? But we force re-check if soundhelix?
    // Only enrich if soundhelix or placehold
    const needsEnrich = force || track.preview_url.includes("soundhelix.com") || track.cover.includes("placehold.co");
    if (!needsEnrich) {
      enriched.push(track);
      if (track.source === "itunes") itunesHits++;
      else if (track.source === "deezer") deezerHits++;
      continue;
    }
    const updated = await enrichOne(track, i, catalog.length);
    if (updated.source === "itunes") itunesHits++;
    else if (updated.source === "deezer") deezerHits++;
    else misses++;

    enriched.push(updated);
    // Rate limiting: 350ms between tracks + extra after each
    if (i < catalog.length - 1) await new Promise((r) => setTimeout(r, 350));
    // Every 10, longer pause
    if ((i + 1) % 10 === 0) {
      console.log(`--- pause ${i + 1}/${catalog.length} ---`);
      await new Promise((r) => setTimeout(r, 800));
    }
  }

  console.log(`\n=== Résultat ===`);
  console.log(`Total: ${enriched.length}`);
  console.log(`iTunes: ${itunesHits}`);
  console.log(`Deezer: ${deezerHits}`);
  console.log(`Miss (kept original): ${misses}`);
  console.log(`Unique previews: ${new Set(enriched.map((t) => t.preview_url)).size}`);
  console.log(`Unique covers: ${new Set(enriched.map((t) => t.cover)).size}`);

  const disc = enriched.filter((t) => t.preview_url.includes("soundhelix.com")).length;
  if (disc > 0) console.warn(`⚠️ Still ${disc} SoundHelix placeholders remain!`);

  if (dryRun) {
    console.log(`Dry-run: not writing`);
    return;
  }

  // Backup? Write file
  await writeFile(CATALOG_PATH, JSON.stringify(enriched, null, 2), "utf-8");
  console.log(`✓ Written to ${CATALOG_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
