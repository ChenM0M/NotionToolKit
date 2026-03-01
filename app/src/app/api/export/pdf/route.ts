import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import puppeteer from "puppeteer-core";
import type { Page } from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { buildExportHtmlDocument } from "@/lib/server/export/export-template";
import { renderMarkdownToHtmlBody } from "@/lib/server/export/markdown-renderer";
import { embedImagesInHtml } from "@/lib/server/export/embed-images";

export const runtime = "nodejs";

function firstExistingPath(paths: string[]): string | null {
  for (const p of paths) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

async function resolveExecutablePath(): Promise<string | null> {
  const fromEnv =
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    process.env.CHROME_PATH ||
    process.env.CHROMIUM_PATH;

  if (fromEnv && fs.existsSync(fromEnv)) {
    return fromEnv;
  }

  // Local dev (Windows): try common Chrome/Edge paths.
  const localCandidates = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ];
  const local = firstExistingPath(localCandidates);
  if (local) return local;

  // Serverless: @sparticuz/chromium provides a compatible binary.
  try {
    const p = await chromium.executablePath();
    if (p && fs.existsSync(p)) return p;
  } catch {
    // ignore
  }

  return null;
}

async function waitForImagesAndFonts(page: Page) {
  await page.evaluate(async () => {
    // Wait for fonts (if supported)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyDoc = document as any;
    if (anyDoc.fonts?.ready) {
      try {
        await anyDoc.fonts.ready;
      } catch {
        // ignore
      }
    }

    const imgs = Array.from(document.images);
    await Promise.all(
      imgs.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        });
      })
    );
  });
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

    const title = typeof body.title === "string" ? body.title : "Notion Export";

    let html = "";
    if (hasMarkdown) {
      const bodyHtml = renderMarkdownToHtmlBody(body.markdown, "web");
      html = buildExportHtmlDocument({ title, bodyHtml });
    } else {
      html = body.html;
    }

    const embedded = await embedImagesInHtml(html, request.url);

    const executablePath = await resolveExecutablePath();
    if (!executablePath) {
      return NextResponse.json(
        {
          error:
            "PDF renderer is unavailable in this environment. Configure PUPPETEER_EXECUTABLE_PATH (or CHROME_PATH).",
        },
        { status: 501 }
      );
    }

    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1280, height: 720 },
      executablePath,
      headless: true,
    });

    try {
      const page = await browser.newPage();
      await page.setContent(embedded.html, { waitUntil: "load" });
      await page.emulateMediaType("print");
      await waitForImagesAndFonts(page);

      // Extra tick for layout stability
      await new Promise((r) => setTimeout(r, 100));

      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        displayHeaderFooter: false,
        margin: {
          top: "12mm",
          right: "12mm",
          bottom: "12mm",
          left: "12mm",
        },
      });

      const pdfBuffer = Buffer.from(pdf);

      await page.close();

      return new NextResponse(pdfBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
            `${title}.pdf`
          )}`,
          "Cache-Control": "no-store",
          "X-Images-Total": String(embedded.total),
          "X-Images-Embedded": String(embedded.embedded),
        },
      });
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error("PDF export error:", error);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
