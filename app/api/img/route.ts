import { isAllowedImageUrl } from "@/lib/imageProxy";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get("url");
  if (!url || !isAllowedImageUrl(url)) {
    return new Response("Invalid image URL", { status: 400 });
  }

  try {
    const upstream = await fetch(url, {
      headers: { Accept: "image/*" },
      next: { revalidate: 86400 },
    });
    if (!upstream.ok) {
      return new Response("Upstream error", { status: upstream.status });
    }

    const contentType = upstream.headers.get("Content-Type") ?? "image/jpeg";
    return new Response(upstream.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return new Response("Fetch failed", { status: 502 });
  }
}
