import { NextResponse } from "next/server";
import catalogFallback from "@/data/catalog.fr.json";
import { fetchAllCatalog } from "@/lib/spotify";
import { CatalogSchema } from "@/lib/validation";

export const revalidate = 3600;
export const dynamic = "force-dynamic";

const CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400";

export async function GET() {
  // Sans creds → fallback direct + warn
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    console.warn("SPOTIFY creds missing — serving fallback JSON");
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
      return NextResponse.json(catalogFallback, {
        headers: {
          "Cache-Control": CACHE_CONTROL,
        },
      });
    }

    // Succès : retourne le catalogue live validé
    return NextResponse.json(parsed.data, {
      headers: {
        "Cache-Control": CACHE_CONTROL,
      },
    });
  } catch (e) {
    console.warn("Spotify fetch failed — serving fallback JSON", e);
    return NextResponse.json(catalogFallback, {
      headers: {
        "Cache-Control": CACHE_CONTROL,
      },
    });
  }
}
