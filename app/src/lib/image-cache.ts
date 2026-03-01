import crypto from "node:crypto";

// In-memory image cache (server only)
const imageCache = new Map<
  string,
  { data: Buffer; contentType: string; expires: number; createdAt: number }
>();

// Cache duration: 1 hour
const CACHE_DURATION = 60 * 60 * 1000;
// Soft cap to avoid unbounded memory growth
const MAX_ENTRIES = 400;

function pruneIfNeeded() {
  if (imageCache.size <= MAX_ENTRIES) return;
  const overflow = imageCache.size - MAX_ENTRIES;
  const keys = imageCache.keys();
  for (let i = 0; i < overflow; i++) {
    const k = keys.next().value as string | undefined;
    if (!k) break;
    imageCache.delete(k);
  }
}

export function getImageCacheIdFromUrl(url: string): string {
  return crypto.createHash("sha256").update(url).digest("hex").slice(0, 32);
}

export function setImageCache(id: string, data: Buffer, contentType: string) {
  imageCache.set(id, {
    data,
    contentType,
    expires: Date.now() + CACHE_DURATION,
    createdAt: Date.now(),
  });
  pruneIfNeeded();
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

export function setImageCacheByUrl(url: string, data: Buffer, contentType: string): string {
  const id = getImageCacheIdFromUrl(url);
  setImageCache(id, data, contentType);
  return id;
}

export function getImageCacheByUrl(url: string) {
  return getImageCache(getImageCacheIdFromUrl(url));
}

export function getImageAsBase64(id: string): string | null {
  const cached = getImageCache(id);
  if (!cached) {
    return null;
  }
  return `data:${cached.contentType};base64,${cached.data.toString("base64")}`;
}

export function getImageAsBase64ByUrl(url: string): string | null {
  const cached = getImageCacheByUrl(url);
  if (!cached) return null;
  return `data:${cached.contentType};base64,${cached.data.toString("base64")}`;
}
