import { describe, it, expect } from "vitest";
import { isAllowedImageUrl, toImageProxyUrl } from "@/lib/imageProxy";

describe("imageProxy", () => {
  it("allows Spotify CDN hosts", () => {
    expect(isAllowedImageUrl("https://i.scdn.co/image/abc.jpg")).toBe(true);
    expect(isAllowedImageUrl("https://mosaic.scdn.co/300/abc.jpg")).toBe(true);
    expect(isAllowedImageUrl("https://example.com/x.jpg")).toBe(false);
  });

  it("wraps allowed URLs in /api/img proxy", () => {
    const proxied = toImageProxyUrl("https://i.scdn.co/image/abc.jpg");
    expect(proxied).toBe("/api/img?url=https%3A%2F%2Fi.scdn.co%2Fimage%2Fabc.jpg");
  });
});
