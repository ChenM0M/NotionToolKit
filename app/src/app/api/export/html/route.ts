import { NextRequest, NextResponse } from "next/server";
import { buildExportHtmlDocument } from "@/lib/server/export/export-template";
import { renderMarkdownToHtmlBody } from "@/lib/server/export/markdown-renderer";
import { embedImagesInHtml } from "@/lib/server/export/embed-images";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const hasMarkdown = body && typeof body.markdown === "string";
    const hasHtml = body && typeof body.html === "string";

    if (!hasMarkdown && !hasHtml) {
      return NextResponse.json(
        { error: "Missing markdown or html content" },
        { status: 400 }
      );
    }

    let html = "";

    if (hasMarkdown) {
      const title = typeof body.title === "string" ? body.title : undefined;
      const bodyHtml = renderMarkdownToHtmlBody(body.markdown, "web");
      html = buildExportHtmlDocument({ title, bodyHtml });
    } else {
      html = body.html;
    }

    const embedded = await embedImagesInHtml(html, request.url);
    return NextResponse.json({ html: embedded.html, images: { total: embedded.total, embedded: embedded.embedded } });
  } catch (error) {
    console.error("HTML export error:", error);
    return NextResponse.json({ error: "Failed to process HTML" }, { status: 500 });
  }
}
