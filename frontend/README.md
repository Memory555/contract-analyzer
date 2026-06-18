# 合同智能分析平台 Demo

这是早期 Demo 版本，采用 Next.js 方案，仅支持 DOCX。

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
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4.1-mini
NEXT_PUBLIC_DEMO_MODE=true
```

未配置 `OPENAI_API_KEY` 时，系统会返回内置演示结果，方便先测试 UI 闭环。

## 当前范围

- DOCX 上传
- 浏览器端 DOCX 文本提取
- Serverless API 调用 OpenAI 或返回演示结果
- 问题提示、付款计划、质保明细展示
- 原文片段抽屉
- IndexedDB 保存最近记录
- ExcelJS 前端导出

## 文字内容调整位置

- 页面主要展示文案：`app/page.tsx`
- 浏览器标题和图标：`app/layout.tsx`
- 样式：`app/globals.css`
- 模型抽取提示词：`app/api/analyze/route.ts`

当前不是传统单个静态 HTML 文件，而是 Next.js 应用。修改 `app/page.tsx` 后需要重新部署或重新构建。
