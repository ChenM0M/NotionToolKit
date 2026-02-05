"use client";

import { cn } from "@/lib/utils";
import type { NotionPage } from "@/lib/notion-tree";
import { ChevronRight, FileText, Database } from "lucide-react";

interface PageItemProps {
  page: NotionPage;
  level: number;
  isSelected: boolean;
  isExpanded: boolean;
  hasChildren: boolean;
  onToggleSelect: (id: string, withChildren?: boolean) => void;
  onToggleExpand: (id: string) => void;
  onPreview?: (id: string) => void;
  selectionMode?: boolean;
}

export function PageItem({
  page,
  level,
  isSelected,
  isExpanded,
  hasChildren,
  onToggleSelect,
  onToggleExpand,
  onPreview,
  selectionMode = false,
}: PageItemProps) {
  const paddingLeft = 12 + level * 16;

  const handleCheckboxChange = (e: React.MouseEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onToggleSelect(page.id, e.shiftKey);
  };

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpand(page.id);
  };

  const handleRowClick = () => {
    if (page.isDatabase) return;

    if (selectionMode) {
      // 选择模式：切换选中状态
      onToggleSelect(page.id);
    } else {
      // 普通模式：预览页面
      onPreview?.(page.id);
    }
  };

  return (
    <div
      className={cn(
        "group flex items-center h-8 cursor-pointer select-none",
        "notion-transition-fast",
        "hover:bg-notion-hover",
        isSelected && "bg-notion-selected hover:bg-notion-selected"
      )}
      style={{ paddingLeft }}
      onClick={handleRowClick}
    >
      {/* Expand/Collapse button */}
      <button
        className={cn(
          "flex items-center justify-center w-5 h-5 rounded",
          "notion-transition-fast",
          "hover:bg-notion-hover-strong",
          !hasChildren && "invisible"
        )}
        onClick={handleExpandClick}
      >
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 text-notion-text-gray",
            "transition-transform duration-150 ease-out",
            isExpanded && "rotate-90"
          )}
        />
      </button>

      {/* Checkbox - only show in selection mode */}
      {selectionMode && !page.isDatabase && (
        <input
          type="checkbox"
          checked={isSelected}
          onClick={handleCheckboxChange}
          onChange={() => {}}
          className={cn(
            "mr-2 h-4 w-4 rounded border-notion-border cursor-pointer",
            "notion-checkbox accent-notion-primary"
          )}
        />
      )}

      {/* Icon */}
      <span className="mr-1.5 flex-shrink-0">
        {page.icon ? (
          page.icon.type === "emoji" ? (
            <span className="text-sm">{page.icon.value}</span>
          ) : (
            <img
              src={page.icon.value}
              alt=""
              className="h-4 w-4 rounded object-cover"
            />
          )
        ) : page.isDatabase ? (
          <Database className="h-4 w-4 text-notion-text-gray" />
        ) : (
          <FileText className="h-4 w-4 text-notion-text-gray" />
        )}
      </span>

      {/* Title */}
      <span
        className={cn(
          "truncate text-sm notion-transition-fast",
          page.isDatabase ? "text-notion-text-gray" : "text-notion-text"
        )}
        title={page.title}
      >
        {page.title}
      </span>

      {/* Database indicator */}
      {page.isDatabase && (
        <span className="ml-2 text-xs text-notion-text-gray opacity-60">
          (数据库)
        </span>
      )}
    </div>
  );
}
