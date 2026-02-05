"use client";

import { useState, useCallback, useMemo } from "react";
import type { NotionPageInfo } from "@/app/api/notion/search/route";
import {
  buildPageTree,
  getDescendantIds,
  findPageInTree,
  type NotionPage,
} from "@/lib/notion-tree";

export type SortBy = "title" | "lastEdited";
export type SortOrder = "asc" | "desc";

interface UseNotionPagesOptions {
  token: string;
}

interface UseNotionPagesReturn {
  pages: NotionPageInfo[];
  tree: NotionPage[];
  filteredTree: NotionPage[];
  isLoading: boolean;
  error: string | null;
  selectedIds: Set<string>;
  expandedIds: Set<string>;
  searchQuery: string;
  sortBy: SortBy;
  sortOrder: SortOrder;
  refresh: () => Promise<void>;
  toggleSelect: (pageId: string, withChildren?: boolean) => void;
  toggleExpand: (pageId: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  expandAll: () => void;
  collapseAll: () => void;
  isSelected: (pageId: string) => boolean;
  isExpanded: (pageId: string) => boolean;
  selectedPages: NotionPage[];
  setSearchQuery: (query: string) => void;
  setSortBy: (sortBy: SortBy) => void;
  setSortOrder: (order: SortOrder) => void;
}

/**
 * 递归过滤树形结构
 * 如果节点匹配或其任何子节点匹配，则保留该节点
 */
function filterTree(nodes: NotionPage[], query: string): NotionPage[] {
  if (!query.trim()) return nodes;

  const lowerQuery = query.toLowerCase();

  return nodes
    .map((node) => {
      const filteredChildren = filterTree(node.children, query);
      const titleMatches = node.title.toLowerCase().includes(lowerQuery);

      // 如果标题匹配或有匹配的子节点，保留此节点
      if (titleMatches || filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren,
        };
      }
      return null;
    })
    .filter((node): node is NotionPage => node !== null);
}

/**
 * 递归排序树形结构
 */
function sortTree(
  nodes: NotionPage[],
  sortBy: SortBy,
  sortOrder: SortOrder
): NotionPage[] {
  const sorted = [...nodes].sort((a, b) => {
    let comparison = 0;
    if (sortBy === "title") {
      comparison = a.title.localeCompare(b.title, "zh-CN");
    } else if (sortBy === "lastEdited") {
      comparison =
        new Date(a.lastEdited).getTime() -
        new Date(b.lastEdited).getTime();
    }
    return sortOrder === "asc" ? comparison : -comparison;
  });

  return sorted.map((node) => ({
    ...node,
    children: sortTree(node.children, sortBy, sortOrder),
  }));
}

/**
 * 获取过滤后树中所有节点的 ID（用于自动展开搜索结果）
 */
function getAllNodeIds(nodes: NotionPage[]): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    ids.push(node.id);
    ids.push(...getAllNodeIds(node.children));
  }
  return ids;
}

export function useNotionPages({
  token,
}: UseNotionPagesOptions): UseNotionPagesReturn {
  const [pages, setPages] = useState<NotionPageInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("title");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const tree = useMemo(() => buildPageTree(pages), [pages]);

  // 应用搜索过滤和排序
  const filteredTree = useMemo(() => {
    let result = tree;

    // 先过滤
    if (searchQuery.trim()) {
      result = filterTree(result, searchQuery);
    }

    // 再排序
    result = sortTree(result, sortBy, sortOrder);

    return result;
  }, [tree, searchQuery, sortBy, sortOrder]);

  // 当搜索时自动展开所有匹配的节点
  const handleSetSearchQuery = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (query.trim()) {
        // 搜索时展开所有过滤后的节点
        const filtered = filterTree(tree, query);
        const allIds = getAllNodeIds(filtered);
        setExpandedIds(new Set(allIds));
      }
    },
    [tree]
  );

  const refresh = useCallback(async () => {
    if (!token) {
      setError("请先配置 Notion Token");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/notion/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch pages");
      }

      setPages(data.pages);
      setSelectedIds(new Set());
      setSearchQuery("");
      // Auto-expand root nodes
      const rootIds = new Set<string>(
        data.pages
          .filter(
            (p: NotionPageInfo) =>
              p.parent.type === "workspace" || !p.parent.id
          )
          .map((p: NotionPageInfo) => p.id)
      );
      setExpandedIds(rootIds);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const toggleSelect = useCallback(
    (pageId: string, withChildren = false) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        const isCurrentlySelected = next.has(pageId);

        if (isCurrentlySelected) {
          next.delete(pageId);
          if (withChildren) {
            const node = findPageInTree(tree, pageId);
            if (node) {
              for (const id of getDescendantIds(node)) {
                next.delete(id);
              }
            }
          }
        } else {
          next.add(pageId);
          if (withChildren) {
            const node = findPageInTree(tree, pageId);
            if (node) {
              for (const id of getDescendantIds(node)) {
                next.add(id);
              }
            }
          }
        }

        return next;
      });
    },
    [tree]
  );

  const toggleExpand = useCallback((pageId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) {
        next.delete(pageId);
      } else {
        next.add(pageId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(pages.filter((p) => !p.isDatabase).map((p) => p.id)));
  }, [pages]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const expandAll = useCallback(() => {
    setExpandedIds(new Set(pages.map((p) => p.id)));
  }, [pages]);

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  const isSelected = useCallback(
    (pageId: string) => selectedIds.has(pageId),
    [selectedIds]
  );

  const isExpanded = useCallback(
    (pageId: string) => expandedIds.has(pageId),
    [expandedIds]
  );

  const selectedPages = useMemo(() => {
    const result: NotionPage[] = [];
    const findSelected = (nodes: NotionPage[]) => {
      for (const node of nodes) {
        if (selectedIds.has(node.id) && !node.isDatabase) {
          result.push(node);
        }
        findSelected(node.children);
      }
    };
    findSelected(tree);
    return result;
  }, [tree, selectedIds]);

  return {
    pages,
    tree,
    filteredTree,
    isLoading,
    error,
    selectedIds,
    expandedIds,
    searchQuery,
    sortBy,
    sortOrder,
    refresh,
    toggleSelect,
    toggleExpand,
    selectAll,
    deselectAll,
    expandAll,
    collapseAll,
    isSelected,
    isExpanded,
    selectedPages,
    setSearchQuery: handleSetSearchQuery,
    setSortBy,
    setSortOrder,
  };
}
