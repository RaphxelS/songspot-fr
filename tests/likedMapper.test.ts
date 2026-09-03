import { describe, it, expect } from "vitest";
import { mapSpotifyTrackWithMeta } from "@/lib/likedMapper";

function mkSpotifyTrack(artists: Array<{ id?: string; name?: string }>) {
  return {
    id: "track1",
    name: "Song",
    preview_url: "https://p.scdn.co/preview.mp3",
    popularity: 80,
    album: {
      name: "Album",
      release_date: "2020-01-01",
      images: [{ url: "https://i.scdn.co/image/cover.jpg" }],
    },
    artists,
  };
}

describe("mapSpotifyTrackWithMeta — primary artist", () => {
  it("derives primary id and name from the same first artist object", () => {
    const result = mapSpotifyTrackWithMeta(
      mkSpotifyTrack([
        { name: "BLACKPINK" }, // missing id on primary artist
        { id: "other-id", name: "Featured" },
      ]),
    );
    expect(result).not.toBeNull();
    expect(result!.meta.primaryArtistName).toBe("BLACKPINK");
    // Must not pair BLACKPINK name with Featured's id
    expect(result!.meta.primaryArtistId).toBe("");
    expect(result!.meta.allArtistIds).toEqual(["other-id"]);
  });

  it("uses first artist id and name when both present", () => {
    const result = mapSpotifyTrackWithMeta(
      mkSpotifyTrack([
        { id: "bp-id", name: "BLACKPINK" },
        { id: "feat-id", name: "Featured" },
      ]),
    );
    expect(result!.meta.primaryArtistId).toBe("bp-id");
    expect(result!.meta.primaryArtistName).toBe("BLACKPINK");
    expect(result!.meta.allArtistIds).toEqual(["bp-id", "feat-id"]);
  });
});
