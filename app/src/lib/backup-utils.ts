import JSZip from "jszip";
import type { NotionPage } from "@/lib/notion-tree";
import type { ConvertedPage } from "@/app/api/notion/batch-convert/route";
import { getPagePath, sanitizePathSegment } from "@/lib/notion-tree";
import type { NotionPageInfo } from "@/app/api/notion/search/route";

export interface ImageStats {
  total: number;
  downloaded: number;
  failed: number;
}

export interface PageStats {
  total: number;
  converted: number;
  failed: number;
}

export interface BackupProgress {
  phase: "converting" | "downloading-images" | "creating-zip";
  current: number;
  total: number;
  currentPage?: string;
  overallProgress: number; // 0-100
  imageStats?: ImageStats;
  pageStats?: PageStats;
}

export type ProgressCallback = (progress: BackupProgress) => void;

/**
 * Fetch and process images from markdown, returning updated markdown and image blobs
 * 修复竞态问题：使用 Map 存储 URL 映射，下载完成后串行替换
 */
async function processImages(
  markdown: string,
  onImageProgress?: (current: number, total: number) => void
): Promise<{ markdown: string; images: Map<string, Blob>; stats: ImageStats }> {
  const images = new Map<string, Blob>();
  const imageRegex = /!\[(.*?)\]\((.*?)\)/g;
  const matches = Array.from(markdown.matchAll(imageRegex));

  const stats: ImageStats = {
    total: 0,
    downloaded: 0,
    failed: 0,
  };

  if (matches.length === 0) {
    return { markdown, images, stats };
  }

  // 收集所有唯一的图片 URL
  const uniqueUrls = new Map<string, string>(); // url -> filename
  let imageIndex = 0;

  for (const match of matches) {
    const imageUrl = match[2];
    if (!uniqueUrls.has(imageUrl)) {
      imageIndex++;
      uniqueUrls.set(imageUrl, `image-${imageIndex}`);
    }
  }

  stats.total = uniqueUrls.size;

  // URL 到本地路径的映射
  const urlToLocalPath = new Map<string, string>();
  let processed = 0;

  // 并发下载所有唯一图片，但只收集数据不修改 markdown
  await Promise.all(
    Array.from(uniqueUrls.entries()).map(async ([imageUrl, baseName]) => {
      try {
        const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error("Failed to fetch image");

        const blob = await response.blob();
        const type = blob.type;
        const ext = type.split("/")[1]?.split(";")[0] || "png";
        const filename = `${baseName}.${ext}`;

        images.set(filename, blob);
        urlToLocalPath.set(imageUrl, `images/${filename}`);
        stats.downloaded++;
      } catch (e) {
        console.error("Failed to download image", imageUrl, e);
        stats.failed++;
      } finally {
        processed++;
        onImageProgress?.(processed, uniqueUrls.size);
      }
    })
  );

  // 下载完成后，串行替换所有 URL（使用 replaceAll 替换所有出现）
  let processedMarkdown = markdown;
  for (const [originalUrl, localPath] of urlToLocalPath) {
    // 使用 replaceAll 确保替换所有出现的 URL
    processedMarkdown = processedMarkdown.replaceAll(originalUrl, localPath);
  }

  return { markdown: processedMarkdown, images, stats };
}

/**
 * Create a nested ZIP file from converted pages
 */
export async function createNestedZip(
  pages: NotionPage[],
  allPages: NotionPageInfo[],
  token: string,
  onProgress?: ProgressCallback
): Promise<Blob> {
  const zip = new JSZip();

  // Prepare pages with paths
  const pagesToConvert = pages.map((page) => ({
    id: page.id,
    title: page.title,
    path: getPagePath(page.id, allPages).join("/"),
  }));

  const totalPages = pagesToConvert.length;
  const pageStats: PageStats = {
    total: totalPages,
    converted: 0,
    failed: 0,
  };

  // Phase 1: Convert pages to markdown (权重 30%)
  onProgress?.({
    phase: "converting",
    current: 0,
    total: totalPages,
    overallProgress: 0,
    pageStats,
  });

  const response = await fetch("/api/notion/batch-convert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, pages: pagesToConvert }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to convert pages");
  }

  const { results } = (await response.json()) as { results: ConvertedPage[] };

  // 更新转换统计
  for (const result of results) {
    if (result.error) {
      pageStats.failed++;
    } else {
      pageStats.converted++;
    }
  }

  // Phase 2: Process images and create ZIP structure (权重 60%)
  const totalImageStats: ImageStats = {
    total: 0,
    downloaded: 0,
    failed: 0,
  };

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.error) {
      console.error(`Failed to convert ${result.title}:`, result.error);
      continue;
    }

    // 计算整体进度：转换阶段 30% + 图片阶段 60% * (当前页面进度)
    const baseProgress = 30;
    const imagePhaseWeight = 60;
    const pageProgress = (i / results.length) * imagePhaseWeight;

    onProgress?.({
      phase: "downloading-images",
      current: i + 1,
      total: results.length,
      currentPage: result.title,
      overallProgress: Math.round(baseProgress + pageProgress),
      imageStats: totalImageStats,
      pageStats,
    });

    const { markdown, images, stats } = await processImages(
      result.markdown,
      (current, total) => {
        // 更新图片统计
        totalImageStats.total = totalImageStats.downloaded + totalImageStats.failed + (total - current);

        const inPageProgress = current / total;
        const currentPageWeight = imagePhaseWeight / results.length;
        const progress = baseProgress + pageProgress + inPageProgress * currentPageWeight;

        onProgress?.({
          phase: "downloading-images",
          current: i + 1,
          total: results.length,
          currentPage: result.title,
          overallProgress: Math.round(progress),
          imageStats: {
            total: totalImageStats.total,
            downloaded: totalImageStats.downloaded + (stats?.downloaded || 0),
            failed: totalImageStats.failed + (stats?.failed || 0),
          },
          pageStats,
        });
      }
    );

    // 累加图片统计
    totalImageStats.total += stats.total;
    totalImageStats.downloaded += stats.downloaded;
    totalImageStats.failed += stats.failed;

    // Create folder structure
    const folderPath = result.path || sanitizePathSegment(result.title);
    const folder = zip.folder(folderPath);

    if (folder) {
      folder.file("export.md", markdown);

      if (images.size > 0) {
        const imgFolder = folder.folder("images");
        if (imgFolder) {
          for (const [filename, blob] of images) {
            imgFolder.file(filename, blob);
          }
        }
      }
    }
  }

  // Phase 3: Generate ZIP (权重 10%)
  onProgress?.({
    phase: "creating-zip",
    current: 0,
    total: 1,
    overallProgress: 90,
    imageStats: totalImageStats,
    pageStats,
  });

  const content = await zip.generateAsync({ type: "blob" });

  onProgress?.({
    phase: "creating-zip",
    current: 1,
    total: 1,
    overallProgress: 100,
    imageStats: totalImageStats,
    pageStats,
  });

  return content;
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generate a timestamp string for backup filenames
 */
export function getBackupFilename(prefix = "notion-backup"): string {
  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  return `${prefix}-${timestamp}.zip`;
}
