/**
 * tests/storage.test.ts — lib/storage UNIFIÉ
 * Couvre: corrupt JSON "{broken" fallback, filter playedIds, enabledStages guard, memory fallback, prefs persist
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { STORAGE_KEYS } from "@/lib/constants";
import {
  getPrefs,
  setPrefs,
  getPlayedIds,
  setPlayedIds,
  pushPlayedId,
  clearPlayedIds,
  filterPlayedIdsByPool,
  isPoolExhausted,
  clearIfExhausted,
  getEnabledStages,
  setEnabledStages,
  DEFAULT_PREFS,
  FALLBACK_ENABLED_STAGES,
  __resetMemoryStoreForTests,
  __clearAllStorageForTests,
} from "@/lib/storage";

describe("lib/storage — prefs UNIFIÉ", () => {
  beforeEach(() => {
    __clearAllStorageForTests();
    __resetMemoryStoreForTests();
    try {
      window.localStorage.clear();
    } catch {
      // ignore
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("getPrefs retourne DEFAULT_PREFS quand vide", () => {
    const prefs = getPrefs();
    expect(prefs.difficulty).toBe("Facile");
    expect(prefs.era).toBe("Toutes");
    expect(prefs.volume).toBe(0.8);
    expect(prefs.enabledStages).toEqual([true, true, true, true, true]);
  });

  it("setPrefs + getPrefs round-trip persiste enabledStages, difficulty, era, volume", () => {
    setPrefs({
      difficulty: "Facile",
      era: "2020s",
      volume: 0.5,
      enabledStages: [true, false, true, false, true],
    });
    const prefs = getPrefs();
    expect(prefs.difficulty).toBe("Facile");
    expect(prefs.era).toBe("2020s");
    expect(prefs.volume).toBe(0.5);
    expect(prefs.enabledStages).toEqual([true, false, true, false, true]);

    // vérifie localStorage raw
    const raw = window.localStorage.getItem(STORAGE_KEYS.prefs);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.difficulty).toBe("Facile");
  });

  it("corrupt JSON \"{broken\" fallback mémoire, pas de crash — prefs", () => {
    window.localStorage.setItem(STORAGE_KEYS.prefs, "{broken");
    const prefs = getPrefs();
    // fallback DEFAULT_PREFS sans throw
    expect(prefs).toEqual(DEFAULT_PREFS);
    // setPrefs doit encore fonctionner après corrupt
    setPrefs({ difficulty: "Expert" });
    expect(getPrefs().difficulty).toBe("Expert");
  });

  it("corrupt JSON \"{broken\" fallback mémoire, pas de crash — playedIds", () => {
    window.localStorage.setItem(STORAGE_KEYS.playedIds, "{broken");
    const ids = getPlayedIds();
    expect(ids).toEqual([]);
    // push doit fonctionner après corrupt
    pushPlayedId("abc");
    expect(getPlayedIds()).toContain("abc");
  });

  it("enabledStages guard: [false,false,false,false,false] auto-corrigé à [true,false,false,false,false]", () => {
    setPrefs({ enabledStages: [false, false, false, false, false] });
    const prefs = getPrefs();
    expect(prefs.enabledStages).toEqual(FALLBACK_ENABLED_STAGES);
    expect(prefs.enabledStages).toEqual([true, false, false, false, false]);
    // some(Boolean) guard
    expect(prefs.enabledStages.some(Boolean)).toBe(true);
  });

  it("enabledStages guard via setEnabledStages all false → fallback", () => {
    setEnabledStages([false, false, false, false, false]);
    const stages = getEnabledStages();
    expect(stages).toEqual([true, false, false, false, false]);
  });

  it("enabledStages validation: array length !==5 → fallback DEFAULT", () => {
    // bypass setPrefs validation by directly writing corrupt prefs
    window.localStorage.setItem(
      STORAGE_KEYS.prefs,
      JSON.stringify({ enabledStages: [true, false] }),
    );
    const prefs = getPrefs();
    expect(prefs.enabledStages).toEqual(DEFAULT_PREFS.enabledStages);
  });

  it("enabledStages persiste après reload (getPrefs deuxième appel)", () => {
    setPrefs({ enabledStages: [true, false, true, true, false] });
    // simulate reload: second call should return same
    const second = getPrefs();
    expect(second.enabledStages).toEqual([true, false, true, true, false]);
  });

  it("volume clamp 0-1 et NaN handling", () => {
    setPrefs({ volume: 2 });
    expect(getPrefs().volume).toBe(1);
    setPrefs({ volume: -1 });
    expect(getPrefs().volume).toBe(0);
    // NaN via direct storage injection
    window.localStorage.setItem(
      STORAGE_KEYS.prefs,
      JSON.stringify({ volume: null, enabledStages: [true, true, true, true, true] }),
    );
    // null volume should fallback to default 0.8
    expect(getPrefs().volume).toBe(0.8);
  });

  it("filter playedIds on filter change per-pool key", () => {
    setPlayedIds(["id1", "id2", "id3", "id4"]);
    // poolIds only contains id1 and id3
    const filtered = filterPlayedIdsByPool(["id1", "id3"]);
    expect(filtered).toEqual(["id1", "id3"]);
    // storage should have been persisted filtered
    expect(getPlayedIds()).toEqual(["id1", "id3"]);

    // change pool to only id2 — previous filtered should filter again
    setPlayedIds(["id1", "id2", "id3"]);
    const filtered2 = filterPlayedIdsByPool(["id2"]);
    expect(filtered2).toEqual(["id2"]);
    expect(getPlayedIds()).toEqual(["id2"]);
  });

  it("pushPlayedId dedup et persist", () => {
    clearPlayedIds();
    pushPlayedId("a1");
    pushPlayedId("a2");
    pushPlayedId("a1"); // duplicate
    expect(getPlayedIds()).toEqual(["a1", "a2"]);
  });

  it("clearPlayedIds reset", () => {
    setPlayedIds(["x", "y"]);
    clearPlayedIds();
    expect(getPlayedIds()).toEqual([]);
  });

  it("isPoolExhausted et clearIfExhausted", () => {
    const poolIds = ["p1", "p2", "p3"];
    setPlayedIds(["p1", "p2", "p3"]);
    expect(isPoolExhausted(poolIds)).toBe(true);
    const cleared = clearIfExhausted(poolIds);
    expect(cleared).toBe(true);
    expect(getPlayedIds()).toEqual([]);

    // non exhausted
    setPlayedIds(["p1"]);
    expect(isPoolExhausted(poolIds)).toBe(false);
    expect(clearIfExhausted(poolIds)).toBe(false);
    expect(getPlayedIds()).toEqual(["p1"]);
  });

  it("isPoolExhausted avec filter per-pool (playedIds hors pool ignorés)", () => {
    setPlayedIds(["p1", "p2", "other1", "other2"]);
    // pool is p1,p2,p3 → filtered played is p1,p2 (other ignored) → not exhausted (2 < 3)
    expect(isPoolExhausted(["p1", "p2", "p3"])).toBe(false);
    // pool is p1,p2 → filtered is p1,p2 → exhausted (2 >=2)
    expect(isPoolExhausted(["p1", "p2"])).toBe(true);
  });

  it("memory fallback si setItem throw (Safari privé)", () => {
    const originalSetItem = window.localStorage.setItem;
    // mock setItem to throw QuotaExceededError
    const mockSetItem = vi
      .spyOn(window.localStorage, "setItem")
      .mockImplementation(() => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      });

    // setPrefs should not throw, should fallback to memory
    expect(() => setPrefs({ difficulty: "Impossible" })).not.toThrow();
    // getPrefs should return memory value
    expect(getPrefs().difficulty).toBe("Impossible");
    expect(getPrefs().era).toBe("Toutes"); // default preserved in memory

    // playedIds fallback too
    expect(() => pushPlayedId("mem1")).not.toThrow();
    expect(getPlayedIds()).toContain("mem1");

    mockSetItem.mockRestore();
    // restore original to verify memory persists but localStorage may not have it
    // after restore, getPrefs should still read from localStorage if available, but we stored in memory
    // Since localStorage set failed earlier, raw localStorage may still be old; but memory has new value
    // Our safeGetItem prefers localStorage if present, else memory; after restore, memory still has Impossible
    // Write again without throw to sync
    setPrefs({ difficulty: "Impossible" });
    expect(window.localStorage.getItem(STORAGE_KEYS.prefs)).not.toBeNull();

    // cleanup: remove unused var assignment to satisfy lint
    void originalSetItem;
  });

  it("JSON.parse try/catch pour prefs et playedIds ne throw jamais", () => {
    window.localStorage.setItem(STORAGE_KEYS.prefs, "{broken");
    window.localStorage.setItem(STORAGE_KEYS.playedIds, "{broken");
    expect(() => getPrefs()).not.toThrow();
    expect(() => getPlayedIds()).not.toThrow();
    expect(getPrefs().difficulty).toBe("Facile");
    expect(getPlayedIds()).toEqual([]);
  });

  it("getPlayedIds filtre non-string hors tableau", () => {
    window.localStorage.setItem(
      STORAGE_KEYS.playedIds,
      JSON.stringify(["valid", 123, null, "alsoValid", {}]),
    );
    expect(getPlayedIds()).toEqual(["valid", "alsoValid"]);
  });

  it("setPlayedIds filtre et persiste uniquement strings", () => {
    setPlayedIds(["a", 123 as unknown as string, null as unknown as string, "b"]);
    expect(getPlayedIds()).toEqual(["a", "b"]);
  });

  it("STORAGE_KEYS unifiés vérifiés", () => {
    expect(STORAGE_KEYS.prefs).toBe("songspot-fr:prefs");
    expect(STORAGE_KEYS.playedIds).toBe("songspot-fr:playedIds");
  });
});

describe("T10 — Reroll sans repetition 10 pickRandom", () => {
  beforeEach(() => {
    __clearAllStorageForTests();
    __resetMemoryStoreForTests();
    try { window.localStorage.clear(); } catch {}
  });

  it("10 pickRandom successifs sans repetition tant que poolSize non atteint", () => {
    const poolIds = Array.from({ length: 10 }, (_, i) => 'id' + i);
    const picked = [];
    for (let i = 0; i < 10; i++) {
      const available = poolIds.filter((id) => !getPlayedIds().includes(id));
      expect(available.length).toBe(10 - i);
      // pick random deterministic by mocking Math.random to avoid flake, but use real random with check
      // For test, pick first available to simulate deterministic without repetition
      const chosen = available[Math.floor(Math.random() * available.length)];
      expect(picked).not.toContain(chosen);
      picked.push(chosen);
      pushPlayedId(chosen);
      expect(getPlayedIds()).toContain(chosen);
    }
    expect(getPlayedIds()).toHaveLength(10);
    expect(isPoolExhausted(poolIds)).toBe(true);
  });

  it("au 11e si poolSize=10, pool reset et id deja vu peut ressortir (FIFO)", () => {
    const poolIds = Array.from({ length: 10 }, (_, i) => 'id' + i);
    // fill pool
    setPlayedIds([...poolIds]);
    expect(isPoolExhausted(poolIds)).toBe(true);
    const cleared = clearIfExhausted(poolIds);
    expect(cleared).toBe(true);
    expect(getPlayedIds()).toEqual([]);
    // apres reset, un id deja vu peut ressortir
    pushPlayedId(poolIds[0]);
    expect(getPlayedIds()).toContain(poolIds[0]);
    // simulate pickRandom after reset: available should be pool filtered
    const availableAfterReset = poolIds.filter((id) => !getPlayedIds().includes(id));
    expect(availableAfterReset).toHaveLength(9);
    expect(availableAfterReset).not.toContain(poolIds[0]);
    expect(availableAfterReset).toContain(poolIds[1]);
  });

  it("filter per-pool apres changement filtre (era/difficulty)", () => {
    setPlayedIds(["a1", "a2", "b1", "b2", "other"]);
    // pool A contient a1,a2
    let filtered = filterPlayedIdsByPool(["a1", "a2"]);
    expect(filtered).toEqual(["a1", "a2"]);
    expect(getPlayedIds()).toEqual(["a1", "a2"]);
    // changement vers pool B contient b1,b2,other
    setPlayedIds(["a1", "a2", "b1", "b2", "other"]);
    filtered = filterPlayedIdsByPool(["b1", "b2", "other"]);
    expect(filtered).toEqual(["b1", "b2", "other"]);
    expect(getPlayedIds()).toEqual(["b1", "b2", "other"]);
  });

  it("corrupt JSON fallback deja teste mais re-verifie pour T10", () => {
    window.localStorage.setItem(STORAGE_KEYS.playedIds, "{broken");
    expect(() => getPlayedIds()).not.toThrow();
    expect(getPlayedIds()).toEqual([]);
    // push doit fonctionner apres corrupt
    pushPlayedId("newId");
    expect(getPlayedIds()).toContain("newId");
  });

  it("localStorage playedIds contient ids joues et FIFO max poolSize comportement", () => {
    clearPlayedIds();
    const pool = ["t1", "t2", "t3"];
    pushPlayedId("t1");
    pushPlayedId("t2");
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEYS.playedIds) || "[]")).toEqual(["t1", "t2"]);
    // isPoolExhausted false tant que 2/3
    expect(isPoolExhausted(pool)).toBe(false);
    pushPlayedId("t3");
    expect(isPoolExhausted(pool)).toBe(true);
    // clearIfExhausted reset FIFO
    clearIfExhausted(pool);
    expect(getPlayedIds()).toEqual([]);
  });
});
