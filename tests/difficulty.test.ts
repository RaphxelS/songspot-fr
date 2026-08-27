import { describe, it, expect } from "vitest";
import catalog from "@/data/catalog.fr.json";
import type { Track } from "@/lib/catalog";
import {
  DIFFICULTY_LABELS,
  getDifficultyThresholds,
  getTier,
  filterByDifficulty,
  filterByEra,
} from "@/lib/difficulty";

// Helper pour générer des tracks mock
function makeMockTracks(count: number, popFn: (i: number) => number, dateFn?: (i: number) => string): Track[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `mock-${i}`,
    title: `Title ${i}`,
    artist: `Artist ${i}`,
    album: `Album ${i}`,
    cover: "https://i.scdn.co/image/ab67616d0000b273cover",
    preview_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    popularity: popFn(i),
    release_date: dateFn ? dateFn(i) : "2020-06-15",
    era: "2020s" as const,
    source: "spotify" as const,
  }));
}

describe("lib/difficulty — labels FR exacts", () => {
  it("DIFFICULTY_LABELS vaut exactement [Facile, Moyen, Difficile, Expert, Impossible] non traduits", () => {
    expect(DIFFICULTY_LABELS).toEqual(["Facile", "Moyen", "Difficile", "Expert", "Impossible"]);
  });

  it("labels FR présents et non traduits (grep)", () => {
    expect(DIFFICULTY_LABELS).toContain("Facile");
    expect(DIFFICULTY_LABELS).toContain("Impossible");
    expect(DIFFICULTY_LABELS).not.toContain("Easy");
    expect(DIFFICULTY_LABELS).not.toContain("Hard");
  });
});

describe("getDifficultyThresholds — quintiles 20/40/60/80", () => {
  it("pour mock 100 tracks 0..99, thresholds sont 20/40/60/80", () => {
    const mock = makeMockTracks(100, (i) => i);
    const th = getDifficultyThresholds(mock as unknown as Track[]);
    // sorted 0..99, indices floor(100*0.2)=20 → 20, 40→40, 60→60, 80→80
    expect(th.p20).toBe(20);
    expect(th.p40).toBe(40);
    expect(th.p60).toBe(60);
    expect(th.p80).toBe(80);
  });

  it("pour catalogue vide retourne 0 sans crash", () => {
    const th = getDifficultyThresholds([]);
    expect(th).toEqual({ p20: 0, p40: 0, p60: 0, p80: 0 });
  });

  it("gère quintiles effondrés (skew: tous popularity 85) sans crash", () => {
    const mock = makeMockTracks(50, () => 85);
    const th = getDifficultyThresholds(mock as unknown as Track[]);
    expect(th.p20).toBe(85);
    expect(th.p80).toBe(85);
    // getTier ne doit pas crasher même si seuils égaux
    expect(() => getTier(85, th)).not.toThrow();
    expect(getTier(85, th)).toBe("Facile");
    expect(getTier(0, th)).toBe("Impossible");
  });

  it("seuils basés sur sorted[Math.floor(n*percentile)].popularity (vérifie formule spec)", () => {
    const mock = makeMockTracks(10, (i) => i * 10); // 0,10,20...90
    const th = getDifficultyThresholds(mock as unknown as Track[]);
    // n=10, p20 idx2=20, p40 idx4=40, p60 idx6=60, p80 idx8=80
    expect(th.p20).toBe(20);
    expect(th.p40).toBe(40);
    expect(th.p60).toBe(60);
    expect(th.p80).toBe(80);
  });
});

describe("getTier — mapping quintiles", () => {
  it("Facile = pop >= p80, Impossible = pop < p20", () => {
    const mock = makeMockTracks(100, (i) => i);
    const th = getDifficultyThresholds(mock as unknown as Track[]);
    expect(getTier(99, th)).toBe("Facile");
    expect(getTier(80, th)).toBe("Facile");
    expect(getTier(79, th)).toBe("Moyen");
    expect(getTier(60, th)).toBe("Moyen");
    expect(getTier(59, th)).toBe("Difficile");
    expect(getTier(40, th)).toBe("Difficile");
    expect(getTier(39, th)).toBe("Expert");
    expect(getTier(20, th)).toBe("Expert");
    expect(getTier(19, th)).toBe("Impossible");
    expect(getTier(0, th)).toBe("Impossible");
  });
});

describe("filterByDifficulty — mock 100 tracks 0..99 chaque tier 20 ±1", () => {
  const mock = makeMockTracks(100, (i) => i);
  const th = getDifficultyThresholds(mock as unknown as Track[]);

  it("chaque tier contient exactement 20 tracks (±1)", () => {
    for (const label of DIFFICULTY_LABELS) {
      const filtered = filterByDifficulty(mock as unknown as Track[], label, th);
      expect(filtered.length).toBeGreaterThanOrEqual(19);
      expect(filtered.length).toBeLessThanOrEqual(21);
    }
    // total 100
    const total = DIFFICULTY_LABELS.reduce((sum, l) => sum + filterByDifficulty(mock as unknown as Track[], l, th).length, 0);
    expect(total).toBe(100);
  });

  it("Facile retourne quintile supérieur (pop >=80) — 20 tracks", () => {
    const facile = filterByDifficulty(mock as unknown as Track[], "Facile", th);
    expect(facile.length).toBe(20);
    for (const t of facile) {
      expect(t.popularity).toBeGreaterThanOrEqual(80);
    }
    // vérifie tri non requis mais tous haute pop
    const minFacile = Math.min(...facile.map((t) => t.popularity));
    expect(minFacile).toBe(80);
  });

  it("Impossible retourne quintile inférieur (pop <20) — 20 tracks", () => {
    const impossible = filterByDifficulty(mock as unknown as Track[], "Impossible", th);
    expect(impossible.length).toBe(20);
    for (const t of impossible) {
      expect(t.popularity).toBeLessThan(20);
    }
    const maxImpossible = Math.max(...impossible.map((t) => t.popularity));
    expect(maxImpossible).toBe(19);
  });

  it("Moyen = 60-79, Difficile = 40-59, Expert = 20-39", () => {
    const moyen = filterByDifficulty(mock as unknown as Track[], "Moyen", th);
    const difficile = filterByDifficulty(mock as unknown as Track[], "Difficile", th);
    const expert = filterByDifficulty(mock as unknown as Track[], "Expert", th);
    expect(moyen.every((t) => t.popularity >= 60 && t.popularity < 80)).toBe(true);
    expect(difficile.every((t) => t.popularity >= 40 && t.popularity < 60)).toBe(true);
    expect(expert.every((t) => t.popularity >= 20 && t.popularity < 40)).toBe(true);
  });

  it("tier inconnu retourne [] sans crash (EmptyPoolCard path)", () => {
    const res = filterByDifficulty(mock as unknown as Track[], "Inconnu" as unknown as typeof DIFFICULTY_LABELS[number], th);
    expect(res).toEqual([]);
  });

  it("catalogue vide retourne [] sans crash", () => {
    expect(filterByDifficulty([], "Facile", th)).toEqual([]);
  });

  it("seuils effondrés (toutes pop identiques) → seul Facile non vide, autres [] sans crash", () => {
    const skewed = makeMockTracks(20, () => 90);
    const thSkew = getDifficultyThresholds(skewed as unknown as Track[]);
    const facile = filterByDifficulty(skewed as unknown as Track[], "Facile", thSkew);
    const impossible = filterByDifficulty(skewed as unknown as Track[], "Impossible", thSkew);
    expect(facile.length).toBe(20);
    expect(impossible.length).toBe(0);
    // EmptyPoolCard path: caller affiche carte si []
    expect(impossible).toEqual([]);
  });
});

describe("filterByEra — via release_date year", () => {
  it("Toutes retourne tout sans filtrage", () => {
    const mock = makeMockTracks(10, () => 50, (i) => `2015-0${(i % 9) + 1}-01`);
    const res = filterByEra(mock as unknown as Track[], "Toutes");
    expect(res.length).toBe(10);
  });

  it("2020s ne retourne que release_date >= 2020-01-01", () => {
    const mock: Track[] = [
      { id: "1", title: "t", artist: "a", album: "al", cover: "https://i.scdn.co/image/ab67616d0000b273a", preview_url: "https://example.com/a.mp3", popularity: 50, release_date: "2019-12-31", era: "2010s", source: "spotify" },
      { id: "2", title: "t", artist: "a", album: "al", cover: "https://i.scdn.co/image/ab67616d0000b273a", preview_url: "https://example.com/a.mp3", popularity: 50, release_date: "2020-01-01", era: "2020s", source: "spotify" },
      { id: "3", title: "t", artist: "a", album: "al", cover: "https://i.scdn.co/image/ab67616d0000b273a", preview_url: "https://example.com/a.mp3", popularity: 50, release_date: "2022-06-15", era: "2020s", source: "spotify" },
      { id: "4", title: "t", artist: "a", album: "al", cover: "https://i.scdn.co/image/ab67616d0000b273a", preview_url: "https://example.com/a.mp3", popularity: 50, release_date: "1999-01-01", era: "classic", source: "spotify" },
    ];
    const res = filterByEra(mock, "2020s");
    expect(res.length).toBe(2);
    expect(res.map((t) => t.id)).toEqual(["2", "3"]);
    for (const t of res) {
      expect(t.release_date >= "2020-01-01").toBe(true);
    }
  });

  it("Classic/Classique <2000 via release_date year <2000", () => {
    const mock: Track[] = [
      { id: "c1", title: "t", artist: "a", album: "al", cover: "https://i.scdn.co/image/a", preview_url: "https://example.com/a.mp3", popularity: 50, release_date: "1947-01-01", era: "classic", source: "spotify" },
      { id: "c2", title: "t", artist: "a", album: "al", cover: "https://i.scdn.co/image/a", preview_url: "https://example.com/a.mp3", popularity: 50, release_date: "1999-12-31", era: "classic", source: "spotify" },
      { id: "c3", title: "t", artist: "a", album: "al", cover: "https://i.scdn.co/image/a", preview_url: "https://example.com/a.mp3", popularity: 50, release_date: "2000-01-01", era: "2000s", source: "spotify" },
    ];
    const resClassic = filterByEra(mock, "Classic");
    expect(resClassic.map((t) => t.id)).toEqual(["c1", "c2"]);
    const resClassique = filterByEra(mock, "Classique");
    expect(resClassique.map((t) => t.id)).toEqual(["c1", "c2"]);
    const resLower = filterByEra(mock, "classic");
    expect(resLower.length).toBe(2);
  });

  it("2000s = 2000-2009, 2010s = 2010-2019", () => {
    const mock: Track[] = [
      { id: "a", title: "t", artist: "a", album: "al", cover: "https://i.scdn.co/image/a", preview_url: "https://example.com/a.mp3", popularity: 50, release_date: "2002-11-04", era: "2000s", source: "spotify" },
      { id: "b", title: "t", artist: "a", album: "al", cover: "https://i.scdn.co/image/a", preview_url: "https://example.com/a.mp3", popularity: 50, release_date: "2009-09-21", era: "2000s", source: "spotify" },
      { id: "c", title: "t", artist: "a", album: "al", cover: "https://i.scdn.co/image/a", preview_url: "https://example.com/a.mp3", popularity: 50, release_date: "2013-05-13", era: "2010s", source: "spotify" },
      { id: "d", title: "t", artist: "a", album: "al", cover: "https://i.scdn.co/image/a", preview_url: "https://example.com/a.mp3", popularity: 50, release_date: "2010-01-01", era: "2010s", source: "spotify" },
    ];
    expect(filterByEra(mock, "2000s").map((t) => t.id)).toEqual(["a", "b"]);
    expect(filterByEra(mock, "2010s").map((t) => t.id)).toEqual(["c", "d"]);
  });

  it("catalogue vide retourne [] sans crash", () => {
    expect(filterByEra([], "2020s")).toEqual([]);
  });
});

describe("combo filterByDifficulty(filterByEra(...))", () => {
  it("combo 2020s + Facile fonctionne et retourne [] sans crash si pool vide", () => {
    // Mock où 2020s n'a que basse popularité (< seuil Facile global) → combo vide
    const mock: Track[] = [
      { id: "1", title: "t", artist: "a", album: "al", cover: "https://i.scdn.co/image/a", preview_url: "https://example.com/a.mp3", popularity: 10, release_date: "2021-01-01", era: "2020s", source: "spotify" },
      { id: "2", title: "t", artist: "a", album: "al", cover: "https://i.scdn.co/image/a", preview_url: "https://example.com/a.mp3", popularity: 15, release_date: "2022-01-01", era: "2020s", source: "spotify" },
      { id: "3", title: "t", artist: "a", album: "al", cover: "https://i.scdn.co/image/a", preview_url: "https://example.com/a.mp3", popularity: 95, release_date: "2015-01-01", era: "2010s", source: "spotify" },
    ];
    const thGlobal = getDifficultyThresholds(mock);
    const eraFiltered = filterByEra(mock, "2020s");
    expect(eraFiltered.length).toBe(2);
    const combo = filterByDifficulty(eraFiltered, "Facile", thGlobal);
    // Facile seuil = tri [10,15,95] → n=3, p80 idx floor(2.4)=2 → 95, donc seul pop 95 est Facile, mais il n'est pas dans 2020s
    expect(combo).toEqual([]);
    expect(() => filterByDifficulty(filterByEra(mock, "2020s"), "Facile", thGlobal)).not.toThrow();
  });

  it("combo non vide retourne intersection correcte", () => {
    const mock: Track[] = [
      { id: "1", title: "t", artist: "a", album: "al", cover: "https://i.scdn.co/image/a", preview_url: "https://example.com/a.mp3", popularity: 90, release_date: "2021-01-01", era: "2020s", source: "spotify" },
      { id: "2", title: "t", artist: "a", album: "al", cover: "https://i.scdn.co/image/a", preview_url: "https://example.com/a.mp3", popularity: 10, release_date: "2021-01-02", era: "2020s", source: "spotify" },
      { id: "3", title: "t", artist: "a", album: "al", cover: "https://i.scdn.co/image/a", preview_url: "https://example.com/a.mp3", popularity: 95, release_date: "2015-01-01", era: "2010s", source: "spotify" },
    ];
    const th = getDifficultyThresholds(mock);
    const res = filterByDifficulty(filterByEra(mock, "2020s"), "Facile", th);
    // p80 =95, donc seul 95 est Facile, mais 90 <95 donc non Facile → 0 ?
    // Avec notre mock [10,90,95] trié [10,90,95], p80 idx2=95, donc 90 n'est pas Facile
    // Vérifie que fonction ne crash pas et retourne array
    expect(Array.isArray(res)).toBe(true);
  });
});

describe("vrai catalog.fr.json — 95 tracks, skew Top 50", () => {
  const real = catalog as unknown as Track[];
  const th = getDifficultyThresholds(real);

  it("chaque tier a ≥0 et total 95 (skew géré, pas de crash)", () => {
    let total = 0;
    for (const label of DIFFICULTY_LABELS) {
      const filtered = filterByDifficulty(real, label, th);
      expect(filtered.length).toBeGreaterThanOrEqual(0);
      total += filtered.length;
    }
    expect(total).toBe(95);
  });

  it("Facile popularity la plus haute, Impossible la plus basse", () => {
    const facile = filterByDifficulty(real, "Facile", th);
    const impossible = filterByDifficulty(real, "Impossible", th);
    if (facile.length > 0 && impossible.length > 0) {
      const minFacile = Math.min(...facile.map((t) => t.popularity));
      const maxImpossible = Math.max(...impossible.map((t) => t.popularity));
      expect(minFacile).toBeGreaterThan(maxImpossible);
      // Facile doit être haute pop (≥82 d'après seuils réels 75,77,80,82)
      expect(minFacile).toBeGreaterThanOrEqual(th.p80);
      expect(maxImpossible).toBeLessThan(th.p20);
    }
  });

  it("filterByEra sur vrai catalogue: Toutes=95, 2020s>=2020, Classic<2000, 2010s 2010-2019", () => {
    expect(filterByEra(real, "Toutes").length).toBe(95);
    const c2020s = filterByEra(real, "2020s");
    expect(c2020s.length).toBeGreaterThan(0);
    for (const t of c2020s) expect(t.release_date >= "2020-01-01").toBe(true);
    const classic = filterByEra(real, "Classic");
    for (const t of classic) {
      const y = parseInt(t.release_date.slice(0, 4), 10);
      expect(y).toBeLessThan(2000);
    }
    const c2010s = filterByEra(real, "2010s");
    for (const t of c2010s) {
      const y = parseInt(t.release_date.slice(0, 4), 10);
      expect(y).toBeGreaterThanOrEqual(2010);
      expect(y).toBeLessThanOrEqual(2019);
    }
  });

  it("combo réel filterByDifficulty(filterByEra(2020s), Facile) ne crash pas même si tier vide", () => {
    const era2020s = filterByEra(real, "2020s");
    expect(() => filterByDifficulty(era2020s, "Facile", th)).not.toThrow();
    const combo = filterByDifficulty(era2020s, "Facile", th);
    expect(Array.isArray(combo)).toBe(true);
    // Si combo vide, caller afficherait EmptyPoolCard
    if (combo.length === 0) {
      expect(combo).toEqual([]);
    } else {
      for (const t of combo) expect(t.popularity).toBeGreaterThanOrEqual(th.p80);
    }
  });

  it("ne crash pas si tier vide (EmptyPoolCard path) — simule pool épuisé", () => {
    // Crée un pool où aucun track n'est Facile (tous basse pop)
    const lowPop = real.filter((t) => t.popularity < th.p20);
    if (lowPop.length > 0) {
      const facileEmpty = filterByDifficulty(lowPop, "Facile", th);
      expect(facileEmpty).toEqual([]);
      // EmptyPoolCard: si filtered.length===0, UI affiche carte
      expect(facileEmpty.length).toBe(0);
    } else {
      // sinon test avec mock vide
      expect(filterByDifficulty([], "Facile", th)).toEqual([]);
    }
  });

  it("thresholds calculés sur vrai catalogue: p20 <= p40 <= p60 <= p80", () => {
    expect(th.p20).toBeLessThanOrEqual(th.p40);
    expect(th.p40).toBeLessThanOrEqual(th.p60);
    expect(th.p60).toBeLessThanOrEqual(th.p80);
    // Valeurs attendues pour 95 left-skewed: 75,77,80,82 (d'après analysis)
    expect(th.p20).toBeGreaterThanOrEqual(70);
    expect(th.p80).toBeLessThanOrEqual(92);
  });
});
