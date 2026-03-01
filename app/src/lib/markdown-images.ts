export function extractMarkdownImageUrls(markdown: string): string[] {
  const text = typeof markdown === "string" ? markdown : "";
  if (!text) return [];

  const urls: string[] = [];
  const len = text.length;

  let i = 0;
  while (i < len) {
    const start = text.indexOf("![", i);
    if (start === -1) break;

    // Find closing ']' for alt text
    let altEnd = start + 2;
    while (altEnd < len && text[altEnd] !== "]") {
      // Note: CommonMark alt parsing is more complex; this is good enough for Notion exports.
      altEnd++;
    }
    if (altEnd >= len || text[altEnd] !== "]") {
      i = start + 2;
      continue;
    }

    // Expect '(' after ']'
    if (text[altEnd + 1] !== "(") {
      i = altEnd + 1;
      continue;
    }

    // Parse until matching ')' (supports nested parentheses and escapes)
    let j = altEnd + 2; // after '('
    const innerStart = j;
    let depth = 1;

    while (j < len && depth > 0) {
      const ch = text[j];
      if (ch === "\\") {
        j += 2;
        continue;
      }
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      j++;
    }

    if (depth !== 0) {
      i = altEnd + 2;
      continue;
    }

    const inner = text.slice(innerStart, j - 1);
    const url = extractUrlFromLinkDestination(inner);
    if (url) urls.push(url);

    i = j;
  }

  return urls;
}

function extractUrlFromLinkDestination(inner: string): string | null {
  const trimmed = inner.trim();
  if (!trimmed) return null;

  // <url> "title"
  if (trimmed.startsWith("<")) {
    const end = trimmed.indexOf(">", 1);
    if (end > 1) {
      const url = trimmed.slice(1, end).trim();
      return url || null;
    }
  }

  // url "title" -> take first whitespace-delimited token
  const first = trimmed.split(/\s+/)[0];
  return first || null;
}
