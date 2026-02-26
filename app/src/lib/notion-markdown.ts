import { NotionToMarkdown } from "notion-to-md";
import type { MdBlock } from "notion-to-md/build/types";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Create a NotionToMarkdown instance with app-specific transformers.
 */
export function createNotionToMarkdown(notionClient: unknown) {
  const n2m = new NotionToMarkdown({
    // notion-to-md expects a Notion SDK client instance.
    // Keep this typed as unknown here to avoid coupling to SDK versions.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    notionClient: notionClient as any,
  });

  // Render child pages like Notion: an icon + underlined title (do not inline content)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  n2m.setCustomTransformer("child_page", async (block: any) => {
    const title: string = block?.child_page?.title || "Untitled";
    const pageId: string = block?.id || "";
    const href = pageId ? `https://www.notion.so/${pageId}` : "";

    const safeTitle = escapeHtml(title);
    const safeHref = escapeHtml(href);

    // Use a wrapper so the preview renderer can style it like Notion.
    if (!safeHref) {
      return `<span class="notion-child-page">📄 ${safeTitle}</span>`;
    }
    return `<span class="notion-child-page">📄 <a href="${safeHref}">${safeTitle}</a></span>`;
  });

  return n2m;
}

function normalizeBlocksForPreview(blocks: MdBlock[]): MdBlock[] {
  return blocks.map((block) => {
    const children = normalizeBlocksForPreview(block.children);

    // notion-to-md's toMarkdownString intentionally skips rendering parent of `child_page`.
    // For preview we want a Notion-like link and we do NOT want to inline the child page content.
    if (block.type === "child_page") {
      return {
        ...block,
        type: "paragraph",
        children: [],
      };
    }

    return {
      ...block,
      children,
    };
  });
}

function sanitizeTableCell(text: string): string {
  // Markdown tables are pipe-delimited; keep the cell single-line.
  return text
    .replace(/\r\n/g, "\n")
    .trim()
    .replace(/\|/g, "&#124;")
    .replace(/\n+/g, "<br />");
}

function buildNotionImageColumnsTable(columnCells: string[]): string {
  const headerCells = columnCells.map((_, idx) =>
    idx === 0 ? '<span data-notion-columns></span>' : ""
  );
  const alignCells = columnCells.map(() => "---");
  const bodyCells = columnCells.map((cell) => (cell.trim() ? cell : "&nbsp;"));

  return [
    `| ${headerCells.join(" | ")} |`,
    `| ${alignCells.join(" | ")} |`,
    `| ${bodyCells.join(" | ")} |`,
  ].join("\n");
}

function isEmptyBlock(block: MdBlock): boolean {
  return !block.parent.trim() && (!block.children || block.children.length === 0);
}

function tryConvertColumnListToImageColumnsTable(block: MdBlock): string | null {
  const columns = (block.children || []).filter((c) => c.type === "column");
  if (columns.length < 2) return null;

  const columnCells: string[] = [];

  for (const col of columns) {
    const contentBlocks = (col.children || []).filter((b) => !isEmptyBlock(b));
    // Only convert when the column contains images only (plus empty spacers).
    if (contentBlocks.some((b) => b.type !== "image")) {
      return null;
    }

    const imagesMd = contentBlocks
      .map((b) => b.parent.trim())
      .filter(Boolean)
      .join("<br />");

    columnCells.push(sanitizeTableCell(imagesMd));
  }

  return buildNotionImageColumnsTable(columnCells);
}

function transformImageColumnLists(blocks: MdBlock[]): MdBlock[] {
  return blocks.map((block) => {
    const children = transformImageColumnLists(block.children);
    const next: MdBlock = {
      ...block,
      children,
    };

    if (next.type === "column_list") {
      const table = tryConvertColumnListToImageColumnsTable(next);
      if (table) {
        return {
          ...next,
          parent: table,
          children: [],
        };
      }
    }

    return next;
  });
}

export function mdBlocksToParentMarkdown(
  n2m: NotionToMarkdown,
  blocks: MdBlock[]
): string {
  const normalized = normalizeBlocksForPreview(blocks);
  const withImageColumns = transformImageColumnLists(normalized);
  const mdString = n2m.toMarkdownString(withImageColumns);
  return mdString.parent ?? "";
}
