"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useCallback, useEffect, useRef } from "react";

interface SidebarProps {
  children: React.ReactNode;
  className?: string;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
}

export function Sidebar({
  children,
  className,
  defaultWidth = 288,
  minWidth = 200,
  maxWidth = 480,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(defaultWidth);
  const [isResizing, setIsResizing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = e.clientX;
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setWidth(newWidth);
      }
    },
    [isResizing, minWidth, maxWidth]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  return (
    <aside
      ref={sidebarRef}
      className={cn(
        "relative flex flex-col border-r border-notion-border bg-notion-sidebar",
        "transition-[width] duration-200 ease-out",
        collapsed && "!w-0 overflow-hidden border-r-0",
        className
      )}
      style={{ width: collapsed ? 0 : width }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Content */}
      <div
        className={cn(
          "flex-1 overflow-hidden",
          "transition-opacity duration-200",
          collapsed && "opacity-0"
        )}
      >
        {children}
      </div>

      {/* Resize Handle */}
      {!collapsed && (
        <div
          className={cn(
            "notion-resize-handle",
            isResizing && "bg-notion-primary"
          )}
          onMouseDown={handleMouseDown}
        />
      )}

      {/* Collapse/Expand Button */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "absolute z-20 h-6 w-6 rounded-full border border-notion-border bg-notion-bg shadow-sm",
          "hover:bg-notion-hover notion-transition-fast",
          "opacity-0 transition-opacity duration-150",
          (isHovered || collapsed) && "opacity-100",
          collapsed ? "right-[-28px] top-4" : "-right-3 top-4"
        )}
        onClick={toggleCollapse}
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </Button>
    </aside>
  );
}
