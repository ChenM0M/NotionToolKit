"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NotionPage } from "@/lib/notion-tree";
import type { NotionPageInfo } from "@/app/api/notion/search/route";
import {
  createNestedZip,
  downloadBlob,
  getBackupFilename,
  type BackupProgress,
} from "@/lib/backup-utils";
import { Archive, Loader2, CheckCircle, AlertCircle, Image, FileText } from "lucide-react";

interface BackupPanelProps {
  selectedPages: NotionPage[];
  allPages: NotionPageInfo[];
  token: string;
  className?: string;
}

export function BackupPanel({
  selectedPages,
  allPages,
  token,
  className,
}: BackupPanelProps) {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [progress, setProgress] = useState<BackupProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleBackup = async () => {
    if (selectedPages.length === 0 || !token) return;

    setIsBackingUp(true);
    setProgress(null);
    setError(null);
    setSuccess(false);

    try {
      const blob = await createNestedZip(
        selectedPages,
        allPages,
        token,
        setProgress
      );
      downloadBlob(blob, getBackupFilename());
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "备份失败";
      setError(message);
    } finally {
      setIsBackingUp(false);
      setProgress(null);
    }
  };

  const getProgressText = () => {
    if (!progress) return "";
    switch (progress.phase) {
      case "converting":
        return `转换中 (${progress.current}/${progress.total})`;
      case "downloading-images":
        return progress.currentPage ? `处理: ${progress.currentPage}` : "下载图片中...";
      case "creating-zip":
        return "生成 ZIP 文件...";
      default:
        return "";
    }
  };

  const getPhaseLabel = () => {
    if (!progress) return "";
    switch (progress.phase) {
      case "converting":
        return "转换页面";
      case "downloading-images":
        return "下载图片";
      case "creating-zip":
        return "打包文件";
      default:
        return "";
    }
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between">
        <div className="text-sm text-notion-text">
          已选择{" "}
          <span className="font-medium text-notion-primary">
            {selectedPages.length}
          </span>{" "}
          个页面
        </div>
      </div>

      {/* Progress Bar */}
      {isBackingUp && progress && (
        <div className="space-y-2">
          {/* Overall Progress */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-notion-text-gray">
              <span>{getPhaseLabel()}</span>
              <span>{progress.overallProgress}%</span>
            </div>
            <div className="h-2 bg-notion-hover rounded-full overflow-hidden">
              <div
                className="h-full bg-notion-primary transition-all duration-300 ease-out rounded-full"
                style={{ width: `${progress.overallProgress}%` }}
              />
            </div>
          </div>

          {/* Current Task */}
          <div className="text-xs text-notion-text-gray truncate">
            {getProgressText()}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-notion-text-gray">
            {/* Page Stats */}
            {progress.pageStats && (
              <div className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                <span>
                  {progress.pageStats.converted}/{progress.pageStats.total} 页面
                </span>
                {progress.pageStats.failed > 0 && (
                  <span className="text-red-500">
                    ({progress.pageStats.failed} 失败)
                  </span>
                )}
              </div>
            )}

            {/* Image Stats */}
            {progress.imageStats && progress.imageStats.total > 0 && (
              <div className="flex items-center gap-1">
                <Image className="h-3 w-3" />
                <span>
                  {progress.imageStats.downloaded}/{progress.imageStats.total} 图片
                </span>
                {progress.imageStats.failed > 0 && (
                  <span className="text-red-500">
                    ({progress.imageStats.failed} 失败)
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <Button
        onClick={handleBackup}
        disabled={isBackingUp || selectedPages.length === 0}
        className="w-full bg-notion-primary hover:bg-notion-primary/90"
      >
        {isBackingUp ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            备份中...
          </>
        ) : success ? (
          <>
            <CheckCircle className="mr-2 h-4 w-4" />
            备份完成
          </>
        ) : (
          <>
            <Archive className="mr-2 h-4 w-4" />
            备份选中页面
          </>
        )}
      </Button>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-500">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      )}
    </div>
  );
}
