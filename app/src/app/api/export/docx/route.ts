import { NextRequest, NextResponse } from "next/server";
import htmlToDocx from "html-to-docx";
import { renderMarkdownToHtmlBody } from "@/lib/server/export/markdown-renderer";
import { embedImagesInHtml } from "@/lib/server/export/embed-images";

export const runtime = "nodejs";

function wrapDocxHtml(bodyHtml: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${bodyHtml}</body></html>`;
}

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

    const rawBodyHtml = hasMarkdown
      ? renderMarkdownToHtmlBody(body.markdown, "docx")
      : body.html;

    const embedded = await embedImagesInHtml(rawBodyHtml, request.url);

    const docxBuffer = await htmlToDocx(wrapDocxHtml(embedded.html), null, {
      table: { row: { cantSplit: true } },
      footer: true,
      pageNumber: true,
    });

    return new NextResponse(new Uint8Array(docxBuffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": "attachment",
      },
    });
  } catch (error) {
    console.error("DOCX generation error:", error);
    return NextResponse.json({ error: "Failed to generate DOCX" }, { status: 500 });
  }
}
