import { NextResponse } from "next/server";
import catalogFallback from "@/data/catalog.fr.json";
import { fetchAllCatalog } from "@/lib/spotify";
import { CatalogSchema } from "@/lib/validation";
import { refreshCatalogPreviews } from "@/lib/preview";

export const revalidate = 3600;

const CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400";

export async function GET() {
  // Sans creds → fallback direct mais avec refresh des previews expirés
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    console.warn("SPOTIFY creds missing — serving fallback JSON (with preview refresh)");
    try {
      const refreshed = await refreshCatalogPreviews(catalogFallback as unknown as Array<{ preview_url: string; artist: string; title: string; cover: string; source?: string }>, 8);
      const parsed = CatalogSchema.safeParse(refreshed);
      if (parsed.success) {
        return NextResponse.json(parsed.data, {
          headers: { "Cache-Control": CACHE_CONTROL },
        });
      }
    } catch {}
    return NextResponse.json(catalogFallback, {
      headers: {
        "Cache-Control": CACHE_CONTROL,
      },
    });
  }

  try {
    const tracks = await fetchAllCatalog();

    if (!tracks || tracks.length === 0) {
      console.warn("Spotify catalog empty — serving fallback JSON");
      try {
        const refreshed = await refreshCatalogPreviews(catalogFallback as unknown as Array<{ preview_url: string; artist: string; title: string; cover: string; source?: string }>, 8);
        const parsed2 = CatalogSchema.safeParse(refreshed);
        if (parsed2.success) return NextResponse.json(parsed2.data, { headers: { "Cache-Control": CACHE_CONTROL } });
      } catch {}
      return NextResponse.json(catalogFallback, {
        headers: {
          "Cache-Control": CACHE_CONTROL,
        },
      });
    }

    // Zod validation
    const parsed = CatalogSchema.safeParse(tracks);
    if (!parsed.success) {
      console.warn("Spotify catalog Zod validation failed — serving fallback JSON", parsed.error.flatten());
      try {
        const refreshed = await refreshCatalogPreviews(catalogFallback as unknown as Array<{ preview_url: string; artist: string; title: string; cover: string; source?: string }>, 8);
        const parsed2 = CatalogSchema.safeParse(refreshed);
        if (parsed2.success) return NextResponse.json(parsed2.data, { headers: { "Cache-Control": CACHE_CONTROL } });
      } catch {}
      return NextResponse.json(catalogFallback, {
        headers: {
          "Cache-Control": CACHE_CONTROL,
        },
      });
    }

    // Succès : enrichir les previews Spotify (tous null depuis 2024) avec iTunes/Deezer si besoin
    // Si les tracks Spotify n'ont pas de preview_url, on refresh via iTunes/Deezer (max 10)
    const needsEnrich = parsed.data.some((t) => !t.preview_url || t.preview_url.includes("soundhelix"));
    if (needsEnrich) {
      try {
        const refreshed = await refreshCatalogPreviews(parsed.data as unknown as Array<{ preview_url: string; artist: string; title: string; cover: string; source?: string }>, 12);
        const reparsed = CatalogSchema.safeParse(refreshed);
        if (reparsed.success && reparsed.data.length >= 80) {
          return NextResponse.json(reparsed.data, {
            headers: { "Cache-Control": CACHE_CONTROL },
          });
        }
      } catch {}
    }

    return NextResponse.json(parsed.data, {
      headers: {
        "Cache-Control": CACHE_CONTROL,
      },
    });
  } catch (e) {
    console.warn("Spotify fetch failed — serving fallback JSON", e);
    try {
      const refreshed = await refreshCatalogPreviews(catalogFallback as unknown as Array<{ preview_url: string; artist: string; title: string; cover: string; source?: string }>, 8);
      const parsed2 = CatalogSchema.safeParse(refreshed);
      if (parsed2.success) return NextResponse.json(parsed2.data, { headers: { "Cache-Control": CACHE_CONTROL } });
    } catch {}
    return NextResponse.json(catalogFallback, {
      headers: {
        "Cache-Control": CACHE_CONTROL,
      },
    });
  }
}
