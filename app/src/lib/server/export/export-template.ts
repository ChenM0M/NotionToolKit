function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export const EXPORT_DOCUMENT_CSS = `
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
    margin: 1em 0;
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
    margin: 1em 0;
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

  hr {
    border: none;
    border-top: 1px solid var(--border-color);
    margin: 2em 0;
  }

  table {
    border-collapse: collapse;
    width: 100%;
    margin: 1em 0;
  }

  th,
  td {
    border: 1px solid var(--border-color);
    padding: 0.5em 1em;
    text-align: left;
  }

  th {
    background-color: var(--table-header-bg);
    font-weight: 600;
  }

  tr:nth-child(even) {
    background-color: var(--code-bg);
  }

  /* Notion-like image columns (generated from Notion column_list) */
  [data-notion-columns] {
    display: none !important;
  }

  table.notion-columns-table {
    width: 100%;
    table-layout: fixed;
    border-collapse: separate;
    border-spacing: 24px 0;
    margin: 1em 0;
  }

  table.notion-columns-table td {
    border: none;
    padding: 0;
    vertical-align: top;
  }

  table.notion-columns-table thead,
  table.notion-columns-table th {
    display: none;
  }

  table.notion-columns-table img {
    display: block;
    width: 100%;
    margin: 0 0 16px 0;
  }

  table.notion-columns-table img:last-child {
    margin-bottom: 0;
  }

  @media (max-width: 640px) {
    table.notion-columns-table,
    table.notion-columns-table tbody,
    table.notion-columns-table tr,
    table.notion-columns-table td {
      display: block;
      width: 100%;
    }

    table.notion-columns-table {
      border-spacing: 0;
    }

    table.notion-columns-table td + td {
      margin-top: 20px;
    }
  }

  del {
    text-decoration: line-through;
    opacity: 0.7;
  }

  /* Task list styles */
  input[type="checkbox"] {
    margin-right: 0.5em;
  }

  @media print {
    @page {
      /*
        Chrome/Edge "Headers and footers" are not controllable via JS.
        Setting @page margin to 0 removes the header/footer area.
        We then simulate margins using body padding.
      */
      margin: 0;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      max-width: none;
      margin: 0;
      padding: 12mm;
      background: #fff;
    }

    a {
      color: var(--text-color);
    }

    pre, code {
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    img,
    pre,
    table,
    blockquote {
      break-inside: avoid;
      page-break-inside: avoid;
    }
  }
`;

export function buildExportHtmlDocument(params: {
  title?: string;
  bodyHtml: string;
}): string {
  const title = escapeHtml(params.title || "Notion Export");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
${EXPORT_DOCUMENT_CSS}
  </style>
</head>
<body>
${params.bodyHtml}
</body>
</html>`;
}
