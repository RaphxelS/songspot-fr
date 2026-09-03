import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useLikedCatalog } from "@/hooks/useLikedCatalog";
import type { Track } from "@/lib/catalog";

const originalFetch = globalThis.fetch;

function makeTrack(id: string): Track {
  return {
    id,
    title: `Titre ${id}`,
    artist: `Artiste ${id}`,
    album: "Album",
    cover: "https://example.com/cover.jpg",
    popularity: 50,
    release_date: "2020-01-01",
    era: "2020s",
    source: "spotify",
    preview_url: "",
  };
}

function mockCatalogAllApi(count: number, tracks?: Track[]) {
  const all = tracks ?? Array.from({ length: count }, (_, i) => makeTrack(`s${i + 1}`));
  globalThis.fetch = vi.fn(async (input: unknown) => {
    const url = String(input);
    expect(url).toContain("/api/me/liked/catalog?scope=all");
    return {
      status: 200,
      ok: true,
      json: async () => ({
        tracks: all,
        likedCount: count,
        enrichedCount: 0,
        enrichWarning: null,
      }),
    } as Response;
  }) as unknown as typeof fetch;
}

describe("useLikedCatalog — load ALL liked songs", () => {
  beforeEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("fetchAll() loads the full catalog in one request", async () => {
    mockCatalogAllApi(123);
    const { result } = renderHook(() => useLikedCatalog(false));

    await act(async () => {
      await result.current.fetchAll();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tracks).not.toBeNull();
    expect(result.current.tracks!.length).toBe(123);
    expect(result.current.total).toBe(123);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("makes exactly one API call (no paginated liked fetch)", async () => {
    mockCatalogAllApi(120);
    const { result } = renderHook(() => useLikedCatalog(false));
    await act(async () => {
      await result.current.fetchAll();
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.tracks!.length).toBe(120);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("auto-fetches all when enabled and no data yet", async () => {
    mockCatalogAllApi(75);
    const { result } = renderHook(() => useLikedCatalog(true));

    await waitFor(() => expect(result.current.tracks?.length).toBe(75));
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("does NOT auto-fetch when not enabled", async () => {
    const spy = vi.fn(async () => ({
      status: 200,
      ok: true,
      json: async () => ({ tracks: [], likedCount: 0, enrichedCount: 0, enrichWarning: null }),
    })) as unknown as typeof fetch;
    globalThis.fetch = spy;
    renderHook(() => useLikedCatalog(false));
    await new Promise((r) => setTimeout(r, 50));
    expect(spy).not.toHaveBeenCalled();
  });

  it("surfaces Spotify 429 rate-limit errors", async () => {
    globalThis.fetch = vi.fn(async () => ({
      status: 429,
      ok: false,
      json: async () => ({ error: "Spotify limite les requêtes — patientez une minute puis réessayez." }),
    })) as unknown as typeof fetch;

    const { result } = renderHook(() => useLikedCatalog(false));
    await act(async () => {
      await result.current.fetchAll();
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toMatch(/limite les requêtes/i);
  });
});

describe("useLikedCatalog — catalog payload", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns tracks from the scoped catalog all endpoint as-is", async () => {
    const shuffled = [makeTrack("s50"), makeTrack("s3"), makeTrack("s99")];
    mockCatalogAllApi(3, shuffled);
    const { result } = renderHook(() => useLikedCatalog(false));

    await act(async () => {
      await result.current.fetchAll();
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.tracks!.map((t) => t.id)).toEqual(["s50", "s3", "s99"]);
  });
});
