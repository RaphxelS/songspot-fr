import { describe, it, expect } from "vitest";
import { TrackSchema, CatalogSchema } from "@/lib/validation";
import catalog from "@/data/catalog.fr.json";

describe("validation TrackSchema", () => {
  it("valide le catalogue complet sans erreur", () => {
    const result = CatalogSchema.safeParse(catalog);
    expect(result.success).toBe(true);
    if (!result.success) {
      console.error(result.error.format());
    }
  });

  it("valide chaque track individuellement", () => {
    for (const track of catalog as unknown[]) {
      const result = TrackSchema.safeParse(track);
      expect(result.success).toBe(true);
    }
  });

  it("rejette une track invalide (popularity hors borne)", () => {
    const invalid = {
      id: "test123",
      title: "Test",
      artist: "Artist",
      album: "Album",
      cover: "https://i.scdn.co/image/test",
      preview_url: "https://example.com/audio.mp3",
      popularity: 150, // invalide >100
      release_date: "2020-01-01",
      era: "2020s",
      source: "spotify",
    };
    const result = TrackSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejette une track avec preview_url non https", () => {
    const invalid = {
      id: "test123",
      title: "Test",
      artist: "Artist",
      album: "Album",
      cover: "https://i.scdn.co/image/test",
      preview_url: "http://example.com/audio.mp3", // http pas https
      popularity: 50,
      release_date: "2020-01-01",
      era: "2020s",
      source: "spotify",
    };
    const result = TrackSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejette une track avec release_date mal formatée", () => {
    const invalid = {
      id: "test123",
      title: "Test",
      artist: "Artist",
      album: "Album",
      cover: "https://i.scdn.co/image/test",
      preview_url: "https://example.com/audio.mp3",
      popularity: 50,
      release_date: "01-01-2020", // mauvais format
      era: "2020s",
      source: "spotify",
    };
    const result = TrackSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejette une track avec era invalide", () => {
    const invalid = {
      id: "test123",
      title: "Test",
      artist: "Artist",
      album: "Album",
      cover: "https://i.scdn.co/image/test",
      preview_url: "https://example.com/audio.mp3",
      popularity: 50,
      release_date: "2020-01-01",
      era: "1990s", // invalide
      source: "spotify",
    };
    const result = TrackSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("import compile sans erreur TS — TrackSchema.safeParse disponible", () => {
    expect(typeof TrackSchema.safeParse).toBe("function");
  });
});
