# 产品需求文档 (PRD)：Notion 万用工具箱

## 1. 产品概述 (Product Overview)
**项目名称**：Notion Toolbox (Notion 万用工具箱)
**定位**：一个轻量级、便携的 Notion 辅助工具集。
**核心价值**：提供官方导出功能之外的轻量级替代方案，专注于“单页面的快速流转”——即快速备份、快速转 Markdown、快速复制到其他平台（如微信公众号、博客等）。
**设计理念**：
- **类似于 Notion**: UI 风格与交互体验深度复刻 Notion，让用户无缝上手。
- **纯前端体验**: 基于 Vercel/Cloudflare Pages 部署，无需独立后端服务器 (Serverless)。
- **数据隐私**: 所有 Token 存储在用户本地 (LocalStorage)，不上传至任何第三方服务器（仅经过 Serverless Proxy 进行 API 转发）。

## 2. 用户功能需求 (User Functional Requirements)

### 2.1 核心功能模块

#### F1. 授权与连接
- **功能描述**：允许用户连接自己的 Notion 工作区。
- **交互方式**：
    - 提供输入框让用户粘贴 **Integration Internal Token** (推荐 MVP 方案，最轻量)。
    - Token 支持“记住我”选项（加密存储在 LocalStorage）。
    - *Future*: 支持 OAuth 一键登录。

#### F2. 页面抓取与解析 (Page Parser)
- **功能描述**：通过 Notion API 获取指定 Page 的内容。
- **输入**：Notion Page URL 或 Page ID。
- **逻辑**：
    - 自动提取 URL 中的 Page ID。
    - 调用 Notion API (`retrieve block children`) 递归获取所有 Block。
    - 处理 Notion 特有 Block (Callout, Toggle, Database 等) 为通用 Markdown。

#### F3. 在线 Markdown 预览与复制
- **功能描述**：解析完成后，在右侧/下方实时展示 Markdown 源码预览。
- **操作**：
    - **一键复制 (Copy)**: 将 Markdown 内容复制到剪贴板。
    - **下载 Markdown (Download .md)**: 将内容保存为 `.md` 文件。

#### F4. 完整备份 (Full Backup / Zip Export)
- **功能描述**：将 Markdown 文本与页面内的图片/附件一并打包下载。
- **逻辑**：
    - 解析文档中的 Image Block。
    - 下载图片资源（需处理 Notion S3 链接过期问题，需实时下载）。
    - 生成 Zip 包，结构如下：
        ```text
        /PageTitle/
          - export.md
          - /images/
            - image1.png
            - image2.jpg
        ```
    - 修改 Markdown 中的图片引用路径为本地相对路径。

### 2.2 UI/UX 需求
- **风格**: 极致的 **Notion-like Style**。
    - 字体: Inter / sans-serif。
    - 配色: 纯白/纯黑背景，Notion 标志性的浅灰色边框和 hover 效果。
    - 组件: 使用类 Notion 的按钮、下拉菜单、Toast 通知。
- **响应式**: 支持移动端浏览器访问，方便手机端快速复制备份。

## 3. 技术架构方案 (Technical Architecture)

### 3.1 技术栈
- **Web 框架**: **Next.js 14+ (App Router)**
    - 理由: 完美支持 Vercel 部署，API Routes 解决 CORS 问题，React 生态丰富。
- **样式库**: **Tailwind CSS** + **Shadcn/UI** (定制为 Notion 风格)。
- **Notion SDK**: `@notionhq/client`。
- **Markdown 转换**: `notion-to-md` (或其他成熟开源库，如 `react-notion-x` 的解析逻辑)。
- **打包压缩**: `jszip` (前端/Serverless 端打包)。

### 3.2 部署架构 (Deployment)
采用 **Serverless / Edge** 架构，无需传统后端。
- **Frontend**: 托管在 Vercel / Cloudflare Pages。
- **Proxy**: 使用 Next.js API Routes (`/api/notion/page`) 作为中转，隐藏 Notion API 的 CORS 限制，同时透传用户的 Token。
  - *注意*: Notion API 不支持浏览器直接调用 (CORS)，必须经过 API Route 代理。

## 4. MVP 开发计划 (Development Roadmap)
1. **基础框架搭建**: Next.js + Tailwind 初始化，配置 Notion 风格主题。
2. **API 代理层**: 实现通用的 Notion API Proxy。
3. **解析器开发**: 集成 `notion-to-md`，调试 Block 转换效果。
4. **前端实现**: 输入 URL -> 展示 Markdown -> 复制/下载按钮。
5. **图片打包**: 实现 JSZip 打包逻辑。

## 5. 待确认项 (Open Questions)
- 是否需要支持 Database (表格) 的 CSV 导出？(MVP 暂不建议，聚焦于文档/笔记的 Markdown 转换)。
- 图片下载是否在客户端进行？(建议客户端 fetch 图片 blob 然后 zip，减轻 Serverless 流量压力，但需测试跨域图片访问权限)。
