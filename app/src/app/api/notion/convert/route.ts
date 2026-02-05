import { NextResponse } from "next/server";
import { getNotionPageId } from "@/lib/notion-utils";
import { createNotionClient, withRetry } from "@/lib/notion-client";
import { createNotionToMarkdown, mdBlocksToParentMarkdown } from "@/lib/notion-markdown";
import type { PageObjectResponse, PartialPageObjectResponse, DatabaseObjectResponse, PartialDatabaseObjectResponse } from "@notionhq/client/build/src/api-endpoints";

export const runtime = "nodejs";

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

    const n2m = createNotionToMarkdown(notion);

    // Fetch markdown with retry
    const mdblocks = await withRetry(
      () => n2m.pageToMarkdown(pageId),
      3,
      1000
    );
    const markdown = mdBlocksToParentMarkdown(n2m, mdblocks);

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
