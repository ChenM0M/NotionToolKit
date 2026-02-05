import { Client } from "@notionhq/client";
import { NextResponse } from "next/server";
import { HttpsProxyAgent } from "https-proxy-agent";
import { createNotionToMarkdown } from "@/lib/notion-markdown";

const PROXY_URL = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;

export const runtime = "nodejs";

// Notion API 推荐的并发限制
const CONCURRENCY_LIMIT = 3;
// 批次间延迟（毫秒）
const BATCH_DELAY = 350;

export interface ConvertedPage {
  pageId: string;
  title: string;
  markdown: string;
  path: string;
  error?: string;
}

/**
 * 带并发限制的批量处理函数
 * @param items 要处理的项目数组
 * @param processor 处理函数
 * @param concurrency 并发数限制
 * @param delayBetweenBatches 批次间延迟（毫秒）
 */
async function processWithConcurrencyLimit<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number = CONCURRENCY_LIMIT,
  delayBetweenBatches: number = BATCH_DELAY
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);

    // 如果还有更多批次，添加延迟以避免触发速率限制
    if (i + concurrency < items.length) {
      await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
    }
  }

  return results;
}

export async function POST(request: Request) {
  try {
    const { token, pages } = await request.json();

    if (!token || !pages || !Array.isArray(pages)) {
      return NextResponse.json(
        { error: "Missing token or pages array" },
        { status: 400 }
      );
    }

    const notion = new Client({
      auth: token,
      ...(PROXY_URL && { agent: new HttpsProxyAgent(PROXY_URL) }),
    });

    const n2m = createNotionToMarkdown(notion);

    // 使用并发限制处理页面转换
    const results = await processWithConcurrencyLimit<
      { id: string; title: string; path: string },
      ConvertedPage
    >(
      pages,
      async (page): Promise<ConvertedPage> => {
        try {
          const mdblocks = await n2m.pageToMarkdown(page.id);
          const mdString = n2m.toMarkdownString(mdblocks);

          return {
            pageId: page.id,
            title: page.title,
            markdown: mdString.parent ?? "",
            path: page.path,
          };
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          return {
            pageId: page.id,
            title: page.title,
            markdown: "",
            path: page.path,
            error: errorMessage,
          };
        }
      },
      CONCURRENCY_LIMIT,
      BATCH_DELAY
    );

    return NextResponse.json({ results });
  } catch (error: unknown) {
    console.error("Batch Convert API Error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to batch convert";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
