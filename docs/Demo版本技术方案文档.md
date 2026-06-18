# 合同智能分析平台 Demo 版本技术方案文档

版本：Demo V0.1  
日期：2026-06-17  
适用范围：早期可演示版本，优先快速上线和验证交互闭环  
保留文档：`D:\feidu\工具1\contract-analyzer\docs\技术方案文档.md`

## 1. Demo 目标

Demo 版本暂时采用“方案 C：全部部署在 Vercel”的轻量实现方式。

目标是先完成一个可访问、可上传 DOCX、可调用 LLM、可展示结果、可下载 Excel 的早期演示版本，用于验证产品流程和界面体验。

Demo 版本不追求完整文件兼容和生产级后端能力。

## 2. 范围边界

### 2.1 Demo 包含

- 左侧导航工作台 UI。
- 左侧导航支持收缩和展开。
- 导航项均可跳转，未完成模块展示待开发占位内容。
- 设置页采用单列折叠列表，便于后续扩展更多配置项。
- 合同分析页面。
- DOCX 文件上传。
- 前端文件格式和大小校验。
- DOCX 文本提取。
- OpenAI / OpenAI-compatible `base_url` 调用。
- 付款计划明细提取。
- 质保明细提取。
- 合同问题提示。
- LLM 解析置信度展示。
- 原文片段 / 条款位置展示。
- Excel 下载。
- 浏览器本地保存最近分析记录，并定期清理超过 15 天的数据。
- 浏览器临时配置模型服务，包括 OpenAI-compatible `base_url`、API Key 和模型名。
- 设置页提供模型服务联通测试，用于在上传合同前验证 Base URL、API Key 和模型名是否可用。

### 2.2 Demo 不包含

- PDF 解析。
- DOC 转 DOCX。
- 扫描件识别。
- 多合同批量分析。
- 用户登录和权限系统。
- 服务端长期文件存储。
- 生产级任务队列。
- 复杂合同原文在线预览。

## 3. 推荐架构

```text
浏览器前端
  ↓
上传 DOCX / 展示结果 / IndexedDB 保存记录
  ↓
Vercel Serverless Function
  ↓
OpenAI / OpenAI-compatible base_url
  ↓
返回结构化 JSON
  ↓
前端展示并生成或请求生成 Excel
```

Demo 阶段建议使用一个 Next.js 项目承载前端页面和 API Routes。

## 4. 技术选型

| 层级 | Demo 推荐 |
|------|-----------|
| Web 框架 | Next.js |
| 部署 | Vercel |
| UI | Ant Design 或自定义 CSS |
| DOCX 解析 | mammoth.js |
| LLM 调用 | OpenAI JavaScript SDK；官方 OpenAI 地址走 Responses API，自定义 OpenAI-compatible 地址走 Chat Completions |
| 结构化输出 | 官方 OpenAI 使用 Structured Outputs / JSON Schema；自定义地址使用 JSON 输出约束 |
| 本地数据库 | IndexedDB，建议使用 Dexie.js |
| Excel 生成 | ExcelJS |

## 5. 项目结构建议

```text
contract-analyzer/
├── app/
│   ├── page.tsx
│   ├── layout.tsx
│   └── api/
│       └── analyze/
│           └── route.ts
├── components/
│   ├── AppShell.tsx
│   ├── UploadPanel.tsx
│   ├── ResultSummary.tsx
│   ├── IssuePanel.tsx
│   ├── PaymentTable.tsx
│   ├── WarrantyTable.tsx
│   └── SourceDrawer.tsx
├── lib/
│   ├── docx.ts
│   ├── llm.ts
│   ├── schema.ts
│   ├── excel.ts
│   └── local-db.ts
├── docs/
└── design/
```

说明：当前仓库已有 `frontend/` 和 `backend/` 预留目录。Demo 阶段如果采用 Next.js，可以后续将页面和 API Routes 放入 `frontend/`，或直接在项目根目录创建 Next.js 应用。正式开发前再统一目录。

## 6. DOCX 解析方案

Demo 版本只支持 DOCX。

建议使用 `mammoth.js` 在前端或 Serverless 中提取文本。

推荐流程：

```text
用户选择 DOCX
  ↓
前端校验扩展名和大小
  ↓
前端提取 DOCX 文本
  ↓
发送纯文本到 /api/analyze
  ↓
Serverless 调用 LLM
```

优势：

- Serverless API 不需要处理大文件上传。
- Vercel 函数压力更小。
- Demo 开发速度快。

限制：

- 复杂表格、页眉页脚、批注等内容可能提取不完整。
- 原文定位只能做到“文本片段 / 近似条款位置”，不能做到真实 Word 页码定位。

## 7. LLM 调用方案

### 7.1 Base URL 支持

Demo 也必须支持 `base_url`，避免写死官方 OpenAI 地址。

环境变量：

```text
OPENAI_API_KEY=...
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=...
```

规则：

- `OPENAI_API_KEY` 只存在 Vercel 环境变量中。
- 前端不得直接调用 OpenAI。
- Demo 阶段允许用户在设置页临时填写 API Key，并保存在当前浏览器本地；正式生产环境仍建议只使用 Vercel 服务端环境变量。
- `OPENAI_BASE_URL` 为空时使用 SDK 默认地址。
- `OPENAI_BASE_URL` 有值时传入 SDK client。
- 若页面未填写 API Key，官方 OpenAI 地址或空 Base URL 默认使用 Vercel 环境变量。
- 若页面未填写 API Key，但填写了官方 OpenAI Base URL 或模型名，Base URL / Model 可覆盖默认值，API Key 仍使用 Vercel 环境变量。
- 若页面填写了自定义 Base URL，必须同时填写该服务对应的 API Key，避免把全局 OpenAI Key 误用于自定义服务。
- 若页面设置和服务端环境变量都没有可用 API Key，系统不返回演示结果，而是提示用户配置模型服务。

接口兼容策略：

- 官方 OpenAI Base URL：使用 Responses API + JSON Schema。
- 自定义 OpenAI-compatible Base URL：使用 Chat Completions + JSON 输出约束。
- 该策略用于兼容部分只支持 `/chat/completions`、不支持 Responses API 的模型服务。

自定义 OpenAI-compatible 服务的当前生成参数：

```text
temperature=0.2
top_p=1
max_tokens=8192
stream=false
```

合同文本请求上限为 300000 字符。Demo 阶段仍是单次全量输入；如果后续合同更长或模型仍只关注开头，应升级为“条款检索 / 分段抽取 / 汇总校验”的多步流程。

### 7.2 API Route

建议接口：

```text
POST /api/analyze
```

请求：

```json
{
  "fileName": "飞渡采购合同模板.docx",
  "contractText": "合同纯文本...",
  "openaiApiKey": "可选，浏览器临时配置",
  "openaiBaseUrl": "可选，浏览器临时配置",
  "openaiModel": "可选，浏览器临时配置"
}
```

响应：

```json
{
  "issues": [],
  "payment_plan": [],
  "warranty": {
    "core_fields": [],
    "extra_fields": []
  },
  "confidence": {
    "overall": 0.86,
    "payment_plan": 0.9,
    "warranty": 0.82,
    "issues": 0.78
  }
}
```

## 8. 数据存储方案

Demo 版本不使用云数据库。

浏览器本地使用 IndexedDB 保存：

- 最近分析记录。
- 文件名。
- 分析时间。
- 结构化结果。
- 下载配置。

数据保留策略：

- 最近分析记录默认保留 15 天。
- 应用启动时自动删除 `createdAt` 早于 15 天前的记录。
- 清理仅作用于当前浏览器本地 IndexedDB，不影响用户已下载的 Excel 文件。

不保存：

- 后端 Prompt。
- 长期合同全文。

建议默认只保存结构化结果。如需保存合同原文片段，前端需要明确提示“数据仅保存在当前浏览器”。

说明：Demo 为便于测试，允许设置页将 API Key 临时保存在浏览器本地。该能力不作为正式生产安全方案。

## 9. Excel 导出方案

Demo 有两种实现：

### 9.1 前端生成 Excel

使用 ExcelJS 在浏览器中生成。

优点：

- 不需要后端生成文件。
- 更符合无云服务器 Demo 思路。

缺点：

- 大数据量时性能较弱，但 Demo 单合同可接受。

### 9.2 Serverless 生成 Excel

Serverless 根据分析结果生成并返回文件。

优点：

- 逻辑更接近正式后端。

缺点：

- API 复杂度略高。

Demo 推荐先采用前端 ExcelJS 生成。

## 10. Vercel 部署配置

需要配置环境变量：

```text
OPENAI_API_KEY
OPENAI_BASE_URL
OPENAI_MODEL
```

注意：

- `OPENAI_API_KEY` 不得以 `NEXT_PUBLIC_` 开头。
- `OPENAI_BASE_URL` 和 `OPENAI_MODEL` 如只在服务端使用，也不需要 `NEXT_PUBLIC_`。
- 前端可通过后端返回的能力信息展示当前模型别名，但不展示密钥。

## 11. Demo 风险

| 风险 | 说明 | Demo 处理 |
|------|------|-----------|
| DOCX 解析不完整 | 复杂表格可能丢失格式 | 先接受，后续正式版补强 |
| Serverless 超时 | 长合同 + LLM 调用可能超时 | 限制文件大小和文本长度 |
| LLM 输出异常 | JSON 不合法或缺字段 | Structured Outputs + 前端错误态 |
| 原文定位不精确 | 前端提取文本缺少真实页码 | 展示原文片段和近似条款 |
| API Key 安全 | 浏览器临时保存 Key 有泄露风险 | Demo 可用；正式环境使用 Vercel 服务端环境变量 |
| 模型未配置 | 无 API Key 时无法解析 | 提示用户先到设置配置模型服务 |

## 12. Demo 开发步骤

| 阶段 | 内容 |
|------|------|
| D1 | 创建 Next.js 前端和左侧导航工作台 |
| D2 | 实现导航收缩、模块跳转和待开发占位页 |
| D3 | 实现设置页折叠列表和模型服务配置 |
| D4 | 实现 DOCX 上传与 mammoth.js 文本提取 |
| D5 | 实现 `/api/analyze`，接入 OpenAI SDK 和 `base_url` |
| D6 | 定义 JSON Schema，输出付款、质保、问题和置信度 |
| D7 | 实现结果展示、原文片段抽屉、问题等级标签 |
| D8 | 使用 IndexedDB 保存最近分析记录 |
| D9 | 使用 ExcelJS 前端导出 Excel |
| D10 | 部署到 Vercel 并配置环境变量 |

## 13. 当前结论

Demo 阶段建议采用：

```text
Next.js + Vercel
DOCX only
mammoth.js 提取文本
Vercel API Route 调 OpenAI
支持 OPENAI_BASE_URL
无模型配置时提示用户到设置页配置模型服务
IndexedDB 保存本地记录，并清理超过 15 天的数据
ExcelJS 前端生成 Excel
```

这能最快验证产品闭环。正式版再根据需求升级为阿里云后端，补齐 PDF、DOC、批量任务和更稳定的文档解析能力。
