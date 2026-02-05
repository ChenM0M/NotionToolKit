"use client";

import { useState } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Copy, Download, FileJson, Check, Settings2, Archive, KeyRound, ExternalLink } from "lucide-react";
import JSZip from "jszip";
import { getNotionPageId } from "@/lib/notion-utils";

export function NotionConverter() {
    const [token, setToken] = useLocalStorage("notion_token", "");
    const [pageUrl, setPageUrl] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [markdown, setMarkdown] = useState("");
    const [pageTitle, setPageTitle] = useState("notion-export");
    const [activeTab, setActiveTab] = useState("convert");

    const handleConvert = async () => {
        if (!token) {
            toast.error("请先输入您的 Notion Integration Token。");
            setActiveTab("settings");
            return;
        }
        if (!pageUrl) {
            toast.error("请输入 Notion 页面 URL 或 ID。");
            return;
        }

        const extractedId = getNotionPageId(pageUrl);
        if (!extractedId) {
            toast.error("无效的 Notion 页面 URL 或 ID。请检查您的输入。");
            return;
        }

        setIsLoading(true);
        setMarkdown("");
        setPageTitle("notion-export");

        try {
            const response = await fetch("/api/notion/convert", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    token,
                    pageId: extractedId,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to convert page");
            }

            setMarkdown(data.markdown);
            if (data.title) {
                setPageTitle(data.title);
            }
            toast.success("转换成功！");
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "发生未知错误";
            if (errorMessage.includes("404")) {
                toast.error("页面未找到 (404)。您是否在页面的「Connections」中添加了您的 Integration？");
            } else if (errorMessage.includes("401")) {
                toast.error("未授权 (401)。请检查您的 Integration Token。");
            } else {
                toast.error(`错误：${errorMessage}`);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = () => {
        if (!markdown) return;
        navigator.clipboard.writeText(markdown);
        toast.success("Markdown 已复制到剪贴板！");
    };

    const downloadMarkdown = () => {
        if (!markdown) return;
        const blob = new Blob([markdown], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${pageTitle}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("下载已开始！");
    };

    const downloadZip = async () => {
        if (!markdown) return;

        const zip = new JSZip();
        const folderName = pageTitle;
        const imgFolder = zip.folder(`${folderName}/images`);

        let processedMarkdown = markdown;
        const imageRegex = /!\[(.*?)\]\((.*?)\)/g;
        const matches = Array.from(markdown.matchAll(imageRegex));

        // We need to fetch images
        if (matches.length > 0) {
            toast.info(`发现 ${matches.length} 张图片。开始下载...`);

            await Promise.all(matches.map(async (match, index) => {
                const [, , imageUrl] = match;
                try {
                    // Use our proxy to avoid CORS
                    const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
                    const response = await fetch(proxyUrl);
                    if (!response.ok) throw new Error("Failed to fetch image");

                    const blob = await response.blob();
                    // Guess extension
                    const type = blob.type;
                    const ext = type.split("/")[1] || "png";
                    const filename = `image-${index + 1}.${ext}`;

                    // Add to zip
                    imgFolder?.file(filename, blob);

                    // Replace in markdown
                    processedMarkdown = processedMarkdown.replace(imageUrl, `images/${filename}`);
                } catch (e) {
                    console.error("Failed to download image", imageUrl, e);
                    // Keep original link if failed
                }
            }));
        }

        zip.file(`${folderName}/export.md`, processedMarkdown);

        const content = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(content);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${pageTitle}-backup.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("备份下载成功！");
    };

    return (
        <div className="w-full max-w-4xl mx-auto space-y-8">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
                <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl">
                    Notion 万用工具箱
                </h1>
                <p className="text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed max-w-2xl">
                    您的 Notion 瑞士军刀。将页面转换为 Markdown、备份内容，以及更多功能。
                </p>
                {/* Token Status Indicator */}
                <div className="flex items-center gap-2 text-sm">
                    <KeyRound className="h-4 w-4" />
                    {token ? (
                        <span className="text-green-600 dark:text-green-400">Token 已配置</span>
                    ) : (
                        <span className="text-muted-foreground">Token 未配置</span>
                    )}
                </div>
            </div>

            <Tabs defaultValue="convert" value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-[400px] mx-auto mb-8">
                    <TabsTrigger value="convert">转换与导出</TabsTrigger>
                    <TabsTrigger value="settings">
                        设置
                        {!token && <span className="ml-1 h-2 w-2 rounded-full bg-orange-500 animate-pulse" />}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="convert">
                    <Card className="border-2 shadow-sm">
                        <CardHeader>
                            <CardTitle>页面转 Markdown</CardTitle>
                            <CardDescription>
                                输入 Notion 页面 URL，即可将其转换为标准 Markdown。
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="url">Notion 页面 URL / ID</Label>
                                <div className="flex space-x-2">
                                    <Input
                                        id="url"
                                        placeholder="https://www.notion.so/my-page-..."
                                        value={pageUrl}
                                        onChange={(e) => setPageUrl(e.target.value)}
                                        className="flex-1"
                                        onKeyDown={(e) => e.key === "Enter" && handleConvert()}
                                    />
                                    <Button onClick={handleConvert} disabled={isLoading}>
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                转换中...
                                            </>
                                        ) : (
                                            "转换"
                                        )}
                                    </Button>
                                </div>
                            </div>

                            {markdown && (
                                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <div className="flex items-center gap-2">
                                            <Label>预览</Label>
                                            {pageTitle !== "notion-export" && (
                                                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                                    {pageTitle}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex space-x-2">
                                            <Button variant="outline" size="sm" onClick={copyToClipboard}>
                                                <Copy className="mr-2 h-4 w-4" />
                                                复制
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={downloadMarkdown}>
                                                <Download className="mr-2 h-4 w-4" />
                                                .md
                                            </Button>
                                            <Button variant="default" size="sm" onClick={downloadZip}>
                                                <Archive className="mr-2 h-4 w-4" />
                                                备份 (Zip)
                                            </Button>
                                        </div>
                                    </div>
                                    <Textarea
                                        readOnly
                                        value={markdown}
                                        className="h-[400px] font-mono text-sm bg-muted/50 resize-none"
                                    />
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="settings">
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle>配置</CardTitle>
                            <CardDescription>
                                您的数据仅存储在浏览器本地 (LocalStorage)。我们不会上传您的 Token 到任何服务器。
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="token">Notion Integration Token（内部）</Label>
                                <Input
                                    id="token"
                                    type="password"
                                    placeholder="secret_..."
                                    value={token}
                                    onChange={(e) => setToken(e.target.value)}
                                />
                                <div className="text-xs text-muted-foreground space-y-1">
                                    <p>
                                        您可以在{" "}
                                        <a 
                                            href="https://www.notion.so/my-integrations" 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 underline hover:text-primary"
                                        >
                                            Notion Integrations
                                            <ExternalLink className="h-3 w-3" />
                                        </a>
                                        {" "}创建并获取 Token。
                                    </p>
                                    <p className="text-orange-600 dark:text-orange-400">
                                        请确保将该 Integration 添加到您想要导出的页面（页面右上角 ... → Add connections）！
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button variant="secondary" className="w-full" onClick={() => setActiveTab("convert")}>
                                <Check className="mr-2 h-4 w-4" />
                                保存并返回
                            </Button>
                        </CardFooter>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Help Section */}
            {!markdown && activeTab === "convert" && (
                <div className="grid gap-4 md:grid-cols-3 text-center">
                    <div className="p-4 rounded-lg bg-muted/30 border border-muted hover:bg-muted/50 transition-colors">
                        <Settings2 className="w-8 h-8 mx-auto mb-2 text-primary/80" />
                        <h3 className="font-semibold mb-1">1. 设置 Token</h3>
                        <p className="text-sm text-muted-foreground">在设置中添加您的 Integration Token。</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/30 border border-muted hover:bg-muted/50 transition-colors">
                        <FileJson className="w-8 h-8 mx-auto mb-2 text-primary/80" />
                        <h3 className="font-semibold mb-1">2. 连接页面</h3>
                        <p className="text-sm text-muted-foreground">在 Notion 页面菜单中选择「Add connections」。</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/30 border border-muted hover:bg-muted/50 transition-colors">
                        <Download className="w-8 h-8 mx-auto mb-2 text-primary/80" />
                        <h3 className="font-semibold mb-1">3. 转换</h3>
                        <p className="text-sm text-muted-foreground">在此处粘贴页面 URL 并导出。</p>
                    </div>
                </div>
            )}
        </div>
    );
}
