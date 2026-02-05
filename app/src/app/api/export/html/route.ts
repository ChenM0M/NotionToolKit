import { NextRequest, NextResponse } from "next/server";
import { HttpsProxyAgent } from "https-proxy-agent";

export const runtime = "nodejs";

const PROXY_URL = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;

const IMG_TAG_REGEX = /<img\b[^>]*\bsrc=(["'])([^"']+)\1[^>]*>/gi;

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

async function fetchAsDataUri(url: URL, requestUrl: string): Promise<string | null> {
  const selfOrigin = new URL(requestUrl).origin;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  const fetchOptions: RequestInit = {
    signal: controller.signal,
  };

  if (PROXY_URL && url.origin !== selfOrigin) {
    // @ts-expect-error Node.js fetch supports agent option
    fetchOptions.agent = new HttpsProxyAgent(PROXY_URL);
  }

  try {
    const response = await fetch(url, fetchOptions);
    if (!response.ok) {
      return null;
    }

    const contentType = (response.headers.get("content-type") || "application/octet-stream").split(";")[0];
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function embedImages(html: string, requestUrl: string): Promise<string> {
  const matches = [...html.matchAll(IMG_TAG_REGEX)];
  const uniqueSrcs = [...new Set(matches.map((m) => m[2]))];

  if (uniqueSrcs.length === 0) {
    return html;
  }

  const srcToDataUri = new Map<string, string>();
  const concurrency = 4;

  for (let i = 0; i < uniqueSrcs.length; i += concurrency) {
    const batch = uniqueSrcs.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (src) => {
        if (shouldSkipEmbedding(src)) return;
        const url = resolveImageUrl(src, requestUrl);
        if (!url) return;
        const dataUri = await fetchAsDataUri(url, requestUrl);
        if (dataUri) {
          srcToDataUri.set(src, dataUri);
        }
      })
    );
  }

  return html.replace(IMG_TAG_REGEX, (tag, _q, src) => {
    const dataUri = srcToDataUri.get(src);
    if (!dataUri) return tag;
    return tag.replace(/\bsrc=(["'])([^"']+)\1/i, `src="${dataUri}"`);
  });
}

export async function POST(request: NextRequest) {
  try {
    const { html } = await request.json();

    if (!html || typeof html !== "string") {
      return NextResponse.json({ error: "Missing html content" }, { status: 400 });
    }

    const htmlWithEmbeddedImages = await embedImages(html, request.url);
    return NextResponse.json({ html: htmlWithEmbeddedImages });
  } catch (error) {
    console.error("HTML export error:", error);
    return NextResponse.json({ error: "Failed to process HTML" }, { status: 500 });
  }
}
