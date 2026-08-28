/**
 * tests/share.test.ts — lib/share T10
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  buildShareUrl,
  buildShareUrlFull,
  copyShareUrl,
  parseShareUrl,
  buildChallengeBanner,
  TOAST_CHALLENGE_NOT_FOUND,
  CHALLENGE_BANNER_PREFIX,
} from "@/lib/share";
import type { Track } from "@/lib/catalog";

function mkTrack(overrides: Partial<Track> & { id: string }): Track {
  return {
    id: overrides.id,
    title: overrides.title ?? "Titre",
    artist: overrides.artist ?? "Artiste",
    album: overrides.album ?? "Album",
    cover: overrides.cover ?? "https://i.scdn.co/image/cover",
    preview_url: overrides.preview_url ?? "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    popularity: overrides.popularity ?? 80,
    release_date: overrides.release_date ?? "2022-01-01",
    era: (overrides.era as Track["era"]) ?? "2020s",
    source: "spotify" as const,
  };
}

const CATALOG: Track[] = [
  mkTrack({ id: "abc123", title: "Djadja", artist: "Aya Nakamura" }),
  mkTrack({ id: "def456", title: "Pookie", artist: "Aya Nakamura" }),
  mkTrack({ id: "ghi789", title: "Angele", artist: "Angele" }),
];

describe("lib/share — buildShareUrl", () => {
  it("buildShareUrl retourne ?track et difficulty sans stage", () => {
    const url = buildShareUrl("abc123", "Facile");
    expect(url).toContain("track=abc123");
    expect(url).toContain("difficulty=Facile");
    expect(url).not.toContain("stage");
    expect(url.startsWith("?")).toBe(true);
  });

  it("buildShareUrlFull retourne URL complete sans stage", () => {
    const full = buildShareUrlFull("abc123", "Expert", "https://example.com/game");
    expect(full).toContain("track=abc123");
    expect(full).toContain("difficulty=Expert");
    expect(full).not.toContain("stage");
    expect(full).toBe("https://example.com/game?track=abc123&difficulty=Expert");
  });

  it("round-trip retrouve 2 valeurs", () => {
    const built = buildShareUrl("abc123", "Facile");
    const params = new URLSearchParams(built);
    const parsed = parseShareUrl(params, CATALOG);
    expect(parsed.isValid).toBe(true);
    expect(parsed.trackId).toBe("abc123");
    expect(parsed.difficulty).toBe("Facile");
    expect(parsed.track).not.toBeNull();
    expect(params.has("stage")).toBe(false);
  });

  it("stage toujours omis", () => {
    const url = buildShareUrl("abc123", "Facile");
    const params = new URLSearchParams(url);
    expect(params.get("stage")).toBeNull();
  });

  it("round-trip 2 valeurs Expert", () => {
    const built = buildShareUrl("def456", "Expert");
    const parsed = parseShareUrl(new URLSearchParams(built), CATALOG);
    expect(parsed.isValid).toBe(true);
    expect(parsed.trackId).toBe("def456");
    expect(parsed.difficulty).toBe("Expert");
  });
});

describe("lib/share — parseShareUrl allowlist", () => {
  it("allowlist id dans catalog -> isValid true", () => {
    const params = new URLSearchParams("?track=abc123&difficulty=Facile");
    const result = parseShareUrl(params, CATALOG);
    expect(result.isValid).toBe(true);
    expect(result.track?.id).toBe("abc123");
  });

  it("allowlist id hors catalog -> false + toast", () => {
    const params = new URLSearchParams("?track=invalid_id&difficulty=Expert");
    const result = parseShareUrl(params, CATALOG);
    expect(result.isValid).toBe(false);
    expect(result.track).toBeNull();
    expect(result.toast).toBe(TOAST_CHALLENGE_NOT_FOUND);
  });

  it("sans track -> toast null", () => {
    const params = new URLSearchParams("?difficulty=Expert");
    const result = parseShareUrl(params, CATALOG);
    expect(result.isValid).toBe(false);
    expect(result.toast).toBeNull();
  });

  it("difficulty invalide -> track valide mais difficulty null", () => {
    const params = new URLSearchParams("?track=abc123&difficulty=InvalidTier");
    const result = parseShareUrl(params, CATALOG);
    expect(result.isValid).toBe(true);
    expect(result.difficulty).toBeNull();
  });

  it("buildChallengeBanner FR", () => {
    expect(buildChallengeBanner("Expert")).toBe("Défi : devine ce morceau ! (difficulté Expert)");
    expect(buildChallengeBanner(null)).toBe(CHALLENGE_BANNER_PREFIX);
  });
});

describe("lib/share — clipboard", () => {
  beforeEach(() => {
    Object.defineProperty(window, "navigator", {
      value: { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }, userAgent: "test" },
      writable: true,
      configurable: true,
    });
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it("copyShareUrl appelle clipboard", async () => {
    const mockWrite = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: mockWrite },
      writable: true,
      configurable: true,
    });
    const ok = await copyShareUrl("abc123", "Facile", "https://example.com");
    expect(mockWrite).toHaveBeenCalledTimes(1);
    const calledUrl = mockWrite.mock.calls[0][0] as string;
    expect(calledUrl).toContain("track=abc123");
    expect(calledUrl).not.toContain("stage");
    expect(ok).toBe(true);
  });

  it("copyShareUrl round-trip sans stage", async () => {
    const mockWrite = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: mockWrite },
      writable: true,
      configurable: true,
    });
    const url = buildShareUrlFull("ghi789", "Moyen", "https://songspot.fr");
    expect(url).toBe("https://songspot.fr?track=ghi789&difficulty=Moyen");
    await copyShareUrl("ghi789", "Moyen", "https://songspot.fr");
    expect(mockWrite).toHaveBeenCalledWith(url);
  });

  it("copyShareUrl absence clipboard fallback", async () => {
    delete (navigator as unknown as { clipboard?: unknown }).clipboard;
    const ok = await copyShareUrl("abc123", "Facile");
    expect(typeof ok).toBe("boolean");
  });
});

describe("lib/share — Zod", () => {
  it("ShareParamsSchema valide 2 valeurs sans stage", async () => {
    const { ShareParamsSchema } = await import("@/lib/share");
    const ok = ShareParamsSchema.safeParse({ track: "abc", difficulty: "Facile" });
    expect(ok.success).toBe(true);
    const withStage = ShareParamsSchema.safeParse({ track: "abc", difficulty: "Facile", stage: 2 });
    expect(withStage.success).toBe(true);
    if (withStage.success) {
      expect((withStage.data as Record<string, unknown>).stage).toBeUndefined();
    }
  });
});
