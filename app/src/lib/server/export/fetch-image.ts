import { HttpsProxyAgent } from "https-proxy-agent";
import { getImageCacheByUrl, setImageCacheByUrl } from "@/lib/image-cache";

const PROXY_URL = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;

export type FetchedImage = {
  url: string;
  contentType: string;
  data: Buffer;
};

export async function fetchImageCached(url: URL, requestUrl: string): Promise<FetchedImage | null> {
  const key = url.toString();
  const cached = getImageCacheByUrl(key);
  if (cached) {
    return {
      url: key,
      contentType: cached.contentType,
      data: cached.data,
    };
  }

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

    const contentType = (response.headers.get("content-type") || "application/octet-stream")
      .split(";")[0];
    const buffer = Buffer.from(await response.arrayBuffer());
    setImageCacheByUrl(key, buffer, contentType);

    return {
      url: key,
      contentType,
      data: buffer,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchImageAsDataUriCached(url: URL, requestUrl: string): Promise<string | null> {
  const key = url.toString();

  const cached = getImageCacheByUrl(key);
  if (cached) {
    return `data:${cached.contentType};base64,${cached.data.toString("base64")}`;
  }

  const fetched = await fetchImageCached(url, requestUrl);
  if (!fetched) return null;
  return `data:${fetched.contentType};base64,${fetched.data.toString("base64")}`;
}
