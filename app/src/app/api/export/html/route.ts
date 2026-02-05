import { NextRequest, NextResponse } from "next/server";
import { getImageAsBase64 } from "@/lib/image-cache";

/**
 * Replace image-cache URLs with base64 data URIs
 */
function embedCachedImages(html: string): string {
  // Match img tags with /api/image-cache URLs
  const imgRegex = /<img\s+[^>]*src=["']\/api\/image-cache\?id=([^"'&]+)["'][^>]*>/gi;

  return html.replace(imgRegex, (match, imageId) => {
    const base64 = getImageAsBase64(imageId);
    if (base64) {
      return match.replace(/src=["'][^"']+["']/, `src="${base64}"`);
    }
    return match;
  });
}

export async function POST(request: NextRequest) {
  try {
    const { html } = await request.json();

    if (!html || typeof html !== "string") {
      return NextResponse.json({ error: "Missing html content" }, { status: 400 });
    }

    // Embed cached images as base64
    const htmlWithEmbeddedImages = embedCachedImages(html);

    return NextResponse.json({ html: htmlWithEmbeddedImages });
  } catch (error) {
    console.error("HTML export error:", error);
    return NextResponse.json({ error: "Failed to process HTML" }, { status: 500 });
  }
}
