import { fetchImageAsDataUriCached } from "@/lib/server/export/fetch-image";

const IMG_TAG_REGEX = /<img\b[^>]*\bsrc=(["]|['])([^"']+)\1[^>]*>/gi;

function decodeHtmlEntities(text: string): string {
  // We only need a small subset for URLs, but handle numeric entities too.
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const cp = Number.parseInt(hex, 16);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : _;
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const cp = Number.parseInt(dec, 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : _;
    });
}

function shouldSkipEmbedding(src: string): boolean {
  return (
    !src ||
    src.startsWith("data:") ||
    src.startsWith("blob:") ||
    src.startsWith("images/") ||
    src.startsWith("./") ||
    src.startsWith("../")
  );
}

function resolveImageUrl(src: string, requestUrl: string): URL | null {
  try {
    // If HTML already contains our proxy URL, try to extract original URL.
    if (src.startsWith("/api/proxy-image")) {
      const proxied = new URL(src, requestUrl);
      const inner = proxied.searchParams.get("url");
      if (inner) {
        const innerUrl = new URL(inner, requestUrl);
        if (innerUrl.protocol === "http:" || innerUrl.protocol === "https:") {
          return innerUrl;
        }
      }
      return proxied;
    }

    const url = new URL(src, requestUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export async function embedImagesInHtml(
  html: string,
  requestUrl: string,
  options?: { concurrency?: number }
): Promise<{ html: string; total: number; embedded: number }> {
  const matches = [...html.matchAll(IMG_TAG_REGEX)];
  const uniqueSrcs = [...new Set(matches.map((m) => m[2]))];

  if (uniqueSrcs.length === 0) {
    return { html, total: 0, embedded: 0 };
  }

  const srcToDataUri = new Map<string, string>();
  const concurrency = Math.max(1, options?.concurrency ?? 4);

  for (let i = 0; i < uniqueSrcs.length; i += concurrency) {
    const batch = uniqueSrcs.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (src) => {
        const decodedSrc = decodeHtmlEntities(src);
        if (shouldSkipEmbedding(decodedSrc)) return;
        const url = resolveImageUrl(decodedSrc, requestUrl);
        if (!url) return;
        const dataUri = await fetchImageAsDataUriCached(url, requestUrl);
        if (dataUri) {
          srcToDataUri.set(src, dataUri);
        }
      })
    );
  }

  const embedded = srcToDataUri.size;
  const replacedHtml = html.replace(IMG_TAG_REGEX, (tag, _q, src) => {
    const dataUri = srcToDataUri.get(src);
    if (!dataUri) return tag;
    return tag.replace(/\bsrc=(["]|['])([^"']+)\1/i, `src="${dataUri}"`);
  });

  return { html: replacedHtml, total: uniqueSrcs.length, embedded };
}
