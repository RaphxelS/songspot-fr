import { NextResponse } from "next/server";
import { fetchBestPreview } from "@/lib/preview";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const artist = searchParams.get("artist");
  const title = searchParams.get("title");

  if (!artist || !title) {
    return NextResponse.json({ error: "artist et title requis" }, { status: 400 });
  }

  // Basic validation: artist/title length 1..100
  if (artist.length > 100 || title.length > 100) {
    return NextResponse.json({ error: "param trop long" }, { status: 400 });
  }

  try {
    const result = await fetchBestPreview(artist, title);
    if (!result) {
      return NextResponse.json({ error: "preview introuvable" }, { status: 404 });
    }
    // Cache 1h client, 1h CDN
    return NextResponse.json(
      { previewUrl: result.previewUrl, cover: result.cover, source: result.source },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600",
        },
      }
    );
  } catch (e) {
    console.warn("[preview] error", e);
    return NextResponse.json({ error: "erreur serveur" }, { status: 500 });
  }
}
