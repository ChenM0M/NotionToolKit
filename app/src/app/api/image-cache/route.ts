import { NextRequest, NextResponse } from "next/server";
import { getImageCache } from "@/lib/image-cache";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }

  const cached = getImageCache(id);
  if (!cached) {
    return NextResponse.json({ error: "Image not found or expired" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(cached.data), {
    headers: {
      "Content-Type": cached.contentType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
