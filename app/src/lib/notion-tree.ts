import type { NotionPageInfo } from "@/app/api/notion/search/route";

export interface NotionPage extends NotionPageInfo {
  children: NotionPage[];
}

/**
 * Build a tree structure from flat page list
 */
export function buildPageTree(pages: NotionPageInfo[]): NotionPage[] {
  const pageMap = new Map<string, NotionPage>();
  const roots: NotionPage[] = [];

  // First pass: create all nodes
  for (const page of pages) {
    pageMap.set(page.id, { ...page, children: [] });
  }

  // Second pass: build tree
  for (const page of pages) {
    const node = pageMap.get(page.id)!;
    const parentId = page.parent.id;

    if (page.parent.type === "workspace" || !parentId) {
      roots.push(node);
    } else {
      const parent = pageMap.get(parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        // Parent not in our list (not shared), treat as root
        roots.push(node);
      }
    }
  }

  // Sort by title
  const sortNodes = (nodes: NotionPage[]) => {
    nodes.sort((a, b) => a.title.localeCompare(b.title));
    for (const node of nodes) {
      sortNodes(node.children);
    }
  };
  sortNodes(roots);

  return roots;
}

/**
 * Get the full path of a page in the tree
 */
export function getPagePath(
  pageId: string,
  pages: NotionPageInfo[]
): string[] {
  const pageMap = new Map<string, NotionPageInfo>();
  for (const page of pages) {
    pageMap.set(page.id, page);
  }

  const path: string[] = [];
  let current = pageMap.get(pageId);

  while (current) {
    path.unshift(sanitizePathSegment(current.title));
    const parentId = current.parent.id;
    if (!parentId || current.parent.type === "workspace") {
      break;
    }
    current = pageMap.get(parentId);
  }

  return path;
}

/**
 * Sanitize a path segment for filesystem use
 */
export function sanitizePathSegment(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .trim()
    .substring(0, 100) || "untitled";
}

/**
 * Flatten tree back to array with path info
 */
export function flattenTreeWithPaths(
  tree: NotionPage[],
  parentPath: string[] = []
): Array<{ page: NotionPage; path: string[] }> {
  const result: Array<{ page: NotionPage; path: string[] }> = [];

  for (const node of tree) {
    const currentPath = [...parentPath, sanitizePathSegment(node.title)];
    result.push({ page: node, path: currentPath });
    result.push(...flattenTreeWithPaths(node.children, currentPath));
  }

  return result;
}

/**
 * Get all descendant page IDs
 */
export function getDescendantIds(node: NotionPage): string[] {
  const ids: string[] = [];
  for (const child of node.children) {
    ids.push(child.id);
    ids.push(...getDescendantIds(child));
  }
  return ids;
}

/**
 * Find a page in the tree by ID
 */
export function findPageInTree(
  tree: NotionPage[],
  pageId: string
): NotionPage | null {
  for (const node of tree) {
    if (node.id === pageId) return node;
    const found = findPageInTree(node.children, pageId);
    if (found) return found;
  }
  return null;
}
