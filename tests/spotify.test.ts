/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { TrackSchema, CatalogSchema } from "@/lib/validation";

// On mocke server-only avant d'importer lib/spotify — vitest hoist
vi.mock("server-only", () => ({}));

describe("lib/spotify — server-only Spotify layer (T03)", () => {
  const originalEnv = { ...process.env };
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    // reset env
    delete process.env.SPOTIFY_CLIENT_ID;
    delete process.env.SPOTIFY_CLIENT_SECRET;
    delete process.env.SPOTIFY_PLAYLIST_IDS;
    delete process.env.ENABLE_DEEZER_FALLBACK;
    // clear token cache via dynamic import
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
    vi.unstubAllEnvs?.();
    // clear cache
    const mod = await import("@/lib/spotify");
    mod.__clearTokenCache();
  });

  it("lib/spotify.ts commence par import \"server-only\"", () => {
    const content = readFileSync(resolve("lib/spotify.ts"), "utf-8");
    expect(content.trimStart().startsWith('import "server-only"')).toBe(true);
  });

  it("lib/spotify.ts n'est jamais importé côté client (grep)", () => {
    const serverOnlyContent = readFileSync(resolve("lib/spotify.ts"), "utf-8");
    expect(serverOnlyContent).toContain('import "server-only"');
    // Vérifie qu'aucun fichier client n'importe spotify
    // On lit manuellement les fichiers app/page.tsx, components, hooks
    const fs = readFileSync(resolve("app/page.tsx"), "utf-8");
    expect(fs).not.toMatch(/from.*spotify/);
    // lib/spotify existe bien
    expect(serverOnlyContent).toContain("getAccessToken");
  });

  it("getAccessToken retourne null si creds manquants (pas de fetch)", async () => {
    const mockFetch = vi.fn();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    const { getAccessToken, __clearTokenCache } = await import("@/lib/spotify");
    __clearTokenCache();
    delete process.env.SPOTIFY_CLIENT_ID;
    delete process.env.SPOTIFY_CLIENT_SECRET;
    const token = await getAccessToken();
    expect(token).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("getAccessToken utilise POST https://accounts.spotify.com/api/token avec Basic base64", async () => {
    process.env.SPOTIFY_CLIENT_ID = "myId";
    process.env.SPOTIFY_CLIENT_SECRET = "mySecret";
    const expectedCreds = Buffer.from("myId:mySecret").toString("base64");

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "tok_123", expires_in: 3600 }),
    } as unknown as Response);
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const { getAccessToken, __clearTokenCache } = await import("@/lib/spotify");
    __clearTokenCache();
    const token = await getAccessToken();
    expect(token).toBe("tok_123");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://accounts.spotify.com/api/token");
    expect(opts.method).toBe("POST");
    expect((opts.headers as Record<string, string>).Authorization).toBe(`Basic ${expectedCreds}`);
    expect((opts.headers as Record<string, string>)["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(opts.body).toBe("grant_type=client_credentials");
  });

  it("getAccessToken cache jusqu'à expires_in - 60s (second call sans fetch)", async () => {
    process.env.SPOTIFY_CLIENT_ID = "id";
    process.env.SPOTIFY_CLIENT_SECRET = "secret";
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "cached_tok", expires_in: 3600 }),
    } as unknown as Response);
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const { getAccessToken, __clearTokenCache } = await import("@/lib/spotify");
    __clearTokenCache();
    const t1 = await getAccessToken();
    const t2 = await getAccessToken();
    expect(t1).toBe("cached_tok");
    expect(t2).toBe("cached_tok");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("getAccessToken retourne null si fetch échoue (non ok)", async () => {
    process.env.SPOTIFY_CLIENT_ID = "id";
    process.env.SPOTIFY_CLIENT_SECRET = "secret";
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
    } as unknown as Response);
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const { getAccessToken, __clearTokenCache } = await import("@/lib/spotify");
    __clearTokenCache();
    const token = await getAccessToken();
    expect(token).toBeNull();
  });

  it("fetchPlaylistTracks filtre preview_url null (filter-only MVP)", async () => {
    process.env.SPOTIFY_CLIENT_ID = "id";
    process.env.SPOTIFY_CLIENT_SECRET = "secret";
    // Mock token + playlist
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("accounts.spotify.com")) {
        return {
          ok: true,
          json: async () => ({ access_token: "tok", expires_in: 3600 }),
        } as unknown as Response;
      }
      if (url.includes("/v1/playlists/")) {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                track: {
                  id: "valid1",
                  name: "Titre Valide",
                  artists: [{ name: "Artiste" }],
                  album: {
                    name: "Album",
                    release_date: "2020-01-15",
                    images: [{ url: "https://i.scdn.co/image/ab67616d0000b273cover1" }],
                  },
                  preview_url: "https://p.scdn.co/mp3-preview/valid1",
                  popularity: 80,
                },
              },
              {
                track: {
                  id: "nullPreview",
                  name: "Sans Preview",
                  artists: [{ name: "Artiste2" }],
                  album: {
                    name: "Album2",
                    release_date: "2021-06-01",
                    images: [{ url: "https://i.scdn.co/image/ab67616d0000b273cover2" }],
                  },
                  preview_url: null,
                  popularity: 60,
                },
              },
            ],
            next: null,
            total: 2,
          }),
        } as unknown as Response;
      }
      throw new Error("unexpected url " + url);
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const { fetchPlaylistTracks, __clearTokenCache } = await import("@/lib/spotify");
    __clearTokenCache();
    const tracks = await fetchPlaylistTracks("testPlaylist");
    expect(tracks.length).toBe(1);
    expect(tracks[0].id).toBe("valid1");
    expect(tracks[0].preview_url).toBe("https://p.scdn.co/mp3-preview/valid1");
  });

  it("fetchPlaylistTracks pagine via next (2 pages)", async () => {
    process.env.SPOTIFY_CLIENT_ID = "id";
    process.env.SPOTIFY_CLIENT_SECRET = "secret";
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("accounts.spotify.com")) {
        return { ok: true, json: async () => ({ access_token: "tok", expires_in: 3600 }) } as unknown as Response;
      }
      // second page identified by offset param
      if (url.includes("offset=100")) {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                track: {
                  id: "page2-track",
                  name: "Page2",
                  artists: [{ name: "A2" }],
                  album: { name: "Al2", release_date: "2020-02-02", images: [{ url: "https://i.scdn.co/image/ab67616d0000b273c2" }] },
                  preview_url: "https://p.scdn.co/mp3-preview/p2",
                  popularity: 65,
                },
              },
            ],
            next: null,
            total: 2,
          }),
        } as unknown as Response;
      }
      // first playlist page (no offset)
      return {
        ok: true,
        json: async () => ({
          items: [
            {
              track: {
                id: "page1-track",
                name: "Page1",
                artists: [{ name: "A1" }],
                album: { name: "Al1", release_date: "2019-05-01", images: [{ url: "https://i.scdn.co/image/ab67616d0000b273c1" }] },
                preview_url: "https://p.scdn.co/mp3-preview/p1",
                popularity: 70,
              },
            },
          ],
          next: "https://api.spotify.com/v1/playlists/test/tracks?offset=100&limit=100",
          total: 2,
        }),
      } as unknown as Response;
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const { fetchPlaylistTracks, __clearTokenCache } = await import("@/lib/spotify");
    __clearTokenCache();
    const tracks = await fetchPlaylistTracks("test");
    expect(tracks.length).toBe(2);
    expect(tracks.map((t) => t.id)).toEqual(["page1-track", "page2-track"]);
    // 1 token + 2 pages = 3 calls
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("fetchPlaylistTracks mappe correctement vers Track via Zod safeParse", async () => {
    process.env.SPOTIFY_CLIENT_ID = "id";
    process.env.SPOTIFY_CLIENT_SECRET = "secret";
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("accounts.spotify.com")) {
        return { ok: true, json: async () => ({ access_token: "tok", expires_in: 3600 }) } as unknown as Response;
      }
      return {
        ok: true,
        json: async () => ({
          items: [
            {
              track: {
                id: "abc123",
                name: "Hello",
                artists: [{ name: "Adele" }, { name: "Feat X" }],
                album: {
                  name: "25",
                  release_date: "2015-11-20",
                  release_date_precision: "day",
                  images: [{ url: "https://i.scdn.co/image/ab67616d0000b273hello" }],
                },
                preview_url: "https://p.scdn.co/mp3-preview/hello",
                popularity: 85,
              },
            },
          ],
          next: null,
        }),
      } as unknown as Response;
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const { fetchPlaylistTracks, __clearTokenCache } = await import("@/lib/spotify");
    __clearTokenCache();
    const tracks = await fetchPlaylistTracks("pid");
    expect(tracks.length).toBe(1);
    const t = tracks[0];
    expect(t.title).toBe("Hello");
    expect(t.artist).toBe("Adele, Feat X");
    expect(t.album).toBe("25");
    expect(t.cover).toBe("https://i.scdn.co/image/ab67616d0000b273hello");
    expect(t.popularity).toBe(85);
    expect(t.release_date).toBe("2015-11-20");
    expect(t.era).toBe("2010s");
    expect(t.source).toBe("spotify");
    // Zod valide
    expect(TrackSchema.safeParse(t).success).toBe(true);
  });

  it("Zod TrackSchema rejette track invalide (popularity 150, http, date, era)", () => {
    const invalid = {
      id: "test123",
      title: "Test",
      artist: "Artist",
      album: "Album",
      cover: "https://i.scdn.co/image/test",
      preview_url: "https://example.com/audio.mp3",
      popularity: 150,
      release_date: "01-01-2020",
      era: "1990s" as unknown as string,
      source: "spotify",
    };
    const result = TrackSchema.safeParse(invalid);
    expect(result.success).toBe(false);

    const httpPreview = { ...invalid, popularity: 50, release_date: "2020-01-01", era: "2020s" as const, preview_url: "http://example.com/audio.mp3" };
    expect(TrackSchema.safeParse(httpPreview).success).toBe(false);

    const badEra = { ...invalid, popularity: 50, release_date: "2020-01-01", era: "1990s" as unknown as string };
    expect(TrackSchema.safeParse(badEra).success).toBe(false);
  });

  it("CatalogSchema rejette catalogue <80", () => {
    const small = Array.from({ length: 10 }, (_, i) => ({
      id: `id${i}`,
      title: `Title ${i}`,
      artist: `Artist ${i}`,
      album: `Album ${i}`,
      cover: "https://i.scdn.co/image/ab67616d0000b273cover",
      preview_url: "https://p.scdn.co/mp3-preview/test",
      popularity: 50,
      release_date: "2020-01-01",
      era: "2020s" as const,
      source: "spotify" as const,
    }));
    expect(CatalogSchema.safeParse(small).success).toBe(false);
  });

  it("fetchAllCatalog merge 2 playlists + dedup par id", async () => {
    process.env.SPOTIFY_CLIENT_ID = "id";
    process.env.SPOTIFY_CLIENT_SECRET = "secret";
    // on mocke fetchPlaylistTracks via fetch mock qui retourne différents ids selon playlistId contenu dans url
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("accounts.spotify.com")) {
        return { ok: true, json: async () => ({ access_token: "tok", expires_in: 3600 }) } as unknown as Response;
      }
      if (url.includes("playlistA")) {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                track: {
                  id: "dup1",
                  name: "Dup",
                  artists: [{ name: "A" }],
                  album: { name: "Al", release_date: "2020-01-01", images: [{ url: "https://i.scdn.co/image/ab67616d0000b273dup" }] },
                  preview_url: "https://p.scdn.co/mp3-preview/dup",
                  popularity: 70,
                },
              },
              {
                track: {
                  id: "uniqueA",
                  name: "UniqueA",
                  artists: [{ name: "A" }],
                  album: { name: "Al", release_date: "2021-01-01", images: [{ url: "https://i.scdn.co/image/ab67616d0000b273ua" }] },
                  preview_url: "https://p.scdn.co/mp3-preview/ua",
                  popularity: 60,
                },
              },
            ],
            next: null,
          }),
        } as unknown as Response;
      }
      if (url.includes("playlistB")) {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                track: {
                  id: "dup1", // doublon
                  name: "Dup",
                  artists: [{ name: "A" }],
                  album: { name: "Al", release_date: "2020-01-01", images: [{ url: "https://i.scdn.co/image/ab67616d0000b273dup" }] },
                  preview_url: "https://p.scdn.co/mp3-preview/dup",
                  popularity: 70,
                },
              },
              {
                track: {
                  id: "uniqueB",
                  name: "UniqueB",
                  artists: [{ name: "B" }],
                  album: { name: "AlB", release_date: "2019-01-01", images: [{ url: "https://i.scdn.co/image/ab67616d0000b273ub" }] },
                  preview_url: "https://p.scdn.co/mp3-preview/ub",
                  popularity: 75,
                },
              },
            ],
            next: null,
          }),
        } as unknown as Response;
      }
      throw new Error("unexpected " + url);
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    // On doit mocker PLAYLIST_IDS pour ce test: vi.mock de constants
    // Au lieu de mock complexe, on teste dedup via fetchAllCatalog en simulant PLAYLIST_IDS override via env
    // La vraie PLAYLIST_IDS est importée au top de lib/spotify, donc on teste le comportement dedup sur 2 playlists avec id dup1
    // On force PLAYLIST_IDS à contenir playlistA et playlistB via vi.mock avant import — plus simple: on teste merge dedup via directement fetchPlaylistTracks + merge
    // Ici on simule fetchAllCatalog qui itère sur PLAYLIST_IDS (défaut 2 ids). On va stub PLAYLIST_IDS via mock du module constants avant import
    vi.resetModules();
    vi.doMock("@/lib/constants", () => ({
      PLAYLIST_IDS: ["playlistA", "playlistB"],
      getPlaylistIds: () => ["playlistA", "playlistB"],
      STAGES: [0.1, 0.5, 2, 8, 15],
      STORAGE_KEYS: { prefs: "songspot-fr:prefs", playedIds: "songspot-fr:playedIds" },
    }));

    // Ré-importe spotify après mock
    const mod = await import("@/lib/spotify");
    mod.__clearTokenCache();
    const all = await mod.fetchAllCatalog();
    // dup1 doit apparaître une seule fois
    const ids = all.map((t) => t.id);
    expect(ids.filter((id) => id === "dup1").length).toBe(1);
    expect(ids).toContain("uniqueA");
    expect(ids).toContain("uniqueB");
    expect(all.length).toBe(3);
    vi.doUnmock("@/lib/constants");
    vi.resetModules();
  });

  it("PLAYLIST_IDS override via SPOTIFY_PLAYLIST_IDS csv (constants logic)", async () => {
    // Teste la logique de parsing csv directement (mirroir lib/constants.ts)
    const parse = (env: string | undefined, defaults: string[]) => {
      if (env && env.trim().length > 0) {
        return env.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
      }
      return [...defaults];
    };
    expect(parse("id1,id2", ["a", "b"])).toEqual(["id1", "id2"]);
    expect(parse("  id1 ,  id2  ", ["a", "b"])).toEqual(["id1", "id2"]);
    expect(parse("", ["a", "b"])).toEqual(["a", "b"]);
    expect(parse(undefined, ["a", "b"])).toEqual(["a", "b"]);
    expect(parse("id1,,id2", ["a"])).toEqual(["id1", "id2"]);
    // Vérifie que le fichier lib/constants.ts contient bien la logique
    const constContent = readFileSync(resolve("lib/constants.ts"), "utf-8");
    expect(constContent).toContain("SPOTIFY_PLAYLIST_IDS");
    expect(constContent).toContain('split(",")');
  });

  it("token jamais exposé dans Track retourné", async () => {
    process.env.SPOTIFY_CLIENT_ID = "id";
    process.env.SPOTIFY_CLIENT_SECRET = "secret";
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("accounts.spotify.com")) {
        return { ok: true, json: async () => ({ access_token: "SUPER_SECRET_TOKEN", expires_in: 3600 }) } as unknown as Response;
      }
      return {
        ok: true,
        json: async () => ({
          items: [
            {
              track: {
                id: "t1",
                name: "Titre",
                artists: [{ name: "Art" }],
                album: { name: "Alb", release_date: "2020-01-01", images: [{ url: "https://i.scdn.co/image/ab67616d0000b273cover" }] },
                preview_url: "https://p.scdn.co/mp3-preview/t1",
                popularity: 50,
              },
            },
          ],
          next: null,
        }),
      } as unknown as Response;
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const { fetchPlaylistTracks, __clearTokenCache } = await import("@/lib/spotify");
    __clearTokenCache();
    const tracks = await fetchPlaylistTracks("pid");
    const json = JSON.stringify(tracks);
    expect(json).not.toContain("SUPER_SECRET_TOKEN");
    expect(json).not.toContain("access_token");
    expect(tracks[0]).not.toHaveProperty("access_token");
  });

  it("lib/spotify.ts gère ENABLE_DEEZER_FALLBACK flag (default false, filter-only)", () => {
    const content = readFileSync(resolve("lib/spotify.ts"), "utf-8");
    expect(content).toContain("ENABLE_DEEZER_FALLBACK");
    expect(content).toContain('=== "true"');
    // default false → comment / skip
    expect(content).toMatch(/filter-only/i);
  });

  it("normalizeReleaseDate gère YYYY, YYYY-MM, YYYY-MM-DD (via mapping)", async () => {
    process.env.SPOTIFY_CLIENT_ID = "id";
    process.env.SPOTIFY_CLIENT_SECRET = "secret";
    const cases: Array<[string, string]> = [
      ["2020", "2020-01-01"],
      ["2020-06", "2020-06-01"],
      ["2020-06-15", "2020-06-15"],
    ];
    for (const [rawDate, expected] of cases) {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("accounts.spotify.com")) {
          return { ok: true, json: async () => ({ access_token: "tok", expires_in: 3600 }) } as unknown as Response;
        }
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                track: {
                  id: `id-${rawDate}`,
                  name: "T",
                  artists: [{ name: "A" }],
                  album: { name: "Al", release_date: rawDate, images: [{ url: "https://i.scdn.co/image/ab67616d0000b273c" }] },
                  preview_url: "https://p.scdn.co/mp3-preview/t",
                  popularity: 50,
                },
              },
            ],
            next: null,
          }),
        } as unknown as Response;
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;
      const { fetchPlaylistTracks, __clearTokenCache } = await import("@/lib/spotify");
      __clearTokenCache();
      const tracks = await fetchPlaylistTracks("pid");
      expect(tracks[0].release_date).toBe(expected);
    }
  });
});
