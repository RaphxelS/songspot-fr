/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
import {
  buildArtistCategories,
  buildGenreCategories,
  dedupeTracksById,
  filterLikedByArtist,
  filterLikedByGenre,
  formatGenreLabel,
} from "@/lib/likedCategories";
import type { LikedTrackWithMeta } from "@/lib/likedMapper";
import type { Track } from "@/lib/catalog";

function mkLiked(
  id: string,
  artistId: string,
  artistName: string,
  title = `Track ${id}`,
): LikedTrackWithMeta {
  const track: Track = {
    id,
    title,
    artist: artistName,
    album: "Album",
    cover: "https://i.scdn.co/image/cover.jpg",
    preview_url: "",
    popularity: 70,
    release_date: "2020-01-01",
    era: "2020s",
    source: "spotify",
  };
  return {
    track,
    meta: {
      primaryArtistId: artistId,
      primaryArtistName: artistName,
      allArtistIds: [artistId],
    },
  };
}

describe("formatGenreLabel", () => {
  it("humanizes genre slugs", () => {
    expect(formatGenreLabel("k-pop")).toBe("K-Pop");
    expect(formatGenreLabel("dance pop")).toBe("Dance Pop");
  });
});

describe("buildArtistCategories", () => {
  it("groups by primary artist and sorts by liked count", () => {
    const liked = [
      mkLiked("1", "bp", "BLACKPINK"),
      mkLiked("2", "bp", "BLACKPINK"),
      mkLiked("3", "bp", "BLACKPINK"),
      mkLiked("4", "st", "Stromae"),
    ];
    const cats = buildArtistCategories(liked);
    expect(cats).toHaveLength(2);
    expect(cats[0]).toMatchObject({ id: "bp", name: "BLACKPINK", likedCount: 3 });
    expect(cats[1]).toMatchObject({ id: "st", name: "Stromae", likedCount: 1 });
  });
});

describe("buildGenreCategories", () => {
  it("counts tracks per genre from artist map", () => {
    const liked = [
      mkLiked("1", "bp", "BLACKPINK"),
      mkLiked("2", "bp", "BLACKPINK"),
      mkLiked("3", "st", "Stromae"),
    ];
    const map = new Map([
      ["bp", ["k-pop", "dance pop"]],
      ["st", ["french pop"]],
    ]);
    const cats = buildGenreCategories(liked, map);
    expect(cats.find((g) => g.name === "k-pop")?.likedCount).toBe(2);
    expect(cats.find((g) => g.name === "french pop")?.likedCount).toBe(1);
  });
});

describe("filterLikedByArtist", () => {
  it("returns only tracks for the selected artist", () => {
    const liked = [
      mkLiked("1", "bp", "BLACKPINK"),
      mkLiked("2", "st", "Stromae"),
      mkLiked("3", "bp", "BLACKPINK"),
    ];
    const filtered = filterLikedByArtist(liked, "bp");
    expect(filtered).toHaveLength(2);
    expect(filtered.every((t) => t.meta.primaryArtistId === "bp")).toBe(true);
  });
});

describe("filterLikedByGenre", () => {
  it("returns tracks whose primary artist has the genre", () => {
    const liked = [
      mkLiked("1", "bp", "BLACKPINK"),
      mkLiked("2", "st", "Stromae"),
    ];
    const map = new Map([
      ["bp", ["k-pop"]],
      ["st", ["french pop"]],
    ]);
    expect(filterLikedByGenre(liked, "k-pop", map)).toHaveLength(1);
    expect(filterLikedByGenre(liked, "french pop", map)).toHaveLength(1);
  });
});

describe("dedupeTracksById", () => {
  it("keeps first occurrence of each track id", () => {
    const t1: Track = mkLiked("a", "x", "X").track;
    const t2: Track = { ...t1, title: "Duplicate title" };
    const t3: Track = mkLiked("b", "y", "Y").track;
    const deduped = dedupeTracksById([t1, t2, t3]);
    expect(deduped).toHaveLength(2);
    expect(deduped[0].title).toBe("Track a");
  });
});

describe("buildRecommendationsParams", () => {
  it("uses comma-separated seed_tracks (max 4 with one genre seed)", async () => {
    const { buildRecommendationsParams } = await import("@/lib/likedFetch");
    const params = buildRecommendationsParams("k-pop", ["a", "b", "c", "d", "e"]);
    expect(params.get("seed_genres")).toBe("k-pop");
    expect(params.get("seed_tracks")).toBe("a,b,c,d");
    expect(params.toString()).not.toMatch(/seed_tracks=.*&seed_tracks=/);
  });
});
