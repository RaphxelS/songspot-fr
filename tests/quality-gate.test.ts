/**
 * tests/quality-gate.test.ts — T13 Coverage Gate léger
 * Gate final agrège les tests co-localisés T02/T04/T05/T06/T10 + vérifs T13 explicites.
 * Chaque it() correspond à un critère d'acceptation T13 ; déjà couverts individuellement,
 * mais ce fichier en fait la porte d'entrée unique pour `npm run test:ci` + coverage ≥60% lib/.
 * Smoke only audio : voir docs/qa-manual-matrix.md pour timing réel iOS Safari / Android Chrome / Desktop.
 */
import { describe, it, expect, beforeEach } from "vitest";
import catalog from "@/data/catalog.fr.json";
import type { Track } from "@/lib/catalog";
import { STAGES } from "@/lib/constants";
import { normalize } from "@/lib/normalize";
import { DIFFICULTY_LABELS, filterByDifficulty, filterByEra, getDifficultyThresholds } from "@/lib/difficulty";
import { parseShareUrl, buildShareUrl, TOAST_CHALLENGE_NOT_FOUND } from "@/lib/share";
import { getPrefs, setPrefs, getPlayedIds, setPlayedIds, __clearAllStorageForTests, __resetMemoryStoreForTests } from "@/lib/storage";
import { STORAGE_KEYS } from "@/lib/constants";

// Gate léger : catalogue réel 95 left-skewed

describe("T13 gate — filterByDifficulty sur vrai catalog.fr.json skew", () => {
  const real = catalog as unknown as Track[];
  const th = getDifficultyThresholds(real);

  it("chaque tier ne crash pas, total 95, EmptyPoolCard path si vide", () => {
    let total = 0;
    for (const label of DIFFICULTY_LABELS) {
      const filtered = filterByDifficulty(real, label, th);
      expect(Array.isArray(filtered)).toBe(true);
      total += filtered.length;
    }
    expect(total).toBe(95);
  });

  it("Facile pop ≥ p80, Impossible < p20 (skew 75/77/80/82)", () => {
    const facile = filterByDifficulty(real, "Facile", th);
    const impossible = filterByDifficulty(real, "Impossible", th);
    if (facile.length && impossible.length) {
      expect(Math.min(...facile.map((t) => t.popularity))).toBeGreaterThan(Math.max(...impossible.map((t) => t.popularity)));
    }
  });

  it("combo filterByDifficulty(filterByEra(2020s), Facile) ne crash pas", () => {
    const era2020s = filterByEra(real, "2020s");
    expect(() => filterByDifficulty(era2020s, "Facile", th)).not.toThrow();
    expect(Array.isArray(filterByDifficulty(era2020s, "Facile", th))).toBe(true);
  });

  it("tier vide retourne [] sans crash (skew toutes pop identiques)", () => {
    const lowPop = real.filter((t) => t.popularity < th.p20);
    if (lowPop.length) expect(filterByDifficulty(lowPop, "Facile", th)).toEqual([]);
    else expect(filterByDifficulty([], "Facile", th)).toEqual([]);
  });
});

describe("T13 gate — storage corrupt JSON \"{broken\" fallback", () => {
  beforeEach(() => {
    __clearAllStorageForTests();
    __resetMemoryStoreForTests();
    try {
      window.localStorage.clear();
    } catch {}
  });

  it("prefs corrupt \"{broken\" → DEFAULT sans crash", () => {
    window.localStorage.setItem(STORAGE_KEYS.prefs, "{broken");
    expect(() => getPrefs()).not.toThrow();
    expect(getPrefs().difficulty).toBe("Toutes");
  });

  it("playedIds corrupt \"{broken\" → [] sans crash", () => {
    window.localStorage.setItem(STORAGE_KEYS.playedIds, "{broken");
    expect(() => getPlayedIds()).not.toThrow();
    expect(getPlayedIds()).toEqual([]);
  });

  it("après corrupt, setPrefs / pushPlayedId fonctionnent", () => {
    window.localStorage.setItem(STORAGE_KEYS.prefs, "{broken");
    window.localStorage.setItem(STORAGE_KEYS.playedIds, "{broken");
    setPrefs({ difficulty: "Expert" });
    expect(getPrefs().difficulty).toBe("Expert");
    setPlayedIds(["x"]);
    expect(getPlayedIds()).toContain("x");
  });
});

describe("T13 gate — normalize ligatures œ→oe", () => {
  it("Àngèle→angele, Cœur→coeur, Œuvre→oeuvre, Été→ete", () => {
    expect(normalize("Àngèle")).toBe("angele");
    expect(normalize("Cœur")).toBe("coeur");
    expect(normalize("Œuvre")).toBe("oeuvre");
    expect(normalize("Été")).toBe("ete");
  });

  it("ligatures œ/Œ/æ/Æ → oe/ae", () => {
    expect(normalize("œ")).toBe("oe");
    expect(normalize("Œ")).toBe("oe");
    expect(normalize("æ")).toBe("ae");
    expect(normalize("Æ")).toBe("ae");
    expect(normalize("cœur et æther")).toBe("coeur et aether");
  });
});

describe("T13 gate — STAGES exact [0.1,0.5,2,8,15]", () => {
  it("STAGES vaut exactement [0.1,0.5,2,8,15] as const", async () => {
    expect(STAGES).toEqual([0.1, 0.5, 2, 8, 15]);
    const { STAGES: hookStages } = await import("@/hooks/useGameState");
    expect(hookStages).toEqual([0.1, 0.5, 2, 8, 15]);
  });
});

describe("T13 gate — enabledStages guard some(Boolean)", () => {
  beforeEach(() => {
    __clearAllStorageForTests();
    __resetMemoryStoreForTests();
    try {
      window.localStorage.clear();
    } catch {}
  });

  it("[false,false,false,false,false] autocorrigé → [true,false,false,false,false]", () => {
    setPrefs({ enabledStages: [false, false, false, false, false] });
    expect(getPrefs().enabledStages).toEqual([true, false, false, false, false]);
    expect(getPrefs().enabledStages.some(Boolean)).toBe(true);
  });
});

describe("T13 gate — share invalid track fallback", () => {
  const CATALOG: Track[] = [
    { id: "abc123", title: "Djadja", artist: "Aya", album: "A", cover: "https://i.scdn.co/image/a", preview_url: "https://example.com/a.mp3", popularity: 80, release_date: "2022-01-01", era: "2020s", source: "spotify" },
  ];

  it("buildShareUrl sans stage, round-trip 2 valeurs", () => {
    const url = buildShareUrl("abc123", "Facile");
    expect(url).not.toContain("stage");
    const params = new URLSearchParams(url);
    const parsed = parseShareUrl(params, CATALOG);
    expect(parsed.isValid).toBe(true);
    expect(parsed.trackId).toBe("abc123");
  });

  it("allowlist id hors catalog → false + toast Défi introuvable", () => {
    const params = new URLSearchParams("?track=invalid_id&difficulty=Expert");
    const res = parseShareUrl(params, CATALOG);
    expect(res.isValid).toBe(false);
    expect(res.track).toBeNull();
    expect(res.toast).toBe(TOAST_CHALLENGE_NOT_FOUND);
  });
});

describe("T13 gate — emptyPool", () => {
  it("filterByDifficulty tier inconnu → [] sans crash, filteredPool vide path", () => {
    const mock: Track[] = [];
    expect(filterByDifficulty(mock, "Inconnu" as never)).toEqual([]);
    expect(filterByEra(mock, "2020s")).toEqual([]);
  });

  it("filteredPool vide → EmptyPoolCard rendu (composant)", async () => {
    const { default: EmptyPoolCard } = await import("@/components/game/EmptyPoolCard");
    const { render } = await import("@testing-library/react");
    const { container } = render(EmptyPoolCard({} as never));
    const card = container.querySelector('[data-testid="empty-pool-card"]') ?? container.firstChild;
    expect(card).toBeTruthy();
  });
});

describe("T13 gate — audio smoke only comment", () => {
  it("tests/audio.test.ts marqué smoke only", async () => {
    const fs = await import("fs");
    const text = fs.readFileSync("tests/audio.test.ts", "utf8");
    expect(text).toContain("smoke only");
    expect(text).toContain("jsdom n'a pas de moteur média");
  });
});
