import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { __clearAllStorageForTests, __resetMemoryStoreForTests, getPrefs, setPrefs } from "@/lib/storage";
import { getDifficultyThresholds, getTier } from "@/lib/difficulty";
import type { Track } from "@/lib/catalog";

function mkTrack(o: Partial<Track> & { id: string; title: string; artist: string }): Track {
  return {
    id: o.id,
    title: o.title,
    artist: o.artist,
    album: o.album ?? "Album",
    cover: o.cover ?? "https://i.scdn.co/image/ab67616d0000b273cover",
    preview_url: o.preview_url ?? "https://example.com/a.mp3",
    popularity: o.popularity ?? 50,
    release_date: o.release_date ?? "2020-01-01",
    era: (o.era as Track["era"]) ?? "2020s",
    source: "spotify" as const,
  };
}

describe("Progressive Toutes mode — removed (Toutes deprecated)", () => {
  beforeEach(() => {
    __clearAllStorageForTests();
    __resetMemoryStoreForTests();
    try { window.localStorage.clear(); } catch {}
    vi.restoreAllMocks();
  });

  it("progressiveTier cycles Facile→Impossible, 1/5 etc (helper still works)", async () => {
    const { getProgressiveTierForTest } = await import("@/hooks/useGameState");
    expect(getProgressiveTierForTest(0)).toBe("Facile");
    expect(getProgressiveTierForTest(1)).toBe("Moyen");
    expect(getProgressiveTierForTest(4)).toBe("Impossible");
    expect(getProgressiveTierForTest(5)).toBe("Facile");
  });

  it("when difficulty Toutes (legacy) is migrated to Facile, no progressive cycle — progressiveTier always null", async () => {
    const { useGameState } = await import("@/hooks/useGameState");
    const catalog: Track[] = Array.from({ length: 10 }, (_, i) => mkTrack({
      id: `t${i}`, title: `Title${i}`, artist: `Artist${i}`, popularity: i * 10, release_date: "2021-01-01", era: "2020s"
    }));
    //Legacy Toutes should be migrated to Facile via storage
    __clearAllStorageForTests();
    setPrefs({ difficulty: "Toutes" as unknown as string, era: "Toutes", toutesProgressIndex: 0 });
    // getPrefs migrates Toutes -> Facile
    expect(getPrefs().difficulty).toBe("Facile");
    const { result } = renderHook(() => useGameState(catalog));
    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    await waitFor(() => expect(result.current.track).not.toBeNull());
    // progressiveTier should be null after removal
    expect(result.current.progressiveTier).toBeNull();
    expect(result.current.toutesProgressIndex).toBe(0);
    const beforeIdx = result.current.toutesProgressIndex;
    act(() => result.current.selectNewTrack());
    await waitFor(() => expect(result.current.track).not.toBeNull());
    // after select, still null and index unchanged (no progressive increment)
    expect(result.current.progressiveTier).toBeNull();
    expect(result.current.toutesProgressIndex).toBe(beforeIdx);
  });

  it("explicit difficulty filter (Facile) remains random within tier, not progressive", async () => {
    const { useGameState } = await import("@/hooks/useGameState");
    const catalog: Track[] = Array.from({ length: 10 }, (_, i) => mkTrack({
      id: `t${i}`, title: `Title${i}`, artist: `Artist${i}`, popularity: i * 10, release_date: "2021-01-01", era: "2020s"
    }));
    __clearAllStorageForTests();
    setPrefs({ difficulty: "Facile", era: "Toutes", toutesProgressIndex: 0 });
    const { result } = renderHook(() => useGameState(catalog));
    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    await waitFor(() => expect(result.current.track).not.toBeNull());
    // when difficulty = Facile, progressiveTier should be null
    expect(result.current.progressiveTier).toBeNull();
    const thresholds = getDifficultyThresholds(catalog);
    for (let i=0;i<3;i++) {
      const tier = getTier(result.current.track!.popularity, thresholds);
      expect(tier).toBe("Facile");
      act(() => result.current.selectNewTrack());
      await waitFor(() => expect(result.current.track).not.toBeNull());
    }
  });

  it("persists toutesProgressIndex but not increment via progressive (removed)", async () => {
    const { useGameState } = await import("@/hooks/useGameState");
    const catalog: Track[] = Array.from({ length: 10 }, (_, i) => mkTrack({
      id: `t${i}`, title: `Title${i}`, artist: `Artist${i}`, popularity: i * 10, release_date: "2021-01-01", era: "2020s"
    }));
    const { result } = renderHook(() => useGameState(catalog));
    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    // After removal, toutesProgressIndex stays 0
    await waitFor(() => expect(result.current.toutesProgressIndex).toBe(0));
    expect(getPrefs().toutesProgressIndex).toBe(0);
    act(() => result.current.selectNewTrack());
    await waitFor(() => expect(result.current.track).not.toBeNull());
    // still 0, not incrementing
    expect(getPrefs().toutesProgressIndex).toBe(0);
  });

  it("works per-era: 2020s still picks from 2020s pool without progressive", async () => {
    const { useGameState } = await import("@/hooks/useGameState");
    const catalog: Track[] = [
      mkTrack({ id: "c1", title: "ClassicLow", artist: "A", popularity: 10, release_date: "1960-01-01", era: "classic" }),
      mkTrack({ id: "c2", title: "ClassicMid", artist: "B", popularity: 15, release_date: "1965-01-01", era: "classic" }),
      ...Array.from({ length: 10 }, (_, i) => mkTrack({ id: `t${i}`, title: `T${i}`, artist: `Ar${i}`, popularity: 80 + (i%2)*5, release_date: "2021-01-01", era: "2020s" })),
    ];
    __clearAllStorageForTests();
    setPrefs({ difficulty: "Facile", era: "2020s", toutesProgressIndex: 0 });
    const { result } = renderHook(() => useGameState(catalog));
    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    await waitFor(() => expect(result.current.track).not.toBeNull());
    expect(result.current.track!.era).toBe("2020s");
    expect(["Facile","Moyen","Difficile","Expert","Impossible"].includes(getTier(result.current.track!.popularity, getDifficultyThresholds(catalog.filter(t=>t.era==="2020s"))))).toBe(true);
  });
});
