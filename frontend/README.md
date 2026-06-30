# 合同智能分析平台 v6 前端

这是 v6 前端工作台，文件解析、OCR 和模型分析由 FastAPI 后端处理。

## 本地运行

```bash
npm install
npm run dev
```

打开：

```text
http://localhost:3000
```

## 环境变量

复制 `.env.example` 为 `.env.local`，按需填写：

```text
NEXT_PUBLIC_BACKEND_API_BASE_URL=http://localhost:8000
BACKEND_API_BASE_URL=http://localhost:8000
```

v6 前端不再配置 `OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL`。用户个人模型在页面“设置”中保存，并随上传任务提交给后端；管理员全局模型在后端 `/admin` 中配置。

如需使用反馈管理的云端反馈接口，还可以配置 `.env.example` 中的 PostgreSQL 变量：

```text
DATABASE_URL=
PG_SSL=true
```

## 当前范围

- PDF / DOC / DOCX / JPG / PNG 上传
- 调用 v6 后端创建解析任务
- 后端解析、OCR 和模型分析
- 问题提示、付款计划、质保明细展示
- 原文片段抽屉
- IndexedDB 保存最近记录
- ExcelJS 前端导出

## 文字内容调整位置

- 页面主要展示文案：`app/page.tsx`
- 浏览器标题和图标：`app/layout.tsx`
- 样式：`app/globals.css`
- 后端 API client：`lib/backend-api.ts`

当前不是传统单个静态 HTML 文件，而是 Next.js 应用。修改 `app/page.tsx` 后需要重新部署或重新构建。

## Cloudflare 部署

项目已补充 Cloudflare Workers + OpenNext 适配，保留现有 Vercel 部署方式不变。

常用命令：

```bash
npm run cf:build
npm run cf:preview
npm run cf:deploy
```

完整配置和控制台部署流程见：

```text
../docs/Cloudflare部署说明.md
```
