"use client";

import { cn } from "@/lib/utils";
import type { NotionPage } from "@/lib/notion-tree";
import { PageItem } from "./page-item";

interface PageTreeProps {
  pages: NotionPage[];
  level?: number;
  isSelected: (id: string) => boolean;
  isExpanded: (id: string) => boolean;
  onToggleSelect: (id: string, withChildren?: boolean) => void;
  onToggleExpand: (id: string) => void;
  onPreview?: (id: string) => void;
  selectionMode?: boolean;
  className?: string;
}

export function PageTree({
  pages,
  level = 0,
  isSelected,
  isExpanded,
  onToggleSelect,
  onToggleExpand,
  onPreview,
  selectionMode = false,
  className,
}: PageTreeProps) {
  if (pages.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {pages.map((page) => (
        <div key={page.id}>
          <PageItem
            page={page}
            level={level}
            isSelected={isSelected(page.id)}
            isExpanded={isExpanded(page.id)}
            hasChildren={page.children.length > 0}
            onToggleSelect={onToggleSelect}
            onToggleExpand={onToggleExpand}
            onPreview={onPreview}
            selectionMode={selectionMode}
          />
          {isExpanded(page.id) && page.children.length > 0 && (
            <PageTree
              pages={page.children}
              level={level + 1}
              isSelected={isSelected}
              isExpanded={isExpanded}
              onToggleSelect={onToggleSelect}
              onToggleExpand={onToggleExpand}
              onPreview={onPreview}
              selectionMode={selectionMode}
            />
          )}
        </div>
      ))}
    </div>
  );
}
