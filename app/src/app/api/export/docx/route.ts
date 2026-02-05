import { NextRequest, NextResponse } from "next/server";
import htmlToDocx from "html-to-docx";
import { getImageAsBase64 } from "@/lib/image-cache";

/**
 * Replace image-cache URLs with base64 data URIs
 */
function embedCachedImages(html: string): string {
  // Match img tags with /api/image-cache URLs
  const imgRegex = /<img\s+[^>]*src=["']\/api\/image-cache\?id=([^"'&]+)["'][^>]*>/gi;
  const matches = [...html.matchAll(imgRegex)];

  console.log(`DOCX export: Found ${matches.length} cached images to embed`);

  let result = html;
  let successCount = 0;

  for (const match of matches) {
    const [fullMatch, imageId] = match;
    console.log(`DOCX export: Processing image ${imageId}`);
    const base64 = getImageAsBase64(imageId);
    if (base64) {
      const newImgTag = fullMatch.replace(/src=["'][^"']+["']/, `src="${base64}"`);
      result = result.replace(fullMatch, newImgTag);
      successCount++;
      console.log(`DOCX export: Embedded image ${imageId} (${base64.length} chars)`);
    } else {
      console.log(`DOCX export: Image ${imageId} not found in cache`);
    }
  }

  console.log(`DOCX export: Embedded ${successCount}/${matches.length} images`);
  return result;
}

export async function POST(request: NextRequest) {
  try {
    const { html } = await request.json();

    if (!html || typeof html !== "string") {
      return NextResponse.json({ error: "Missing html content" }, { status: 400 });
    }

    // Embed cached images as base64 before generating DOCX
    const htmlWithEmbeddedImages = embedCachedImages(html);

    const docxBuffer = await htmlToDocx(
      `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${htmlWithEmbeddedImages}</body></html>`,
      null,
      {
        table: { row: { cantSplit: true } },
        footer: true,
        pageNumber: true,
      }
    );

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
