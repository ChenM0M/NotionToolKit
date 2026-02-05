import { NotionToMarkdown } from "notion-to-md";

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
