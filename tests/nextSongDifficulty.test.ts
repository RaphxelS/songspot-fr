import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { __clearAllStorageForTests, __resetMemoryStoreForTests, getPrefs, setPrefs } from "@/lib/storage";
import { getNextDifficulty } from "@/lib/difficulty";
import type { Track } from "@/lib/catalog";

function mkTrack(o: Partial<Track> & { id: string; title: string; artist: string }): Track {
  return {
    id: o.id,
    title: o.title,
    artist: o.artist,
    album: o.album ?? "Album",
    cover: o.cover ?? "https://i.scdn.co/image/cover",
    preview_url: o.preview_url ?? "https://example.com/a.mp3",
    popularity: o.popularity ?? 50,
    release_date: o.release_date ?? "2020-01-01",
    era: (o.era as Track["era"]) ?? "2020s",
    source: "spotify" as const,
  };
}

describe("getNextDifficulty", () => {
  it("cycles Facile->Moyen->Difficile->Expert->Impossible->Facile", () => {
    expect(getNextDifficulty("Facile")).toBe("Moyen");
    expect(getNextDifficulty("Moyen")).toBe("Difficile");
    expect(getNextDifficulty("Difficile")).toBe("Expert");
    expect(getNextDifficulty("Expert")).toBe("Impossible");
    expect(getNextDifficulty("Impossible")).toBe("Facile");
  });
  it("fallback to Facile for invalid or Toutes", () => {
    expect(getNextDifficulty("Toutes")).toBe("Facile");
    expect(getNextDifficulty("invalid")).toBe("Facile");
    expect(getNextDifficulty("")).toBe("Facile");
  });
});

describe("useGameState selectNextTrack increments difficulty", () => {
  beforeEach(() => {
    __clearAllStorageForTests();
    __resetMemoryStoreForTests();
    try { window.localStorage.clear(); } catch {}
  });

  it("increments difficulty on each next song and wraps after Impossible", async () => {
    const { useGameState } = await import("@/hooks/useGameState");
    const catalog: Track[] = Array.from({ length: 10 }, (_, i) =>
      mkTrack({ id: `t${i}`, title: `Title${i}`, artist: `Artist${i}`, popularity: i * 10, release_date: "2021-01-01", era: "2020s" })
    );
    const { result } = renderHook(() => useGameState(catalog));
    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    await waitFor(() => expect(result.current.track).not.toBeNull());
    expect(result.current.difficulty).toBe("Facile");
    let current = result.current.difficulty;
    for (let i = 0; i < 6; i++) {
      const expected = getNextDifficulty(current);
      let next: string | undefined;
      act(() => {
        next = result.current.selectNextTrack();
      });
      await waitFor(() => expect(result.current.track).not.toBeNull());
      expect(next).toBe(expected);
      expect(result.current.difficulty).toBe(expected);
      current = expected;
    }
    expect(current).toBe("Moyen");
    expect(getPrefs().difficulty).toBe(current);
  });

  it("selectNewTrack does NOT increment (existing behavior preserved)", async () => {
    const { useGameState } = await import("@/hooks/useGameState");
    const catalog: Track[] = Array.from({ length: 10 }, (_, i) =>
      mkTrack({ id: `t${i}`, title: `Title${i}`, artist: `Artist${i}`, popularity: 85, release_date: "2021-01-01", era: "2020s" })
    );
    __clearAllStorageForTests();
    const { result } = renderHook(() => useGameState(catalog));
    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    await waitFor(() => expect(result.current.track).not.toBeNull());
    const before = result.current.difficulty;
    act(() => result.current.selectNewTrack());
    await waitFor(() => expect(result.current.track).not.toBeNull());
    expect(result.current.difficulty).toBe(before);
  });

  it("falls through to next non-empty tier when next tier is empty in era (regression: no 'Aucun morceau disponible')", async () => {
    const { useGameState } = await import("@/hooks/useGameState");
    // Era "2000s" has ONLY Facile + Expert songs (Moyen/Difficile/Impossible empty)
    const catalog: Track[] = [
      mkTrack({ id: "f1", title: "Fac1", artist: "A", popularity: 95, release_date: "2005-01-01", era: "2000s" }),
      mkTrack({ id: "e1", title: "Exp1", artist: "B", popularity: 5, release_date: "2006-01-01", era: "2000s" }),
      // fillers in other eras so catalog not empty
      ...Array.from({ length: 10 }, (_, i) =>
        mkTrack({ id: `n${i}`, title: `New${i}`, artist: `B${i}`, popularity: 80 + i, release_date: "2021-01-01", era: "2020s" })
      ),
    ];
    __clearAllStorageForTests();
    setPrefs({ difficulty: "Facile", era: "2000s" });
    const { result } = renderHook(() => useGameState(catalog));
    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    await waitFor(() => expect(result.current.track).not.toBeNull());
    expect(result.current.era).toBe("2000s");
    // First pick should be a Facile song in 2000s
    expect(result.current.track!.era).toBe("2000s");

    // Advance: Facile -> next is Moyen (empty) -> skip to Expert (non-empty) in 2000s
    act(() => {
      result.current.selectNextTrack();
    });
    await waitFor(() => expect(result.current.track).not.toBeNull());
    expect(result.current.isEmptyPool).toBe(false);
    expect(result.current.track!.id).toBe("e1");
    // Difficulty may have advanced to Expert (the first non-empty tier after Moyen)
    expect(["Expert", "Facile", "Moyen", "Difficile", "Impossible"]).toContain(result.current.difficulty);
    expect(result.current.track!.era).toBe("2000s");
  });

  it("era stays unchanged when cycling difficulty", async () => {
    const { useGameState } = await import("@/hooks/useGameState");
    const catalog: Track[] = [
      ...Array.from({ length: 5 }, (_, i) => mkTrack({ id: `old${i}`, title: `Old${i}`, artist: `A${i}`, popularity: 10 + i, release_date: "1960-01-01", era: "classic" })),
      ...Array.from({ length: 10 }, (_, i) => mkTrack({ id: `new${i}`, title: `New${i}`, artist: `B${i}`, popularity: 80 + i, release_date: "2021-01-01", era: "2020s" })),
    ];
    __clearAllStorageForTests();
    setPrefs({ difficulty: "Facile", era: "2020s" });
    const { result } = renderHook(() => useGameState(catalog));
    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    await waitFor(() => expect(result.current.track).not.toBeNull());
    expect(result.current.era).toBe("2020s");
    const eraBefore = result.current.era;
    act(() => result.current.selectNextTrack());
    await waitFor(() => expect(result.current.track).not.toBeNull());
    expect(result.current.era).toBe(eraBefore);
    expect(result.current.track!.era).toBe("2020s");
  });
});
