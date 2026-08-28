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

// Mock /api/me/liked to return `count` tracks across pages of 50, newest-first order.
function mockLikedApi(count: number, withTotal = true) {
  const all = Array.from({ length: count }, (_, i) => makeTrack(`s${i + 1}`));
  globalThis.fetch = vi.fn(async (input: unknown) => {
    const url = String(input);
    const m = url.match(/offset=(\d+)/);
    const offset = m ? Number(m[1]) : 0;
    const page = all.slice(offset, offset + 50);
    return {
      status: 200,
      ok: true,
      json: async () => ({
        tracks: page,
        total: withTotal ? count : null,
        limit: 50,
        offset,
        playableCount: page.length,
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

  it("fetchAll() loads every page up to total (no 100 cap)", async () => {
    mockLikedApi(123); // > 2 pages, well above the old 100 cap
    const { result } = renderHook(() => useLikedCatalog(false));

    await act(async () => {
      await result.current.fetchAll();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tracks).not.toBeNull();
    expect(result.current.tracks!.length).toBe(123); // all tracks, not just 100
    expect(result.current.total).toBe(123);
  });

  it("stops paginating when all.length >= total (avoids one extra request)", async () => {
    let calls = 0;
    const count = 120; // 3 pages of 50
    const all = Array.from({ length: count }, (_, i) => makeTrack(`s${i + 1}`));
    globalThis.fetch = vi.fn(async (input: unknown) => {
      calls++;
      const url = String(input);
      const m = url.match(/offset=(\d+)/);
      const offset = m ? Number(m[1]) : 0;
      const page = all.slice(offset, offset + 50);
      return {
        status: 200,
        ok: true,
        json: async () => ({ tracks: page, total: count, limit: 50, offset, playableCount: page.length }),
      } as Response;
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useLikedCatalog(false));
    await act(async () => {
      await result.current.fetchAll();
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.tracks!.length).toBe(120);
    // 120 => offsets 0,50,100 => exactly 3 calls (page at 100 returns 20 items, total reached)
    expect(calls).toBe(3);
  });

  it("auto-fetches all when enabled and no data yet", async () => {
    mockLikedApi(75);
    const { result } = renderHook(() => useLikedCatalog(true));

    await waitFor(() => expect(result.current.tracks?.length).toBe(75));
    expect(globalThis.fetch).toHaveBeenCalled();
  });

  it("does NOT auto-fetch when not enabled", async () => {
    const spy = vi.fn(async () => ({
      status: 200,
      ok: true,
      json: async () => ({ tracks: [], total: 0, limit: 50, offset: 0, playableCount: 0 }),
    })) as unknown as typeof fetch;
    globalThis.fetch = spy;
    renderHook(() => useLikedCatalog(false));
    // give effects time
    await new Promise((r) => setTimeout(r, 50));
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("useLikedCatalog — shuffle fairness", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("shuffles so the newest-first Spotify order is broken", async () => {
    mockLikedApi(200);
    const { result } = renderHook(() => useLikedCatalog(false));

    await act(async () => {
      await result.current.fetchAll();
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const ids = result.current.tracks!.map((t) => t.id);
    expect(ids.length).toBe(200);
    expect(new Set(ids).size).toBe(200); // no duplicates, all present

    // The raw Spotify order is s1, s2, ..., s200 (newest-first). After a proper
    // Fisher-Yates shuffle it is extremely unlikely to remain in that exact order.
    const isSorted = ids.every((id, i) => id === `s${i + 1}`);
    expect(isSorted).toBe(false);
  });

  it("older ids appear across the list (no early-only-new bias)", async () => {
    mockLikedApi(150);
    const { result } = renderHook(() => useLikedCatalog(false));

    await act(async () => {
      await result.current.fetchAll();
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const ids = result.current.tracks!.map((t) => Number(t.id.replace("s", "")));
    const firstHalf = ids.slice(0, 75);
    const lastHalf = ids.slice(75);
    // A purely newest-first (unshuffled) list would put all high ids first.
    // After shuffle, low (older) ids must appear in BOTH halves.
    const oldestInFirst = Math.min(...firstHalf);
    const oldestInLast = Math.min(...lastHalf);
    expect(oldestInFirst).toBeLessThan(150); // some older id in first half
    expect(oldestInLast).toBeLessThan(150); // some older id in last half too
  });
});
