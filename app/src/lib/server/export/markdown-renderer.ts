import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeStringify from "rehype-stringify";
import { visit } from "unist-util-visit";

type RenderTarget = "web" | "docx";

function hasNotionColumnsMarker(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;

  // hast Element/Text
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyNode = node as any;

  if (anyNode.type === "element") {
    const props = (anyNode.properties || {}) as Record<string, unknown>;
    if (
      Object.prototype.hasOwnProperty.call(props, "data-notion-columns") ||
      Object.prototype.hasOwnProperty.call(props, "dataNotionColumns")
    ) {
      return true;
    }
  }

  const children = anyNode.children;
  if (Array.isArray(children)) {
    return children.some((c: unknown) => hasNotionColumnsMarker(c));
  }

  return false;
}

function rehypeNotionColumnsTables() {
  return (tree: unknown) => {
    visit(tree as never, "element", (node: any) => {
      if (node.tagName !== "table") return;
      if (!hasNotionColumnsMarker(node)) return;

      const props = (node.properties ||= {});
      const current = props.className;
      const classes: string[] =
        typeof current === "string"
          ? current.split(/\s+/).filter(Boolean)
          : Array.isArray(current)
            ? current.map(String)
            : [];

      if (!classes.includes("notion-columns-table")) {
        classes.push("notion-columns-table");
      }
      props.className = classes;
    });
  };
}

function rehypeExternalLinksTargetBlank() {
  return (tree: unknown) => {
    visit(tree as never, "element", (node: any) => {
      if (node.tagName !== "a") return;
      const href = node.properties?.href;
      if (typeof href !== "string") return;
      if (!/^https?:\/\//i.test(href)) return;

      node.properties ||= {};
      node.properties.target = "_blank";
      // Keep rel as a space-separated string for simplest stringify.
      node.properties.rel = "noopener noreferrer";
    });
  };
}

function rehypeDocxCheckboxesAsText() {
  return (tree: unknown) => {
    visit(tree as never, "element", (node: any, index: number | null, parent: any) => {
      if (node.tagName !== "input") return;
      const type = node.properties?.type;
      if (type !== "checkbox") return;
      if (!parent || !Array.isArray(parent.children) || typeof index !== "number") return;

      const checked = Boolean(node.properties?.checked);
      parent.children[index] = {
        type: "text",
        value: checked ? "☑ " : "☐ ",
      };
    });
  };
}

export function renderMarkdownToHtmlBody(markdown: string, target: RenderTarget): string {
  const md = typeof markdown === "string" ? markdown : "";

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeNotionColumnsTables);

  if (target === "web") {
    processor.use(rehypeExternalLinksTargetBlank);
  }

  if (target === "docx") {
    processor.use(rehypeDocxCheckboxesAsText);
  }

  processor.use(rehypeStringify, { allowDangerousHtml: true });

  return String(processor.processSync(md)).trim();
}
