"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useNotionPages, type SortBy } from "@/hooks/use-notion-pages";
import { MainLayout } from "@/components/layout/main-layout";
import { Sidebar } from "@/components/layout/sidebar";
import { PageTree } from "@/components/page-tree/page-tree";
import { BackupPanel } from "@/components/backup/backup-panel";
import { MarkdownPreview } from "@/components/preview/markdown-preview";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { markdownToHtml } from "@/lib/export-utils";
import {
  RefreshCw,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight,
  Settings,
  Loader2,
  KeyRound,
  ExternalLink,
  Eye,
  Copy,
  Download,
  X,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Clock,
  SortAsc,
  FileText,
  FileCode,
  Printer,
  ListChecks,
} from "lucide-react";

export default function Home() {
  const [token, setToken, isHydrated] = useLocalStorage("notion_token", "");
  const [showSettings, setShowSettings] = useState(false);
  const [previewMarkdown, setPreviewMarkdown] = useState("");
  const [previewTitle, setPreviewTitle] = useState("");
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [currentPreviewPageId, setCurrentPreviewPageId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);

  const {
    pages,
    filteredTree,
    isLoading,
    error,
    selectedIds,
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
    setSearchQuery,
    setSortBy,
    setSortOrder,
  } = useNotionPages({ token });

  // Auto-refresh when token changes and hydrated
  useEffect(() => {
    if (isHydrated && token && pages.length === 0) {
      refresh();
    }
  }, [token, isHydrated]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowSortMenu(false);
      setShowDownloadMenu(false);
    };
    if (showSortMenu || showDownloadMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showSortMenu, showDownloadMenu]);

  // 当选择模式下选择单个页面时自动加载预览
  useEffect(() => {
    if (selectionMode && selectedPages.length === 1) {
      const page = selectedPages[0];
      if (page.id !== currentPreviewPageId) {
        loadPreview(page.id, page.title);
      }
    } else if (selectionMode && selectedPages.length === 0) {
      setPreviewMarkdown("");
      setPreviewTitle("");
      setCurrentPreviewPageId(null);
    }
  }, [selectedPages, currentPreviewPageId, token, selectionMode]);

  // 直接预览页面（非选择模式）
  const handlePreviewPage = (pageId: string) => {
    const page = pages.find(p => p.id === pageId);
    if (page) {
      loadPreview(pageId, page.title);
    }
  };

  const loadPreview = async (pageId: string, pageTitle: string) => {
    if (!token) return;

    setIsPreviewLoading(true);
    setCurrentPreviewPageId(pageId);

    try {
      const response = await fetch("/api/notion/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, pageId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to convert page");
      }

      setPreviewMarkdown(data.markdown);
      setPreviewTitle(data.title || pageTitle);
    } catch (err) {
      const message = err instanceof Error ? err.message : "预览失败";
      toast.error(message);
      setPreviewMarkdown("");
      setPreviewTitle("");
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handlePreview = async () => {
    if (selectedPages.length !== 1) {
      toast.error("请选择单个页面进行预览");
      return;
    }

    const page = selectedPages[0];
    await loadPreview(page.id, page.title);
  };

  const copyToClipboard = () => {
    if (!previewMarkdown) return;
    navigator.clipboard.writeText(previewMarkdown);
    toast.success("已复制到剪贴板");
  };

  const downloadMarkdown = () => {
    if (!previewMarkdown) return;
    const blob = new Blob([previewMarkdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${previewTitle}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Markdown 下载已开始");
    setShowDownloadMenu(false);
  };

  const downloadHtml = async () => {
    if (!previewMarkdown) return;

    try {
      toast.info("正在准备 HTML...");

      const html = markdownToHtml(previewMarkdown, previewTitle);

      // Call API to embed cached images
      const response = await fetch("/api/export/html", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html }),
      });

      let finalHtml = html;
      if (response.ok) {
        const data = await response.json();
        finalHtml = data.html;
      }

      const blob = new Blob([finalHtml], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${previewTitle}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("HTML 下载已开始");
    } catch (err) {
      console.error("HTML download error:", err);
      toast.error("HTML 下载失败");
    }
    setShowDownloadMenu(false);
  };

  const downloadDocx = async () => {
    if (!previewMarkdown) return;

    try {
      toast.info("正在生成 Word 文档...");

      const html = markdownToHtml(previewMarkdown, previewTitle);
      const bodyMatch = html.match(/<body>([\s\S]*)<\/body>/);
      const bodyContent = bodyMatch ? bodyMatch[1] : previewMarkdown;

      const response = await fetch("/api/export/docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: bodyContent }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate DOCX");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${previewTitle}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Word 文档下载已开始");
    } catch (err) {
      console.error("DOCX generation error:", err);
      toast.error("Word 文档生成失败，请尝试下载 HTML 格式");
    }
    setShowDownloadMenu(false);
  };

  const printToPdf = async () => {
    if (!previewMarkdown) return;

    try {
      toast.info("正在准备打印...");

      const html = markdownToHtml(previewMarkdown, previewTitle);

      // Call API to embed cached images
      const response = await fetch("/api/export/html", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html }),
      });

      let finalHtml = html;
      if (response.ok) {
        const data = await response.json();
        finalHtml = data.html;
      }

      const printWindow = window.open("", "_blank");

      if (!printWindow) {
        toast.error("无法打开打印窗口，请检查浏览器弹窗设置");
        return;
      }

      printWindow.document.write(finalHtml);
      printWindow.document.close();

      printWindow.onload = () => {
        printWindow.print();
      };

      toast.info("已打开打印窗口，请选择「另存为 PDF」");
    } catch (err) {
      console.error("Print error:", err);
      toast.error("打印准备失败");
    }
    setShowDownloadMenu(false);
  };

  const handleSortChange = (newSortBy: SortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(newSortBy);
      setSortOrder("asc");
    }
    setShowSortMenu(false);
  };

  const getSortIcon = () => {
    if (sortOrder === "asc") {
      return <ArrowUp className="h-3 w-3" />;
    }
    return <ArrowDown className="h-3 w-3" />;
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-notion-border">
        <h1 className="text-sm font-semibold text-notion-text truncate">
          Notion 万用工具箱
        </h1>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="p-3 border-b border-notion-border bg-notion-hover/50">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-notion-text-gray">
              <KeyRound className="h-3 w-3" />
              <span>Integration Token</span>
            </div>
            <Input
              type="password"
              placeholder="secret_..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="h-8 text-sm"
            />
            <p className="text-xs text-notion-text-gray">
              在{" "}
              <a
                href="https://www.notion.so/my-integrations"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 underline hover:text-notion-primary"
              >
                Notion Integrations
                <ExternalLink className="h-2.5 w-2.5" />
              </a>{" "}
              创建 Token
            </p>
          </div>
        </div>
      )}

      {/* Search Bar */}
      {pages.length > 0 && (
        <div className="px-2 py-2 border-b border-notion-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-notion-text-gray" />
            <Input
              type="text"
              placeholder="搜索页面..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 pr-8 text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-notion-hover"
              >
                <X className="h-3.5 w-3.5 text-notion-text-gray" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-notion-border">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => refresh()}
          disabled={!isHydrated || isLoading || !token}
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          <span className="ml-1">刷新</span>
        </Button>
        <Button
          variant={selectionMode ? "default" : "ghost"}
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => {
            setSelectionMode(!selectionMode);
            if (selectionMode) {
              deselectAll();
            }
          }}
          disabled={!isHydrated || pages.length === 0}
        >
          <ListChecks className="h-3 w-3" />
          <span className="ml-1">选择</span>
        </Button>
        {selectionMode && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={selectedIds.size > 0 ? deselectAll : selectAll}
            disabled={!isHydrated || pages.length === 0}
          >
            {selectedIds.size > 0 ? (
              <Square className="h-3 w-3" />
            ) : (
              <CheckSquare className="h-3 w-3" />
            )}
            <span className="ml-1">{selectedIds.size > 0 ? "取消" : "全选"}</span>
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={expandAll}
          disabled={!isHydrated || pages.length === 0}
        >
          <ChevronDown className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={collapseAll}
          disabled={!isHydrated || pages.length === 0}
        >
          <ChevronRight className="h-3 w-3" />
        </Button>

        {/* Sort Button */}
        <div className="relative ml-auto">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              setShowSortMenu(!showSortMenu);
            }}
            disabled={!isHydrated || pages.length === 0}
          >
            <ArrowUpDown className="h-3 w-3" />
            <span className="ml-1">排序</span>
          </Button>

          {/* Sort Dropdown Menu */}
          {showSortMenu && (
            <div
              className="absolute right-0 top-full mt-1 w-36 bg-notion-bg border border-notion-border rounded-md shadow-lg z-50 notion-dropdown"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="flex items-center justify-between w-full px-3 py-2 text-xs text-notion-text hover:bg-notion-hover transition-colors"
                onClick={() => handleSortChange("title")}
              >
                <span className="flex items-center gap-2">
                  <SortAsc className="h-3 w-3" />
                  按标题
                </span>
                {sortBy === "title" && getSortIcon()}
              </button>
              <button
                className="flex items-center justify-between w-full px-3 py-2 text-xs text-notion-text hover:bg-notion-hover transition-colors"
                onClick={() => handleSortChange("lastEdited")}
              >
                <span className="flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  按编辑时间
                </span>
                {sortBy === "lastEdited" && getSortIcon()}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Page Tree */}
      <div className="flex-1 overflow-auto notion-scrollbar">
        {!isHydrated ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-notion-text-gray" />
          </div>
        ) : !token ? (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <KeyRound className="h-8 w-8 text-notion-text-gray mb-2" />
            <p className="text-sm text-notion-text-gray">
              请先配置 Token
            </p>
            <Button
              variant="link"
              size="sm"
              className="mt-1"
              onClick={() => setShowSettings(true)}
            >
              打开设置
            </Button>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <p className="text-sm text-red-500 mb-2">{error}</p>
            <Button variant="outline" size="sm" onClick={() => refresh()}>
              重试
            </Button>
          </div>
        ) : pages.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <p className="text-sm text-notion-text-gray mb-2">
              点击刷新加载页面
            </p>
            <Button variant="outline" size="sm" onClick={() => refresh()}>
              <RefreshCw className="h-3 w-3 mr-1" />
              刷新
            </Button>
          </div>
        ) : filteredTree.length === 0 && searchQuery ? (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <Search className="h-8 w-8 text-notion-text-gray mb-2" />
            <p className="text-sm text-notion-text-gray">
              未找到匹配 "{searchQuery}" 的页面
            </p>
            <Button
              variant="link"
              size="sm"
              className="mt-1"
              onClick={() => setSearchQuery("")}
            >
              清除搜索
            </Button>
          </div>
        ) : (
          <PageTree
            pages={filteredTree}
            isSelected={isSelected}
            isExpanded={isExpanded}
            onToggleSelect={toggleSelect}
            onToggleExpand={toggleExpand}
            onPreview={handlePreviewPage}
            selectionMode={selectionMode}
            className="py-1"
          />
        )}
      </div>

      {/* Backup Panel */}
      {selectedPages.length > 0 && (
        <div className="p-3 border-t border-notion-border">
          <BackupPanel
            selectedPages={selectedPages}
            allPages={pages}
            token={token}
          />
        </div>
      )}
    </div>
  );

  const mainContent = (
    <div className="flex flex-col h-full">
      {/* Main Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-notion-border">
        <div>
          <h2 className="text-lg font-semibold text-notion-text">
            {previewTitle || "Markdown 预览"}
          </h2>
          {selectedPages.length === 0 && (
            <p className="text-sm text-notion-text-gray">
              选择一个页面查看内容
            </p>
          )}
          {selectedPages.length > 1 && (
            <p className="text-sm text-notion-text-gray">
              已选择 {selectedPages.length} 个页面，选择单个页面查看预览
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedPages.length === 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreview}
              disabled={isPreviewLoading}
            >
              {isPreviewLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Eye className="h-4 w-4 mr-1" />
              )}
              预览
            </Button>
          )}
          {previewMarkdown && (
            <>
              <Button variant="outline" size="sm" onClick={copyToClipboard}>
                <Copy className="h-4 w-4 mr-1" />
                复制
              </Button>

              {/* Download Dropdown */}
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDownloadMenu(!showDownloadMenu);
                  }}
                >
                  <Download className="h-4 w-4 mr-1" />
                  下载
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>

                {showDownloadMenu && (
                  <div
                    className="absolute right-0 top-full mt-1 w-48 bg-notion-bg border border-notion-border rounded-md shadow-lg z-50 notion-dropdown"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-notion-text hover:bg-notion-hover transition-colors"
                      onClick={downloadMarkdown}
                    >
                      <FileCode className="h-4 w-4" />
                      Markdown (.md)
                    </button>
                    <button
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-notion-text hover:bg-notion-hover transition-colors"
                      onClick={downloadHtml}
                    >
                      <FileText className="h-4 w-4" />
                      HTML (.html)
                    </button>
                    <button
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-notion-text hover:bg-notion-hover transition-colors"
                      onClick={downloadDocx}
                    >
                      <FileText className="h-4 w-4" />
                      Word (.docx)
                    </button>
                    <div className="border-t border-notion-border my-1" />
                    <button
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-notion-text hover:bg-notion-hover transition-colors"
                      onClick={printToPdf}
                    >
                      <Printer className="h-4 w-4" />
                      打印 / 导出 PDF
                    </button>
                  </div>
                )}
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setPreviewMarkdown("");
                  setPreviewTitle("");
                  setCurrentPreviewPageId(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Preview Content */}
      <div className="flex-1 overflow-auto">
        <MarkdownPreview
          markdown={previewMarkdown}
          isLoading={isPreviewLoading}
        />
      </div>
    </div>
  );

  const footerContent = (
    <div className="flex items-center justify-between text-xs text-notion-text-gray">
      <span>
        {pages.length > 0
          ? `${pages.length} 个页面 · ${selectedPages.length} 个已选择${searchQuery ? ` · 搜索: "${searchQuery}"` : ""}`
          : "使用 Next.js、Notion API 构建"}
      </span>
      <span>数据仅存储在浏览器本地</span>
    </div>
  );

  return (
    <MainLayout
      sidebar={<Sidebar>{sidebarContent}</Sidebar>}
      footer={footerContent}
    >
      {mainContent}
    </MainLayout>
  );
}
