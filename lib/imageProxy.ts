const ALLOWED_HOSTS = new Set([
  "i.scdn.co",
  "mosaic.scdn.co",
  "image-cdn-ak.spotifycdn.com",
  "image-cdn-fa.spotifycdn.com",
]);

export function isAllowedImageUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return ALLOWED_HOSTS.has(host) || host.endsWith(".spotifycdn.com");
  } catch {
    return false;
  }
}

/** Serve Spotify CDN images through our origin to avoid hotlink / referrer issues. */
export function toImageProxyUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (!isAllowedImageUrl(url)) return url;
  return `/api/img?url=${encodeURIComponent(url)}`;
}
