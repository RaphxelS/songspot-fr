/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { LikedTrackWithMeta } from "@/lib/likedMapper";
import type { Track } from "@/lib/catalog";

vi.mock("server-only", () => ({}));

const mockGetToken = vi.fn();
vi.mock("@/lib/spotifyAuth", () => ({
  getValidAccessToken: () => mockGetToken(),
}));

const mockFetchAll = vi.fn();
const mockFetchGenres = vi.fn();
const mockTopTracks = vi.fn();
const mockSearchTracks = vi.fn();
const mockRecommendations = vi.fn();

vi.mock("@/lib/likedFetch", () => ({
  fetchAllLikedTracksWithMeta: (...args: unknown[]) => mockFetchAll(...args),
  fetchArtistGenresMap: (...args: unknown[]) => mockFetchGenres(...args),
  fetchArtistTopTracks: (...args: unknown[]) => mockTopTracks(...args),
  searchArtistTracks: (...args: unknown[]) => mockSearchTracks(...args),
  fetchGenreRecommendations: (...args: unknown[]) => mockRecommendations(...args),
}));

function mkLiked(id: string, artistId: string, artistName: string): LikedTrackWithMeta {
  const track: Track = {
    id,
    title: `Title ${id}`,
    artist: artistName,
    album: "Album",
    cover: "https://i.scdn.co/image/cover.jpg",
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

describe("GET /api/me/liked/catalog", () => {
  beforeEach(() => {
    vi.resetModules();
    mockGetToken.mockResolvedValue("token");
    mockFetchAll.mockResolvedValue({
      tracks: [
        mkLiked("l1", "bp", "BLACKPINK"),
        mkLiked("l2", "bp", "BLACKPINK"),
        mkLiked("l3", "bp", "BLACKPINK"),
        mkLiked("l4", "st", "Stromae"),
      ],
      total: 4,
    });
    mockFetchGenres.mockResolvedValue(
      new Map([
        ["bp", ["k-pop"]],
        ["st", ["french pop"]],
      ]),
    );
    mockTopTracks.mockResolvedValue([
      mkLiked("top1", "bp", "BLACKPINK").track,
      mkLiked("l1", "bp", "BLACKPINK").track,
    ]);
    mockSearchTracks.mockResolvedValue([
      mkLiked("search1", "bp", "BLACKPINK").track,
      mkLiked("l2", "bp", "BLACKPINK").track,
    ]);
    mockRecommendations.mockResolvedValue([
      mkLiked("rec1", "bp", "BLACKPINK").track,
      mkLiked("rec2", "other", "Other").track,
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetToken.mockResolvedValue(null);
    const { GET } = await import("@/app/api/me/liked/catalog/route");
    const res = await GET(new Request("http://localhost/api/me/liked/catalog?scope=artist&artistId=bp"));
    expect(res.status).toBe(401);
  });

  it("filters liked tracks by artist without enrich", async () => {
    const { GET } = await import("@/app/api/me/liked/catalog/route");
    const res = await GET(
      new Request("http://localhost/api/me/liked/catalog?scope=artist&artistId=bp&enrich=0"),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { tracks: Track[]; likedCount: number; enrichedCount: number };
    expect(data.likedCount).toBe(3);
    expect(data.enrichedCount).toBe(0);
    expect(data.tracks).toHaveLength(3);
    expect(data.tracks.every((t) => t.artist.includes("BLACKPINK"))).toBe(true);
    expect(mockTopTracks).not.toHaveBeenCalled();
  });

  it("enriches artist pool and dedupes by track id", async () => {
    const { GET } = await import("@/app/api/me/liked/catalog/route");
    const res = await GET(
      new Request("http://localhost/api/me/liked/catalog?scope=artist&artistId=bp&enrich=1"),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { tracks: Track[]; likedCount: number; enrichedCount: number };
    expect(data.likedCount).toBe(3);
    expect(data.enrichedCount).toBeGreaterThan(0);
    const ids = data.tracks.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(mockTopTracks).toHaveBeenCalledWith("token", "bp");
    expect(mockSearchTracks).toHaveBeenCalledWith("token", "BLACKPINK");
  });

  it("filters liked tracks by genre and enriches with recommendations", async () => {
    const { GET } = await import("@/app/api/me/liked/catalog/route");
    const res = await GET(
      new Request("http://localhost/api/me/liked/catalog?scope=genre&genre=k-pop&enrich=1"),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { tracks: Track[]; likedCount: number; enrichedCount: number };
    expect(data.likedCount).toBe(3);
    expect(data.enrichedCount).toBeGreaterThan(0);
    expect(mockRecommendations).toHaveBeenCalled();
  });
});
