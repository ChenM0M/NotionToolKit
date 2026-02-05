"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Code, Eye, FileText, Loader2 } from "lucide-react";
import type { Components } from "react-markdown";

interface MarkdownPreviewProps {
  markdown: string;
  title?: string;
  className?: string;
  isLoading?: boolean;
}

type ViewMode = "source" | "preview" | "split";

/**
 * 计算文本统计信息
 */
function getTextStats(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return { chars: 0, charsNoSpace: 0, words: 0, lines: 0 };
  }

  const chars = trimmed.length;
  const charsNoSpace = trimmed.replace(/\s/g, "").length;
  const words = trimmed.split(/\s+/).filter(Boolean).length;
  const lines = trimmed.split("\n").length;

  return { chars, charsNoSpace, words, lines };
}

/**
 * 将 Notion 图片 URL 转换为代理 URL
 */
function proxyImageUrl(url: string): string {
  // 如果已经是代理 URL、缓存 URL 或本地 URL，直接返回
  if (
    url.startsWith("/api/proxy-image") ||
    url.startsWith("/api/image-cache") ||
    url.startsWith("data:") ||
    url.startsWith("blob:")
  ) {
    return url;
  }
  // 如果是相对路径（本地图片），直接返回
  if (url.startsWith("images/") || url.startsWith("./") || url.startsWith("../")) {
    return url;
  }
  // 对外部 URL 使用代理
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
}

/**
 * Mermaid 图表组件
 */
function MermaidDiagram({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function renderMermaid() {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "default",
          securityLevel: "loose",
        });

        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg: renderedSvg } = await mermaid.render(id, code);

        if (!cancelled) {
          setSvg(renderedSvg);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Mermaid 渲染失败");
          setSvg("");
        }
      }
    }

    renderMermaid();

    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
        <p className="text-sm text-red-600 dark:text-red-400">Mermaid 图表渲染错误: {error}</p>
        <pre className="mt-2 text-xs text-red-500 overflow-auto">{code}</pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="flex items-center justify-center p-4 bg-notion-hover rounded-md">
        <Loader2 className="h-5 w-5 animate-spin text-notion-text-gray" />
        <span className="ml-2 text-sm text-notion-text-gray">渲染图表中...</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="mermaid-container overflow-auto p-4 bg-white dark:bg-notion-code rounded-md"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/**
 * 自定义代码块组件
 */
function CodeBlock({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "";
  const code = String(children).replace(/\n$/, "");

  // Mermaid 图表
  if (language === "mermaid") {
    return <MermaidDiagram code={code} />;
  }

  // 普通代码块
  return (
    <code className={cn("block bg-notion-code p-4 rounded-md overflow-auto text-sm", className)} {...props}>
      {children}
    </code>
  );
}

/**
 * 自定义图片组件 - 使用代理解决 CORS
 */
function ProxiedImage({ src, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [error, setError] = useState(false);
  const srcString = typeof src === "string" ? src : "";
  const proxiedSrc = srcString ? proxyImageUrl(srcString) : "";

  // Don't render if no src
  if (!proxiedSrc) {
    return null;
  }

  if (error) {
    return (
      <div className="inline-flex items-center gap-2 p-2 bg-notion-hover rounded text-sm text-notion-text-gray">
        <span>图片加载失败</span>
        {srcString && (
          <a
            href={srcString}
            target="_blank"
            rel="noopener noreferrer"
            className="text-notion-primary hover:underline"
          >
            查看原图
          </a>
        )}
      </div>
    );
  }

  return (
    <img
      src={proxiedSrc}
      alt={alt || ""}
      onError={() => setError(true)}
      className="max-w-full h-auto rounded-md"
      {...props}
    />
  );
}

// 定义 react-markdown 组件类型
const markdownComponents: Components = {
  code: CodeBlock as Components["code"],
  img: ProxiedImage as Components["img"],
  table: ({ children }) => (
    <div className="overflow-auto my-4">
      <table className="min-w-full border-collapse border border-notion-border">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-notion-hover">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="border border-notion-border px-4 py-2 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-notion-border px-4 py-2">
      {children}
    </td>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-notion-primary hover:underline"
    >
      {children}
    </a>
  ),
};

export function MarkdownPreview({
  markdown,
  title,
  className,
  isLoading = false,
}: MarkdownPreviewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("preview");

  const stats = useMemo(() => getTextStats(markdown), [markdown]);

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-notion-primary" />
          <p className="text-sm text-notion-text-gray">加载预览中...</p>
        </div>
      </div>
    );
  }

  if (!markdown) {
    return (
      <div
        className={cn(
          "flex items-center justify-center h-full text-notion-text-gray",
          className
        )}
      >
        <div className="text-center">
          <p className="text-lg mb-2">选择页面以预览内容</p>
          <p className="text-sm">在左侧选择一个页面查看 Markdown 内容</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header with view mode toggle and stats */}
      <div className="flex items-center justify-between px-6 py-2 border-b border-notion-border bg-notion-sidebar/50">
        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-notion-hover rounded-md p-0.5">
          <button
            onClick={() => setViewMode("source")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium",
              "notion-transition-fast",
              viewMode === "source"
                ? "bg-notion-bg text-notion-text shadow-sm"
                : "text-notion-text-gray hover:text-notion-text"
            )}
          >
            <Code className="h-3.5 w-3.5" />
            源码
          </button>
          <button
            onClick={() => setViewMode("preview")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium",
              "notion-transition-fast",
              viewMode === "preview"
                ? "bg-notion-bg text-notion-text shadow-sm"
                : "text-notion-text-gray hover:text-notion-text"
            )}
          >
            <Eye className="h-3.5 w-3.5" />
            预览
          </button>
          <button
            onClick={() => setViewMode("split")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium",
              "notion-transition-fast",
              viewMode === "split"
                ? "bg-notion-bg text-notion-text shadow-sm"
                : "text-notion-text-gray hover:text-notion-text"
            )}
          >
            <FileText className="h-3.5 w-3.5" />
            对比
          </button>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-notion-text-gray">
          <span>{stats.chars} 字符</span>
          <span>{stats.words} 词</span>
          <span>{stats.lines} 行</span>
        </div>
      </div>

      {/* Title */}
      {title && (
        <div className="px-6 py-4 border-b border-notion-border">
          <h2 className="text-xl font-semibold text-notion-text">{title}</h2>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === "source" && (
          <div className="h-full overflow-auto p-6 notion-scrollbar">
            <pre className="whitespace-pre-wrap font-mono text-sm text-notion-text bg-notion-code p-4 rounded-lg overflow-auto">
              {markdown}
            </pre>
          </div>
        )}

        {viewMode === "preview" && (
          <div className="h-full overflow-auto p-6 notion-scrollbar">
            <div className="prose-notion max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={markdownComponents}
              >
                {markdown}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {viewMode === "split" && (
          <div className="flex h-full">
            {/* Source Panel */}
            <div className="flex-1 overflow-auto p-4 border-r border-notion-border notion-scrollbar">
              <div className="text-xs text-notion-text-gray mb-2 font-medium">
                Markdown 源码
              </div>
              <pre className="whitespace-pre-wrap font-mono text-sm text-notion-text bg-notion-code p-4 rounded-lg overflow-auto">
                {markdown}
              </pre>
            </div>

            {/* Preview Panel */}
            <div className="flex-1 overflow-auto p-4 notion-scrollbar">
              <div className="text-xs text-notion-text-gray mb-2 font-medium">
                渲染预览
              </div>
              <div className="prose-notion max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                  components={markdownComponents}
                >
                  {markdown}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Prose styles for rendered markdown */}
      <style jsx global>{`
        .prose-notion {
          color: var(--notion-text);
          line-height: 1.6;
        }

        .prose-notion h1,
        .prose-notion h2,
        .prose-notion h3,
        .prose-notion h4,
        .prose-notion h5,
        .prose-notion h6 {
          color: var(--notion-text);
          font-weight: 600;
          margin-top: 1.5em;
          margin-bottom: 0.5em;
        }

        .prose-notion h1 {
          font-size: 1.875rem;
        }

        .prose-notion h2 {
          font-size: 1.5rem;
        }

        .prose-notion h3 {
          font-size: 1.25rem;
        }

        .prose-notion p {
          margin: 1em 0;
        }

        .prose-notion a {
          color: var(--notion-primary);
          text-decoration: none;
        }

        .prose-notion a:hover {
          text-decoration: underline;
        }

        .prose-notion code {
          font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo,
            monospace;
          font-size: 0.875em;
          background-color: var(--notion-code);
          padding: 0.2em 0.4em;
          border-radius: 3px;
        }

        .prose-notion pre {
          background-color: var(--notion-code);
          padding: 1em;
          border-radius: 4px;
          overflow-x: auto;
          margin: 1em 0;
        }

        .prose-notion pre code {
          background: none;
          padding: 0;
        }

        .prose-notion blockquote {
          margin: 1em 0;
          padding-left: 1em;
          border-left: 3px solid var(--notion-border);
          color: var(--notion-text);
          opacity: 0.8;
        }

        .prose-notion ul,
        .prose-notion ol {
          margin: 1em 0;
          padding-left: 2em;
        }

        .prose-notion li {
          margin: 0.25em 0;
        }

        .prose-notion li > ul,
        .prose-notion li > ol {
          margin: 0.25em 0;
        }

        .prose-notion hr {
          border: none;
          border-top: 1px solid var(--notion-border);
          margin: 2em 0;
        }

        .prose-notion img {
          max-width: 100%;
          height: auto;
          border-radius: 4px;
          margin: 1em 0;
        }

        .prose-notion strong {
          font-weight: 600;
        }

        .prose-notion em {
          font-style: italic;
        }

        .prose-notion del {
          text-decoration: line-through;
        }

        /* Task list styles */
        .prose-notion input[type="checkbox"] {
          margin-right: 0.5em;
        }

        /* Mermaid container */
        .mermaid-container svg {
          max-width: 100%;
          height: auto;
        }
      `}</style>
    </div>
  );
}
