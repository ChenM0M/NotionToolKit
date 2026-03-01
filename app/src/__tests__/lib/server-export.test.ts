import { describe, it, expect } from "vitest";
import { renderMarkdownToHtmlBody } from "@/lib/server/export/markdown-renderer";

describe("server export markdown renderer", () => {
  it("renders images and strips React preload links", () => {
    const md = '![alt](https://example.com/image(1).png "t")';
    const html = renderMarkdownToHtmlBody(md, "web");
    expect(html).toContain('<img src="https://example.com/image(1).png"');
    expect(html).not.toContain('rel="preload"');
    expect(html).not.toContain("![alt]");
  });

  it("renders task list checkboxes as text for docx", () => {
    const md = "- [x] done\n- [ ] todo\n";
    const html = renderMarkdownToHtmlBody(md, "docx");
    expect(html).toContain("☑");
    expect(html).toContain("☐");
    expect(html).not.toContain("<input");
  });

  it("adds notion columns class for table with marker", () => {
    const md = [
      "| <span data-notion-columns></span> |  |",
      "| --- | --- |",
      "| ![a](https://example.com/a.png) | ![b](https://example.com/b.png) |",
    ].join("\n");
    const html = renderMarkdownToHtmlBody(md, "web");
    expect(html).toContain('class="notion-columns-table"');
  });
});
