import { NextResponse } from "next/server";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { createNotionClient, withRetry } from "@/lib/notion-client";

export const runtime = "nodejs";

export interface NotionPageInfo {
  id: string;
  title: string;
  icon?: { type: "emoji" | "external"; value: string };
  parent: { type: "workspace" | "page_id" | "database_id"; id?: string };
  lastEdited: string;
  isDatabase: boolean;
}

function extractTitle(item: PageObjectResponse): string {
  if ("properties" in item && item.properties) {
    const properties = item.properties;
    for (const key of ["title", "Title", "Name", "name", "Page", "page"]) {
      const prop = properties[key];
      if (
        prop &&
        "title" in prop &&
        Array.isArray(prop.title) &&
        prop.title.length > 0
      ) {
        return prop.title
          .map((t: { plain_text: string }) => t.plain_text)
          .join("");
      }
    }
    for (const value of Object.values(properties)) {
      if (
        value &&
        typeof value === "object" &&
        "title" in value &&
        Array.isArray(value.title) &&
        value.title.length > 0
      ) {
        return value.title
          .map((t: { plain_text: string }) => t.plain_text)
          .join("");
      }
    }
  }

  return "Untitled";
}

function extractIcon(
  item: PageObjectResponse
): NotionPageInfo["icon"] | undefined {
  if (!item.icon) return undefined;

  if (item.icon.type === "emoji") {
    return { type: "emoji", value: item.icon.emoji };
  }
  if (item.icon.type === "external") {
    return { type: "external", value: item.icon.external.url };
  }
  if (item.icon.type === "file") {
    return { type: "external", value: item.icon.file.url };
  }
  return undefined;
}

function extractParent(item: PageObjectResponse): NotionPageInfo["parent"] {
  const parent = item.parent;
  if (parent.type === "workspace") {
    return { type: "workspace" };
  }
  if (parent.type === "page_id") {
    return { type: "page_id", id: parent.page_id };
  }
  if (parent.type === "database_id") {
    return { type: "database_id", id: parent.database_id };
  }
  return { type: "workspace" };
}

export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const notion = createNotionClient(token);

    const pages: NotionPageInfo[] = [];
    let hasMore = true;
    let startCursor: string | undefined = undefined;

    // Fetch all pages with retry
    while (hasMore) {
      const response = await withRetry(
        () => notion.search({
          start_cursor: startCursor,
          page_size: 100,
        }),
        3,
        1000
      );

      for (const item of response.results) {
        // Only process pages (skip databases)
        if (item.object === "page" && "properties" in item) {
          const page = item as PageObjectResponse;
          pages.push({
            id: page.id,
            title: extractTitle(page),
            icon: extractIcon(page),
            parent: extractParent(page),
            lastEdited: page.last_edited_time,
            isDatabase: false,
          });
        }
      }

      hasMore = response.has_more;
      startCursor = response.next_cursor ?? undefined;
    }

    return NextResponse.json({ pages });
  } catch (error: unknown) {
    console.error("Notion Search API Error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to search pages";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
