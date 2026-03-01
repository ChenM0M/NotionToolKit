import { NextRequest, NextResponse } from "next/server";
import { HttpsProxyAgent } from "https-proxy-agent";
import { getImageCacheByUrl, setImageCacheByUrl } from "@/lib/image-cache";

export const runtime = "nodejs";

const PROXY_URL = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;

function resolveFetchUrl(rawUrl: string, requestUrl: string): string | null {
  try {
    const url = new URL(rawUrl, requestUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const urlParam = request.nextUrl.searchParams.get("url");

  if (!urlParam) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  const targetUrl = resolveFetchUrl(urlParam, request.url);
  if (!targetUrl) {
    return NextResponse.json({ error: "Invalid url parameter" }, { status: 400 });
  }

  try {
    const cached = getImageCacheByUrl(targetUrl);
    if (cached) {
      return new NextResponse(new Uint8Array(cached.data), {
        headers: {
          "Content-Type": cached.contentType,
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
          "X-Image-Cache": "HIT",
        },
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    const fetchOptions: RequestInit = {
      signal: controller.signal,
    };
    if (PROXY_URL) {
      // @ts-expect-error Node.js fetch supports agent option
      fetchOptions.agent = new HttpsProxyAgent(PROXY_URL);
    }

    let response: Response;
    try {
      response = await fetch(targetUrl, fetchOptions);
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch image" },
        { status: response.status }
      );
    }

    const contentType =
      response.headers.get("content-type") || "application/octet-stream";
    const buffer = Buffer.from(await response.arrayBuffer());

    setImageCacheByUrl(targetUrl, buffer, contentType.split(";")[0]);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        "X-Image-Cache": "MISS",
      },
    });
  } catch (error) {
    console.error("Proxy Error:", error);
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 500 });
  }
}
