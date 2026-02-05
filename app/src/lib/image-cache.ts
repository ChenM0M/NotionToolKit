// In-memory image cache
const imageCache = new Map<string, { data: Buffer; contentType: string; expires: number }>();

// Cache duration: 1 hour
const CACHE_DURATION = 60 * 60 * 1000;

export function setImageCache(id: string, data: Buffer, contentType: string) {
  imageCache.set(id, {
    data,
    contentType,
    expires: Date.now() + CACHE_DURATION,
  });
}

export function getImageCache(id: string) {
  const cached = imageCache.get(id);
  if (cached && cached.expires > Date.now()) {
    return cached;
  }
  if (cached) {
    imageCache.delete(id);
  }
  return null;
}

export function getImageAsBase64(id: string): string | null {
  const cached = getImageCache(id);
  if (!cached) {
    return null;
  }
  return `data:${cached.contentType};base64,${cached.data.toString("base64")}`;
}
