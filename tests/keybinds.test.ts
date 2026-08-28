import { describe, it, expect, beforeEach } from "vitest";
import { DEFAULT_KEYBINDS, normalizeKey, formatKey, isTypingTarget, normalizeKeybinds } from "@/lib/keybinds";
import { getPrefs, setPrefs, __clearAllStorageForTests, __resetMemoryStoreForTests } from "@/lib/storage";

describe("lib/keybinds — DEFAULT_KEYBINDS", () => {
  it("defaults are space for play and s for skip", () => {
    expect(DEFAULT_KEYBINDS.play).toBe(" ");
    expect(DEFAULT_KEYBINDS.skip).toBe("s");
  });
});

describe("normalizeKey", () => {
  it("space stays space", () => {
    expect(normalizeKey(" ")).toBe(" ");
    expect(normalizeKey("Space")).toBe(" ");
    expect(normalizeKey("Spacebar")).toBe(" ");
  });
  it("single char lowercased", () => {
    expect(normalizeKey("S")).toBe("s");
    expect(normalizeKey("s")).toBe("s");
    expect(normalizeKey("A")).toBe("a");
  });
  it("named keys lowercased", () => {
    expect(normalizeKey("Enter")).toBe("enter");
  });
});

describe("formatKey", () => {
  it("space → Espace", () => {
    expect(formatKey(" ")).toBe("Espace");
    expect(formatKey("")).toBe("Espace");
  });
  it("single char → upper", () => {
    expect(formatKey("s")).toBe("S");
    expect(formatKey("a")).toBe("A");
  });
});

describe("isTypingTarget", () => {
  it("input/textarea/select are typing targets", () => {
    const input = document.createElement("input");
    expect(isTypingTarget(input)).toBe(true);
    const textarea = document.createElement("textarea");
    expect(isTypingTarget(textarea)).toBe(true);
    const select = document.createElement("select");
    expect(isTypingTarget(select)).toBe(true);
  });
  it("contenteditable is typing target", () => {
    const div = document.createElement("div");
    div.setAttribute("contenteditable", "true");
    expect(isTypingTarget(div)).toBe(true);
  });
  it("div is not typing target", () => {
    const div = document.createElement("div");
    expect(isTypingTarget(div)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe("normalizeKeybinds", () => {
  it("fallback to defaults on invalid", () => {
    expect(normalizeKeybinds(null)).toEqual(DEFAULT_KEYBINDS);
    expect(normalizeKeybinds({})).toEqual(DEFAULT_KEYBINDS);
  });
  it("normalizes keys", () => {
    expect(normalizeKeybinds({ play: "S", skip: "A" })).toEqual({ play: "s", skip: "a" });
    expect(normalizeKeybinds({ play: " ", skip: "s" })).toEqual({ play: " ", skip: "s" });
  });
  it("handles duplicate play==skip fallback", () => {
    const res = normalizeKeybinds({ play: "s", skip: "s" });
    // Should fallback one to default
    expect(res.play !== res.skip).toBe(true);
  });
});

describe("storage keybinds integration", () => {
  beforeEach(() => {
    __clearAllStorageForTests();
    __resetMemoryStoreForTests();
    try { window.localStorage.clear(); } catch {}
  });
  it("getPrefs defaults keybinds to Espace/S", () => {
    const prefs = getPrefs();
    expect(prefs.keybinds).toEqual({ play: " ", skip: "s" });
  });
  it("setPrefs persists keybinds", () => {
    setPrefs({ keybinds: { play: "p", skip: "k" } });
    expect(getPrefs().keybinds).toEqual({ play: "p", skip: "k" });
  });
  it("migration: legacy Toutes difficulty → Facile still works with keybinds", () => {
    // directly write legacy
    window.localStorage.setItem("songspot-fr:prefs", JSON.stringify({ difficulty: "Toutes", era: "Toutes", keybinds: { play: " ", skip: "s" } }));
    expect(getPrefs().difficulty).toBe("Facile");
    expect(getPrefs().keybinds).toEqual({ play: " ", skip: "s" });
  });
});
