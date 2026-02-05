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

## 部署到 Cloudflare

本项目包含 Next.js Route Handlers（`app/src/app/api/*`）。Cloudflare Pages 的 “Static HTML Export” 方式不适用。

推荐：按 Cloudflare 官方文档使用 OpenNext 部署到 Cloudflare Workers。
