/**
 * 多格式导出工具
 * 支持 Markdown、HTML、PDF、Word 格式导出
 */

export type ExportFormat = "markdown" | "html" | "pdf" | "docx";

/**
 * 将 Markdown 转换为 HTML
 * 支持 GFM 扩展语法（表格、任务列表等）
 */
export function markdownToHtml(markdown: string, title?: string): string {
  let html = markdown;

  // 处理代码块（需要在其他转换之前处理）
  const codeBlocks: string[] = [];
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const index = codeBlocks.length;
    codeBlocks.push(
      `<pre><code class="language-${lang || "plaintext"}">${escapeHtml(code.trim())}</code></pre>`
    );
    return `__CODE_BLOCK_${index}__`;
  });

  // 处理行内代码
  const inlineCodes: string[] = [];
  html = html.replace(/`([^`]+)`/g, (_, code) => {
    const index = inlineCodes.length;
    inlineCodes.push(`<code>${escapeHtml(code)}</code>`);
    return `__INLINE_CODE_${index}__`;
  });

  // 处理表格
  html = html.replace(
    /^\|(.+)\|\s*\n\|[-:\s|]+\|\s*\n((?:\|.+\|\s*\n?)+)/gm,
    (match, headerRow, bodyRows) => {
      const headers = headerRow
        .split("|")
        .map((h: string) => h.trim())
        .filter(Boolean);
      const rows = bodyRows
        .trim()
        .split("\n")
        .map((row: string) =>
          row
            .split("|")
            .map((cell: string) => cell.trim())
            .filter((cell: string, i: number, arr: string[]) => i > 0 || cell !== "" || arr.length === headers.length + 2)
            .slice(0, -1)
            .slice(1)
        );

      let table = '<table class="markdown-table">\n<thead>\n<tr>\n';
      headers.forEach((h: string) => {
        table += `<th>${processInlineMarkdown(h)}</th>\n`;
      });
      table += "</tr>\n</thead>\n<tbody>\n";

      rows.forEach((row: string[]) => {
        table += "<tr>\n";
        row.forEach((cell: string) => {
          table += `<td>${processInlineMarkdown(cell)}</td>\n`;
        });
        table += "</tr>\n";
      });

      table += "</tbody>\n</table>";
      return table;
    }
  );

  // 标题
  html = html.replace(/^######\s+(.+)$/gm, "<h6>$1</h6>");
  html = html.replace(/^#####\s+(.+)$/gm, "<h5>$1</h5>");
  html = html.replace(/^####\s+(.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^##\s+(.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^#\s+(.+)$/gm, "<h1>$1</h1>");

  // 任务列表
  html = html.replace(
    /^[-*]\s+\[x\]\s+(.+)$/gim,
    '<li class="task-item"><input type="checkbox" checked disabled> $1</li>'
  );
  html = html.replace(
    /^[-*]\s+\[\s?\]\s+(.+)$/gim,
    '<li class="task-item"><input type="checkbox" disabled> $1</li>'
  );

  // 粗体和斜体
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/___(.+?)___/g, "<strong><em>$1</em></strong>");
  html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");
  html = html.replace(/_(.+?)_/g, "<em>$1</em>");

  // 删除线
  html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");

  // 图片 (必须在链接之前处理，否则 ![alt](url) 中的 [alt](url) 会被当作链接)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');

  // 链接
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // 水平线
  html = html.replace(/^---+$/gm, "<hr />");
  html = html.replace(/^\*\*\*+$/gm, "<hr />");

  // 引用块
  html = html.replace(/^>\s+(.+)$/gm, "<blockquote>$1</blockquote>");
  // 合并连续的引用块
  html = html.replace(/<\/blockquote>\s*<blockquote>/g, "<br>");

  // 无序列表（非任务列表）
  html = html.replace(/^[-*+]\s+(?!\[[ x]\])(.+)$/gm, "<li>$1</li>");

  // 有序列表
  html = html.replace(/^\d+\.\s+(.+)$/gm, "<li>$1</li>");

  // 包装列表项
  html = html.replace(/(<li>[\s\S]*?<\/li>)(\s*)(?=<li>|$)/g, "$1$2");
  html = html.replace(
    /(<li(?:\s+class="task-item")?>[\s\S]*?<\/li>)+/g,
    "<ul>$&</ul>"
  );

  // 段落（空行分隔）
  html = html.replace(/\n\n+/g, "</p><p>");

  // 换行
  html = html.replace(/\n/g, "<br />");

  // 包装段落
  html = `<p>${html}</p>`;

  // 清理空段落
  html = html.replace(/<p>\s*<\/p>/g, "");
  html = html.replace(/<p>\s*<br \/>\s*<\/p>/g, "");
  html = html.replace(/<p>(<h[1-6]>)/g, "$1");
  html = html.replace(/(<\/h[1-6]>)<\/p>/g, "$1");
  html = html.replace(/<p>(<ul>)/g, "$1");
  html = html.replace(/(<\/ul>)<\/p>/g, "$1");
  html = html.replace(/<p>(<table)/g, "$1");
  html = html.replace(/(<\/table>)<\/p>/g, "$1");
  html = html.replace(/<p>(<blockquote>)/g, "$1");
  html = html.replace(/(<\/blockquote>)<\/p>/g, "$1");
  html = html.replace(/<p>(<hr \/>)/g, "$1");
  html = html.replace(/(<hr \/>)<\/p>/g, "$1");
  html = html.replace(/<p>(<pre>)/g, "$1");
  html = html.replace(/(<\/pre>)<\/p>/g, "$1");

  // 恢复代码块
  codeBlocks.forEach((block, index) => {
    html = html.replace(`__CODE_BLOCK_${index}__`, block);
  });

  // 恢复行内代码
  inlineCodes.forEach((code, index) => {
    html = html.replace(`__INLINE_CODE_${index}__`, code);
  });

  // 生成完整的 HTML 文档
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title || "Notion Export")}</title>
  <style>
    :root {
      --text-color: #37352f;
      --bg-color: #ffffff;
      --code-bg: #f7f6f3;
      --border-color: rgba(55, 53, 47, 0.16);
      --link-color: #2383e2;
      --table-header-bg: #f7f6f3;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --text-color: rgba(255, 255, 255, 0.9);
        --bg-color: #191919;
        --code-bg: #2f2f2f;
        --border-color: rgba(255, 255, 255, 0.13);
        --link-color: #529cca;
        --table-header-bg: #2f2f2f;
      }
    }

    * {
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: var(--text-color);
      background-color: var(--bg-color);
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem;
    }

    h1, h2, h3, h4, h5, h6 {
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-weight: 600;
      line-height: 1.3;
    }

    h1 { font-size: 2em; }
    h2 { font-size: 1.5em; }
    h3 { font-size: 1.25em; }

    p {
      margin: 1em 0;
    }

    a {
      color: var(--link-color);
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    img {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
    }

    code {
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 0.875em;
      background-color: var(--code-bg);
      padding: 0.2em 0.4em;
      border-radius: 3px;
    }

    pre {
      background-color: var(--code-bg);
      padding: 1em;
      border-radius: 4px;
      overflow-x: auto;
    }

    pre code {
      background: none;
      padding: 0;
    }

    blockquote {
      margin: 1em 0;
      padding-left: 1em;
      border-left: 3px solid var(--border-color);
      color: var(--text-color);
      opacity: 0.8;
    }

    ul, ol {
      margin: 1em 0;
      padding-left: 2em;
    }

    li {
      margin: 0.25em 0;
    }

    li.task-item {
      list-style: none;
      margin-left: -1.5em;
    }

    li.task-item input[type="checkbox"] {
      margin-right: 0.5em;
    }

    hr {
      border: none;
      border-top: 1px solid var(--border-color);
      margin: 2em 0;
    }

    table.markdown-table {
      border-collapse: collapse;
      width: 100%;
      margin: 1em 0;
    }

    table.markdown-table th,
    table.markdown-table td {
      border: 1px solid var(--border-color);
      padding: 0.5em 1em;
      text-align: left;
    }

    table.markdown-table th {
      background-color: var(--table-header-bg);
      font-weight: 600;
    }

    table.markdown-table tr:nth-child(even) {
      background-color: var(--code-bg);
    }

    del {
      text-decoration: line-through;
      opacity: 0.7;
    }

    @media print {
      body {
        max-width: none;
        padding: 1cm;
      }

      a {
        color: var(--text-color);
      }

      pre, code {
        white-space: pre-wrap;
        word-wrap: break-word;
      }
    }
  </style>
</head>
<body>
  ${html}
</body>
</html>`;
}

/**
 * 转义 HTML 特殊字符
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * 处理行内 Markdown（用于表格单元格等）
 */
function processInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank">$1</a>'
    );
}

/**
 * 触发浏览器打印功能（用于 PDF 导出）
 */
export function printToPdf(html: string): void {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    throw new Error("无法打开打印窗口，请检查浏览器弹窗设置");
  }

  printWindow.document.write(html);
  printWindow.document.close();

  // 等待内容加载完成后触发打印
  printWindow.onload = () => {
    printWindow.print();
  };
}

/**
 * 下载 HTML 文件
 */
export function downloadHtml(html: string, filename: string): void {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".html") ? filename : `${filename}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 获取导出格式的文件扩展名
 */
export function getExportExtension(format: ExportFormat): string {
  switch (format) {
    case "markdown":
      return ".md";
    case "html":
      return ".html";
    case "pdf":
      return ".pdf";
    case "docx":
      return ".docx";
    default:
      return ".md";
  }
}

/**
 * 获取导出格式的 MIME 类型
 */
export function getExportMimeType(format: ExportFormat): string {
  switch (format) {
    case "markdown":
      return "text/markdown";
    case "html":
      return "text/html";
    case "pdf":
      return "application/pdf";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    default:
      return "text/plain";
  }
}

/**
 * 导出格式选项
 */
export const EXPORT_FORMAT_OPTIONS: Array<{
  value: ExportFormat;
  label: string;
  description: string;
}> = [
  {
    value: "markdown",
    label: "Markdown",
    description: "原始 Markdown 格式，适合编辑和版本控制",
  },
  {
    value: "html",
    label: "HTML",
    description: "网页格式，可直接在浏览器中查看",
  },
  {
    value: "docx",
    label: "Word",
    description: "Microsoft Word 文档格式",
  },
  {
    value: "pdf",
    label: "PDF",
    description: "使用浏览器打印功能生成 PDF",
  },
];
