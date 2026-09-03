/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LikedTrackWithMeta } from "@/lib/likedMapper";
import type { Track } from "@/lib/catalog";

vi.mock("server-only", () => ({}));

const mockGetToken = vi.fn();
vi.mock("@/lib/spotifyAuth", () => ({
  getValidAccessToken: () => mockGetToken(),
}));

const mockFetchAll = vi.fn();
const mockFetchProfiles = vi.fn();

vi.mock("@/lib/likedFetch", () => ({
  fetchAllLikedTracksWithMeta: (...args: unknown[]) => mockFetchAll(...args),
  fetchArtistProfilesMap: (...args: unknown[]) => mockFetchProfiles(...args),
}));

function mkLiked(id: string, artistId: string, artistName: string, cover: string): LikedTrackWithMeta {
  const track: Track = {
    id,
    title: `Title ${id}`,
    artist: artistName,
    album: "Album",
    cover,
    preview_url: "https://p.scdn.co/preview.mp3",
    popularity: 80,
    release_date: "2020-01-01",
    era: "2020s",
    source: "spotify",
  };
  return {
    track,
    meta: { primaryArtistId: artistId, primaryArtistName: artistName, allArtistIds: [artistId] },
  };
}

describe("GET /api/me/liked/categories", () => {
  beforeEach(() => {
    vi.resetModules();
    mockGetToken.mockResolvedValue("user-token");
    mockFetchAll.mockResolvedValue({
      tracks: [
        mkLiked("l1", "bp", "BLACKPINK", "https://i.scdn.co/image/album-cover.jpg"),
        mkLiked("l2", "bp", "BLACKPINK", "https://i.scdn.co/image/album-cover.jpg"),
        mkLiked("l3", "st", "Stromae", "https://i.scdn.co/image/stromae-cover.jpg"),
      ],
      total: 3,
    });
    mockFetchProfiles.mockResolvedValue(
      new Map([
        ["bp", { genres: ["k-pop"], imageUrl: "https://i.scdn.co/image/blackpink-artist.jpg" }],
        ["st", { genres: ["french pop"] }],
      ]),
    );
  });

  it("prefers album cover from liked tracks over Spotify profile image", async () => {
    const { GET } = await import("@/app/api/me/liked/categories/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      artists: Array<{ id: string; imageUrl?: string }>;
    };
    const bp = body.artists.find((a) => a.id === "bp");
    const st = body.artists.find((a) => a.id === "st");
    expect(bp?.imageUrl).toBe("https://i.scdn.co/image/album-cover.jpg");
    expect(st?.imageUrl).toBe("https://i.scdn.co/image/stromae-cover.jpg");
  });

  it("falls back to Spotify profile image when album cover is missing", async () => {
    const track = mkLiked("l1", "solo", "Solo Artist", "https://i.scdn.co/image/album.jpg");
    const withoutCover: LikedTrackWithMeta = {
      ...track,
      track: { ...track.track, cover: "" },
    };
    mockFetchAll.mockResolvedValue({ tracks: [withoutCover], total: 1 });
    mockFetchProfiles.mockResolvedValue(
      new Map([["solo", { genres: ["pop"], imageUrl: "https://i.scdn.co/image/profile-only.jpg" }]]),
    );

    const { GET } = await import("@/app/api/me/liked/categories/route");
    const res = await GET();
    const body = (await res.json()) as { artists: Array<{ imageUrl?: string }> };
    expect(body.artists[0]?.imageUrl).toBe("https://i.scdn.co/image/profile-only.jpg");
  });
});
