import { describe, it, expect } from "vitest";
import catalog from "@/data/catalog.fr.json";
import { mergeCatalogs, dedupCatalog } from "@/lib/catalog";
import type { Track } from "@/lib/catalog";

describe("catalog.fr.json", () => {
  it("contient au moins 50 entrées (build exige 80)", () => {
    expect(catalog.length).toBeGreaterThanOrEqual(50);
  });

  it("contient au moins 80 entrées pour le build", () => {
    expect(catalog.length).toBeGreaterThanOrEqual(80);
  });

  it("n'a pas de doublons (id unique)", () => {
    const ids = (catalog as unknown as Track[]).map((t) => t.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(catalog.length);
  });

  it("tous les preview_url commencent par https://", () => {
    for (const t of catalog as unknown as Track[]) {
      expect(t.preview_url.startsWith("https://")).toBe(true);
    }
  });

  it("tous les cover commencent par https://i.scdn.co/ ou https://placehold.co/ ou CDN validés", () => {
    const allowedPrefixes = [
      "https://i.scdn.co/",
      "https://placehold.co/",
      "https://is1-ssl.mzstatic.com/",
      "https://is2-ssl.mzstatic.com/",
      "https://is3-ssl.mzstatic.com/",
      "https://is4-ssl.mzstatic.com/",
      "https://is5-ssl.mzstatic.com/",
      "https://cdn-images.dzcdn.net/",
    ];
    for (const t of catalog as unknown as Track[]) {
      const ok = allowedPrefixes.some((p) => t.cover.startsWith(p));
      expect(ok, `cover invalide: ${t.cover}`).toBe(true);
    }
  });

  it("mergeCatalogs déduplique correctement", () => {
    const a = (catalog as unknown as Track[]).slice(0, 5);
    const b = (catalog as unknown as Track[]).slice(3, 8);
    const merged = mergeCatalogs(a, b);
    const ids = merged.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    // a 5 + b 5 - overlap 2 (indices 3,4) = 8
    expect(merged.length).toBe(8);
  });

  it("dedupCatalog supprime les doublons", () => {
    const dup = [...((catalog as unknown as Track[]).slice(0, 3)), ...((catalog as unknown as Track[]).slice(0, 3))];
    const deduped = dedupCatalog(dup);
    expect(deduped.length).toBe(3);
  });

  it("import compile sans erreur TS — type Track valide", () => {
    const first = (catalog as unknown as Track[])[0];
    expect(first).toHaveProperty("id");
    expect(first).toHaveProperty("title");
    expect(first).toHaveProperty("artist");
    expect(first).toHaveProperty("popularity");
  });
});
