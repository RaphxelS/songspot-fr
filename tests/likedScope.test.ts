import { describe, it, expect } from "vitest";
import { isValidScopedSelection } from "@/lib/likedScope";

const artists = [{ id: "bp", name: "BLACKPINK" }];
const genres = [{ name: "k-pop", likedCount: 3 }];

describe("isValidScopedSelection", () => {
  it("allows artist scope while picking (null artistId)", () => {
    expect(
      isValidScopedSelection({ scope: "artist", artistId: null, genre: null, enrich: false }, artists, genres),
    ).toBe(true);
  });

  it("allows genre scope while picking (null genre)", () => {
    expect(
      isValidScopedSelection({ scope: "genre", artistId: null, genre: null, enrich: false }, artists, genres),
    ).toBe(true);
  });

  it("rejects stale artist id not in categories", () => {
    expect(
      isValidScopedSelection(
        { scope: "artist", artistId: "removed", genre: null, enrich: false },
        artists,
        genres,
      ),
    ).toBe(false);
  });

  it("accepts valid artist selection", () => {
    expect(
      isValidScopedSelection(
        { scope: "artist", artistId: "bp", genre: null, enrich: false },
        artists,
        genres,
      ),
    ).toBe(true);
  });
});
