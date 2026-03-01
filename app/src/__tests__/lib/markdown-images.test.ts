import { describe, it, expect } from "vitest";
import { extractMarkdownImageUrls } from "@/lib/markdown-images";

describe("markdown-images", () => {
  it("extracts simple image urls", () => {
    const md = "![alt](https://example.com/a.png)";
    expect(extractMarkdownImageUrls(md)).toEqual(["https://example.com/a.png"]);
  });

  it("extracts urls with parentheses", () => {
    const md = "![alt](https://example.com/image(1).png)";
    expect(extractMarkdownImageUrls(md)).toEqual(["https://example.com/image(1).png"]);
  });

  it("extracts urls with nested parentheses", () => {
    const md = "![alt](https://example.com/foo(bar(baz)).png)";
    expect(extractMarkdownImageUrls(md)).toEqual(["https://example.com/foo(bar(baz)).png"]);
  });

  it("extracts urls wrapped in angle brackets", () => {
    const md = "![alt](<https://example.com/image(1).png>)";
    expect(extractMarkdownImageUrls(md)).toEqual(["https://example.com/image(1).png"]);
  });

  it("ignores titles and keeps only the destination", () => {
    const md = "![alt](https://example.com/a.png \"title\")";
    expect(extractMarkdownImageUrls(md)).toEqual(["https://example.com/a.png"]);
  });

  it("extracts multiple image urls in order", () => {
    const md = [
      "![a](https://example.com/a.png)",
      "text",
      "![b](https://example.com/b.png)",
    ].join("\n");
    expect(extractMarkdownImageUrls(md)).toEqual([
      "https://example.com/a.png",
      "https://example.com/b.png",
    ]);
  });
});
