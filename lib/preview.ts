import "server-only";

/**
 * Preview helpers — server-only iTunes/Deezer live fetching
 * Utilisés par app/api/catalog pour rafraîchir les previews expirés
 * et par scripts/enrich-catalog pour enrichissement offline.
 * Timeout 5s, scoring identique à enrich-catalog.mjs
 */

const ITUNES_TIMEOUT = 5000;
const DEEZER_TIMEOUT = 5000;

function normalizePreview(s: string): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/’/g, "'")
    .replace(/‘/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchWithTimeout(url: string, timeout: number): Promise<Response> {
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

/**
 * Détecte si une URL Deezer est expirée (param hdnea exp=<unix>)
 * exp est en secondes depuis epoch.
 * Si pas de exp, considère non expiré. Si exp < now + 1h, expiré.
 */
export function isDeezerExpired(previewUrl: string): boolean {
  if (!previewUrl || !previewUrl.includes("dzcdn.net")) return false;
  try {
    const m = previewUrl.match(/exp=(\d+)/);
    if (!m) return false;
    const exp = parseInt(m[1], 10);
    if (Number.isNaN(exp)) return false;
    const now = Math.floor(Date.now() / 1000);
    // Expire if < now + 3600 (1h buffer)
    return exp < now + 3600;
  } catch {
    return false;
  }
}

export type PreviewResult = {
  previewUrl: string;
  cover: string | null;
  source: "itunes" | "deezer";
  trackName: string;
  artistName: string;
};

export async function fetchItunesPreview(
  artist: string,
  title: string
): Promise<PreviewResult | null> {
  const term = encodeURIComponent(`${artist} ${title}`);
  const url = `https://itunes.apple.com/search?term=${term}&entity=song&country=FR&limit=5`;
  try {
    const res = await fetchWithTimeout(url, ITUNES_TIMEOUT);
    if (!res.ok) return null;
    const j = (await res.json()) as { results: Array<Record<string, unknown>> };
    if (!j.results || j.results.length === 0) return null;
    const nt = normalizePreview(title);
    const na = normalizePreview(artist.split(/[,&]/)[0].trim());
    let best: Record<string, unknown> | null = null;
    let bestScore = -1;
    for (const tr of j.results) {
      if (!tr["previewUrl"]) continue;
      const tn = normalizePreview((tr["trackName"] as string) || "");
      const an = normalizePreview((tr["artistName"] as string) || "");
      let titleScore = 0;
      if (tn === nt) titleScore = 3;
      else if (tn.includes(nt) || nt.includes(tn)) titleScore = 2;
      else if (nt.length >= 4 && tn.includes(nt.slice(0, 4))) titleScore = 1;
      else continue;
      let artistScore = 0;
      if (an === na) artistScore = 3;
      else if (an.includes(na) || na.includes(an)) artistScore = 2;
      else if (na.split(" ")[0] && an.includes(na.split(" ")[0])) artistScore = 1;
      if (artistScore === 0) continue;
      if (titleScore === 1 && artistScore === 0) continue;
      let score = titleScore + artistScore;
      if (titleScore >= 2 && artistScore >= 1) score += 1;
      if (score > bestScore) {
        bestScore = score;
        best = tr;
      }
    }
    if (best && bestScore >= 3) {
      const cover100 = (best["artworkUrl100"] as string) || (best["artworkUrl60"] as string) || null;
      const cover = cover100
        ? cover100.replace(/100x100bb/g, "600x600bb").replace(/60x60bb/g, "600x600bb")
        : null;
      return {
        previewUrl: best["previewUrl"] as string,
        cover,
        source: "itunes",
        trackName: best["trackName"] as string,
        artistName: best["artistName"] as string,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchDeezerPreview(
  artist: string,
  title: string
): Promise<PreviewResult | null> {
  const q = encodeURIComponent(`${artist} ${title}`);
  const url = `https://api.deezer.com/search?q=${q}&limit=5`;
  try {
    const res = await fetchWithTimeout(url, DEEZER_TIMEOUT);
    if (!res.ok) return null;
    const j = (await res.json()) as {
      data: Array<Record<string, unknown>>;
    };
    if (!j.data || j.data.length === 0) return null;
    const nt = normalizePreview(title);
    const na = normalizePreview(artist.split(/[,&]/)[0].trim());
    let best: Record<string, unknown> | null = null;
    let bestScore = -1;
    for (const tr of j.data) {
      if (!tr["preview"]) continue;
      const tn = normalizePreview((tr["title"] as string) || "");
      const artistObj = tr["artist"] as Record<string, unknown> | undefined;
      const an = normalizePreview((artistObj?.["name"] as string) || "");
      let titleScore = 0;
      if (tn === nt) titleScore = 3;
      else if (tn.includes(nt) || nt.includes(tn)) titleScore = 2;
      else if (nt.length >= 4 && tn.includes(nt.slice(0, 4))) titleScore = 1;
      else continue;
      let artistScore = 0;
      if (an === na) artistScore = 3;
      else if (an.includes(na) || na.includes(an)) artistScore = 2;
      else if (na.split(" ")[0] && an.includes(na.split(" ")[0])) artistScore = 1;
      if (artistScore === 0) continue;
      if (titleScore === 1 && artistScore === 0) continue;
      let score = titleScore + artistScore;
      if (titleScore >= 2 && artistScore >= 1) score += 1;
      const rank = tr["rank"] as number | undefined;
      if (typeof rank === "number") score += Math.min(1, rank / 800000);
      if (score > bestScore) {
        bestScore = score;
        best = tr;
      }
    }
    if (best && bestScore >= 3) {
      const album = best["album"] as Record<string, unknown> | undefined;
      const cover =
        (album?.["cover_big"] as string) ||
        (album?.["cover_medium"] as string) ||
        (album?.["cover"] as string) ||
        null;
      return {
        previewUrl: best["preview"] as string,
        cover,
        source: "deezer",
        trackName: best["title"] as string,
        artistName: (best["artist"] as Record<string, unknown>)?.["name"] as string,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Tente iTunes puis Deezer pour un couple artist/title.
 * Retourne null si rien trouvé.
 */
export async function fetchBestPreview(
  artist: string,
  title: string
): Promise<PreviewResult | null> {
  const it = await fetchItunesPreview(artist, title);
  if (it) return it;
  // petit délai avant Deezer pour éviter burst
  await new Promise((r) => setTimeout(r, 200));
  return fetchDeezerPreview(artist, title);
}

/**
 * Rafraîchit un catalogue en remplaçant les previews Deezer expirés
 * Prend jusqu'à maxRefresh entrées pour limiter le temps de requête API (revalidate 3600).
 */
export async function refreshCatalogPreviews<T extends { preview_url: string; artist: string; title: string; cover: string; source?: string }>(
  tracks: T[],
  maxRefresh = 10
): Promise<T[]> {
  // En test (vitest), pas de fetch live pour éviter flakiness et timeouts — retourne tel quel
  if (process.env.VITEST || process.env.NODE_ENV === "test") {
    return tracks;
  }
  let refreshed = 0;
  const out: T[] = [];
  for (const t of tracks) {
    if (isDeezerExpired(t.preview_url) || !t.preview_url || t.preview_url.includes("soundhelix.com")) {
      if (refreshed >= maxRefresh) {
        out.push(t);
        continue;
      }
      const fresh = await fetchBestPreview(t.artist, t.title);
      refreshed++;
      if (fresh) {
        out.push({
          ...t,
          preview_url: fresh.previewUrl,
          cover: fresh.cover || t.cover,
          source: fresh.source,
        } as T);
      } else {
        out.push(t);
      }
      // anti-burst
      await new Promise((r) => setTimeout(r, 250));
    } else {
      out.push(t);
    }
  }
  if (refreshed > 0) console.warn(`[preview] refreshed ${refreshed} expired previews`);
  return out;
}
