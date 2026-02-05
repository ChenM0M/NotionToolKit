# NotionToolKit

Notion 万用工具箱（Next.js App Router）。

- 产品需求文档：`PRD.md`
- 前端项目目录：`app/`

## 本地开发

```bash
cd app
npm ci
npm run dev
```

默认端口：`http://localhost:3003`

## 部署到 Vercel

直接导入 GitHub 仓库即可。

- 在 Vercel 项目设置里将 `Root Directory` 设为 `app`（这是一个 monorepo 结构）
- 可选：如果你需要走代理访问 Notion / 图片资源，在 Vercel 项目里配置 `HTTP_PROXY` / `HTTPS_PROXY`

## 部署到 Cloudflare

本项目包含 Next.js Route Handlers（`app/src/app/api/*`）。Cloudflare Pages 的 “Static HTML Export” 方式不适用。

推荐：按 Cloudflare 官方文档使用 OpenNext 部署到 Cloudflare Workers。
