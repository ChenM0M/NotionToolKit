import { HttpsProxyAgent } from "https-proxy-agent";
import { getImageCacheByUrl, setImageCacheByUrl } from "@/lib/image-cache";

const PROXY_URL = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function sniffContentType(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;

  // PNG
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }

  // JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    return "image/jpeg";
  }

  // GIF
  const first6 = buffer.subarray(0, 6).toString("ascii");
  if (first6 === "GIF87a" || first6 === "GIF89a") {
    return "image/gif";
  }

  // WEBP
  const riff = buffer.subarray(0, 4).toString("ascii");
  const webp = buffer.subarray(8, 12).toString("ascii");
  if (riff === "RIFF" && webp === "WEBP") {
    return "image/webp";
  }

  // BMP
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) {
    return "image/bmp";
  }

  // AVIF (ISO BMFF)
  const box = buffer.subarray(4, 12).toString("ascii");
  if (box.startsWith("ftypavif") || box.startsWith("ftypavis")) {
    return "image/avif";
  }

  // SVG (text)
  const prefix = buffer.subarray(0, Math.min(buffer.length, 256)).toString("utf8");
  if (prefix.includes("<svg")) {
    return "image/svg+xml";
  }

  return null;
}

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
  const makeFetchOptions = (controller: AbortController): RequestInit => {
    const fetchOptions: RequestInit = {
      signal: controller.signal,
      headers: {
        accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "user-agent": DEFAULT_UA,
      },
    };

    if (PROXY_URL && url.origin !== selfOrigin) {
      // @ts-expect-error Node.js fetch supports agent option
      fetchOptions.agent = new HttpsProxyAgent(PROXY_URL);
    }
    return fetchOptions;
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45_000);

    try {
      const response = await fetch(url, makeFetchOptions(controller));
      if (!response.ok) {
        // Retry only on transient statuses.
        if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
          await new Promise((r) => setTimeout(r, 350));
          continue;
        }
        return null;
      }

      const headerType = (response.headers.get("content-type") || "application/octet-stream")
        .split(";")[0]
        .trim();
      const buffer = Buffer.from(await response.arrayBuffer());

      const sniffed = sniffContentType(buffer);
      const contentType = headerType.startsWith("image/") ? headerType : sniffed || headerType;

      setImageCacheByUrl(key, buffer, contentType);

      return {
        url: key,
        contentType,
        data: buffer,
      };
    } catch {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 350));
        continue;
      }
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return null;
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
