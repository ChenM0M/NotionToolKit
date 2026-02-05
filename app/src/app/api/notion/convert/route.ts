import { NotionToMarkdown } from "notion-to-md";
import { NextResponse } from "next/server";
import { getNotionPageId } from "@/lib/notion-utils";
import { HttpsProxyAgent } from "https-proxy-agent";
import { randomUUID } from "crypto";
import { setImageCache } from "@/lib/image-cache";
import { createNotionClient, withRetry } from "@/lib/notion-client";
import type { PageObjectResponse, PartialPageObjectResponse, DatabaseObjectResponse, PartialDatabaseObjectResponse } from "@notionhq/client/build/src/api-endpoints";

const PROXY_URL = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;

/**
 * Extract page title from Notion page response
 */
function extractPageTitle(
  page: PageObjectResponse | PartialPageObjectResponse | DatabaseObjectResponse | PartialDatabaseObjectResponse
): string {
  if ("properties" in page && page.properties) {
    const properties = page.properties;

    for (const key of ["title", "Title", "Name", "name", "Page", "page"]) {
      const prop = properties[key];
      if (prop && "title" in prop && Array.isArray(prop.title) && prop.title.length > 0) {
        return prop.title.map((t: { plain_text: string }) => t.plain_text).join("");
      }
    }

    for (const [, value] of Object.entries(properties)) {
      if (value && typeof value === "object" && "title" in value && Array.isArray(value.title) && value.title.length > 0) {
        return value.title.map((t: { plain_text: string }) => t.plain_text).join("");
      }
    }
  }

  return "notion-export";
}

/**
 * Sanitize filename to remove invalid characters
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 100) || "notion-export";
}

/**
 * Fetch image and cache it, return cache URL
 */
async function fetchAndCacheImage(url: string): Promise<string | null> {
  try {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return null;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const fetchOptions: RequestInit = {
      signal: controller.signal,
    };
    if (PROXY_URL) {
      // @ts-expect-error Node.js fetch supports agent option
      fetchOptions.agent = new HttpsProxyAgent(PROXY_URL);
    }

    const response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Failed to fetch image (${response.status}): ${url.substring(0, 100)}`);
      return null;
    }

    const contentType = response.headers.get("content-type") || "image/png";
    const buffer = await response.arrayBuffer();

    // Generate unique ID and cache the image
    const imageId = randomUUID();
    setImageCache(imageId, Buffer.from(buffer), contentType);

    // Return the cache URL
    return `/api/image-cache?id=${imageId}`;
  } catch (error) {
    console.error(`Error fetching image:`, error);
    return null;
  }
}

/**
 * Process markdown to cache images and replace URLs
 */
async function processImagesInMarkdown(markdown: string): Promise<string> {
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const matches = [...markdown.matchAll(imageRegex)];

  if (matches.length === 0) {
    console.log("No images found in markdown");
    return markdown;
  }

  console.log(`Found ${matches.length} images to process`);

  const urlToCache = new Map<string, string>();

  const uniqueUrls = [...new Set(matches.map(m => m[2]))];
  console.log(`Processing ${uniqueUrls.length} unique image URLs`);

  const results = await Promise.all(
    uniqueUrls.map(async (url) => {
      const cacheUrl = await fetchAndCacheImage(url);
      return { url, cacheUrl };
    })
  );

  let successCount = 0;
  let failCount = 0;
  for (const { url, cacheUrl } of results) {
    if (cacheUrl) {
      urlToCache.set(url, cacheUrl);
      successCount++;
    } else {
      failCount++;
    }
  }
  console.log(`Image processing complete: ${successCount} success, ${failCount} failed`);

  let processedMarkdown = markdown;
  for (const [fullMatch, alt, url] of matches) {
    const cacheUrl = urlToCache.get(url);
    if (cacheUrl) {
      processedMarkdown = processedMarkdown.replace(fullMatch, `![${alt}](${cacheUrl})`);
    }
  }

  return processedMarkdown;
}

export async function POST(request: Request) {
  try {
    const { pageId: rawInput, token } = await request.json();

    if (!rawInput || !token) {
      return NextResponse.json(
        { error: "Missing pageId or token" },
        { status: 400 }
      );
    }

    const pageId = getNotionPageId(rawInput);

    if (!pageId) {
      return NextResponse.json(
        { error: "Invalid Notion Page URL or ID" },
        { status: 400 }
      );
    }

    const notion = createNotionClient(token);

    // Fetch page info with retry
    const pageInfo = await withRetry(
      () => notion.pages.retrieve({ page_id: pageId }),
      3,
      1000
    );
    const rawTitle = extractPageTitle(pageInfo);
    const title = sanitizeFilename(rawTitle);

    const n2m = new NotionToMarkdown({ notionClient: notion });

    // Fetch markdown with retry
    const mdblocks = await withRetry(
      () => n2m.pageToMarkdown(pageId),
      3,
      1000
    );
    let markdown = n2m.toMarkdownString(mdblocks).parent;

    // Process images - cache them and replace URLs
    markdown = await processImagesInMarkdown(markdown);

    return NextResponse.json({
      markdown,
      title,
    });
  } catch (error: unknown) {
    console.error("Notion API Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to convert page";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
