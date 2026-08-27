/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("server-only", () => ({}));

describe("GET /api/catalog — route handler (T03)", () => {
  const originalEnv = { ...process.env };
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("route exporte revalidate=3600 et dynamic='force-dynamic'", () => {
    const content = readFileSync(resolve("app/api/catalog/route.ts"), "utf-8");
    expect(content).toContain("export const revalidate = 3600");
    expect(content).toContain('export const dynamic = "force-dynamic"');
  });

  it("route contient Cache-Control public, s-maxage=3600, stale-while-revalidate=86400", () => {
    const content = readFileSync(resolve("app/api/catalog/route.ts"), "utf-8");
    expect(content).toContain("Cache-Control");
    expect(content).toContain("public, s-maxage=3600, stale-while-revalidate=86400");
  });

  it("route ne contient pas access_token (token jamais exposé)", () => {
    const content = readFileSync(resolve("app/api/catalog/route.ts"), "utf-8");
    // Le mot access_token ne doit apparaître que côté serveur (spotify.ts), pas dans la réponse
    // On vérifie que route.ts ne renvoie jamais access_token dans NextResponse.json
    expect(content).not.toMatch(/NextResponse\.json.*access_token/);
    expect(content).not.toMatch(/return.*access_token/);
    // Mais doit fallback vers catalogFallback
    expect(content).toContain("catalogFallback");
  });

  it("sans creds → fallback JSON, 200, Cache-Control, sans token", async () => {
    delete process.env.SPOTIFY_CLIENT_ID;
    delete process.env.SPOTIFY_CLIENT_SECRET;

    // Mock spotify pour s'assurer qu'on ne call pas Spotify
    vi.doMock("@/lib/spotify", () => ({
      fetchAllCatalog: vi.fn().mockResolvedValue([]),
    }));

    const { GET } = await import("@/app/api/catalog/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const cc = res.headers.get("Cache-Control");
    expect(cc).toBe("public, s-maxage=3600, stale-while-revalidate=86400");
    const data = (await res.json()) as unknown[];
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(80);
    // pas de token
    const json = JSON.stringify(data);
    expect(json).not.toContain("access_token");
    // chaque track a preview_url https
    for (const t of data as Array<Record<string, unknown>>) {
      expect(typeof t["preview_url"]).toBe("string");
      expect((t["preview_url"] as string).startsWith("https://")).toBe(true);
    }
  });

  it("avec creds mais fetchAllCatalog vide → fallback JSON + warn", async () => {
    process.env.SPOTIFY_CLIENT_ID = "id";
    process.env.SPOTIFY_CLIENT_SECRET = "secret";
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.doMock("@/lib/spotify", () => ({
      fetchAllCatalog: vi.fn().mockResolvedValue([]),
    }));

    const { GET } = await import("@/app/api/catalog/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const data = (await res.json()) as unknown[];
    expect(data.length).toBeGreaterThanOrEqual(80);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("empty"));
    warnSpy.mockRestore();
  });

  it("avec creds mais fetchAllCatalog throw → fallback JSON + warn", async () => {
    process.env.SPOTIFY_CLIENT_ID = "id";
    process.env.SPOTIFY_CLIENT_SECRET = "secret";
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.doMock("@/lib/spotify", () => ({
      fetchAllCatalog: vi.fn().mockRejectedValue(new Error("network fail")),
    }));

    const { GET } = await import("@/app/api/catalog/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const data = (await res.json()) as unknown[];
    expect(data.length).toBeGreaterThanOrEqual(80);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("avec creds et tracks valides → retourne live catalog validé Zod, Cache-Control", async () => {
    process.env.SPOTIFY_CLIENT_ID = "id";
    process.env.SPOTIFY_CLIENT_SECRET = "secret";
    const liveTracks = [
      {
        id: "live1",
        title: "Live Title",
        artist: "Live Artist",
        album: "Live Album",
        cover: "https://i.scdn.co/image/ab67616d0000b273live1",
        preview_url: "https://p.scdn.co/mp3-preview/live1",
        popularity: 90,
        release_date: "2022-03-15",
        era: "2020s",
        source: "spotify",
      },
      {
        id: "live2",
        title: "Live Title 2",
        artist: "Live Artist 2",
        album: "Live Album 2",
        cover: "https://i.scdn.co/image/ab67616d0000b273live2",
        preview_url: "https://p.scdn.co/mp3-preview/live2",
        popularity: 45,
        release_date: "2010-07-01",
        era: "2010s",
        source: "spotify",
      },
    ];
    // Pad to 80 to pass CatalogSchema min(80) — on duplique avec ids uniques
    const padded = [...liveTracks];
    while (padded.length < 80) {
      const i = padded.length;
      padded.push({
        id: `live-pad-${i}`,
        title: `Pad ${i}`,
        artist: `Artist ${i}`,
        album: `Album ${i}`,
        cover: `https://i.scdn.co/image/ab67616d0000b273pad${i}`,
        preview_url: `https://p.scdn.co/mp3-preview/pad${i}`,
        popularity: 50 + (i % 50),
        release_date: "2021-01-01",
        era: "2020s",
        source: "spotify",
      });
    }

    vi.doMock("@/lib/spotify", () => ({
      fetchAllCatalog: vi.fn().mockResolvedValue(padded),
    }));

    const { GET } = await import("@/app/api/catalog/route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=3600, stale-while-revalidate=86400");
    const data = (await res.json()) as typeof padded;
    expect(data.length).toBe(80);
    expect(data[0].id).toBe("live1");
    // token jamais exposé
    expect(JSON.stringify(data)).not.toContain("access_token");
    // Zod aurait validé : popularity 0-100, preview_url https
    for (const t of data) {
      expect(t.popularity).toBeGreaterThanOrEqual(0);
      expect(t.popularity).toBeLessThanOrEqual(100);
      expect(t.preview_url.startsWith("https://")).toBe(true);
    }
  });

  it("Zod invalide (popularity hors borne / preview http) → fallback", async () => {
    process.env.SPOTIFY_CLIENT_ID = "id";
    process.env.SPOTIFY_CLIENT_SECRET = "secret";
    const invalidTracks = Array.from({ length: 80 }, (_, i) => ({
      id: `inv${i}`,
      title: `Title ${i}`,
      artist: `Artist ${i}`,
      album: `Album ${i}`,
      cover: "https://i.scdn.co/image/ab67616d0000b273cover",
      preview_url: "http://example.com/audio.mp3", // http invalide
      popularity: 150, // hors borne
      release_date: "2020-01-01",
      era: "2020s",
      source: "spotify",
    }));
    vi.doMock("@/lib/spotify", () => ({
      fetchAllCatalog: vi.fn().mockResolvedValue(invalidTracks),
    }));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { GET } = await import("@/app/api/catalog/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const data = (await res.json()) as unknown[];
    // Doit fallback vers catalog.fr.json (95) car Zod échoue
    expect(data.length).toBe(95);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Zod"), expect.anything());
    warnSpy.mockRestore();
  });

  it("SPOTIFY_PLAYLIST_IDS csv override est géré via constants (fichier contient logique)", () => {
    const constContent = readFileSync(resolve("lib/constants.ts"), "utf-8");
    expect(constContent).toContain("SPOTIFY_PLAYLIST_IDS");
    const spotifyContent = readFileSync(resolve("lib/spotify.ts"), "utf-8");
    expect(spotifyContent).toContain("PLAYLIST_IDS");
    expect(spotifyContent).toContain('from "@/lib/constants"');
  });

  it("fallback JSON est importé depuis @/data/catalog.fr.json et a length 95", async () => {
    const catalog = (await import("@/data/catalog.fr.json")).default as unknown[];
    expect(catalog.length).toBe(95);
    const routeContent = readFileSync(resolve("app/api/catalog/route.ts"), "utf-8");
    expect(routeContent).toContain('from "@/data/catalog.fr.json"');
    expect(routeContent).toContain("catalogFallback");
  });

  it("GET sans creds retourne Content-Type application/json (via NextResponse.json)", async () => {
    delete process.env.SPOTIFY_CLIENT_ID;
    delete process.env.SPOTIFY_CLIENT_SECRET;
    vi.doMock("@/lib/spotify", () => ({
      fetchAllCatalog: vi.fn(),
    }));
    const { GET } = await import("@/app/api/catalog/route");
    const res = await GET();
    const ct = res.headers.get("Content-Type");
    // NextResponse.json met application/json
    expect(ct).toMatch(/application\/json/);
  });
});
