import "server-only";

import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/spotifyAuth";
import { mapSpotifyTrack, isPlayableTrack } from "@/lib/likedMapper";
import type { Track } from "@/lib/catalog";

export const dynamic = "force-dynamic";

const FETCH_TIMEOUT_MS = 5000;

async function fetchWithTimeout(url: string, token: string): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    clearTimeout(t);
    return res;
  } catch (e) {
    clearTimeout(t);
    throw e;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get("limit");
  const offsetParam = searchParams.get("offset");

  let limit = 50;
  if (limitParam) {
    const n = parseInt(limitParam, 10);
    if (!Number.isNaN(n) && n > 0 && n <= 50) limit = n;
  }
  let offset = 0;
  if (offsetParam) {
    const n = parseInt(offsetParam, 10);
    if (!Number.isNaN(n) && n >= 0) offset = n;
  }

  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ error: "Non authentifié — connectez votre compte Spotify" }, { status: 401 });
  }

  const url = `https://api.spotify.com/v1/me/tracks?limit=${limit}&offset=${offset}&market=FR`;

  let res: Response;
  try {
    res = await fetchWithTimeout(url, token);
  } catch (e) {
    console.warn("[liked] fetch error", e);
    return NextResponse.json({ error: "Erreur de connexion à Spotify" }, { status: 502 });
  }

  if (res.status === 401) {
    return NextResponse.json({ error: "Session Spotify expirée — veuillez vous reconnecter" }, { status: 401 });
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.warn(`[liked] Spotify error ${res.status} ${txt.slice(0, 200)}`);
    return NextResponse.json({ error: "Erreur lors du chargement des titres aimés" }, { status: 502 });
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return NextResponse.json({ error: "Réponse Spotify invalide" }, { status: 502 });
  }

  const d = data as Record<string, unknown>;
  const total = typeof d["total"] === "number" ? (d["total"] as number) : null;
  const items = Array.isArray(d["items"]) ? (d["items"] as unknown[]) : [];

  const tracks: Track[] = [];
  let playableCount = 0;

  for (const item of items) {
    const it = item as Record<string, unknown> | null;
    const raw = (it?.["track"] as unknown) ?? null;
    if (!raw || typeof raw !== "object") continue;
    const mapped = mapSpotifyTrack(raw);
    if (!mapped) continue;
    if (isPlayableTrack(mapped)) playableCount++;
    tracks.push(mapped);
  }

  return NextResponse.json(
    { tracks, total, limit, offset, playableCount },
    {
      headers: {
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    },
  );
}
