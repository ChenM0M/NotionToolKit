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

export function mdBlocksToParentMarkdown(
  n2m: NotionToMarkdown,
  blocks: MdBlock[]
): string {
  const normalized = normalizeBlocksForPreview(blocks);
  const mdString = n2m.toMarkdownString(normalized);
  return mdString.parent ?? "";
}
