# 合同智能分析平台

合同智能分析平台用于上传合同文件，自动提取合同文本，并调用大模型生成结构化分析结果，辅助合同审查人员快速查看付款计划、质保条款、风险问题和修改建议。

仓库早期 README 仍停留在 v1 Demo 口径。当前项目已经迭代到 v6，整体方向从“仅前端 DOCX Demo”升级为“前端工作台 + 后端文档解析/OCR/模型分析 + 反馈数据沉淀”的合同分析工具。

> 当前线上状态说明：如受资源或云托管成本限制，线上环境可能仍运行 v5 的 DOCX 版本；v6 的多格式合同解析需要部署独立后端和 OCR 相关配置。

## 当前能力

| 能力 | v6 目标状态 | 说明 |
|------|-------------|------|
| 合同上传分析 | 支持 | 前端工作台上传合同并生成结构化分析结果 |
| DOCX | 支持 | 可直接提取 Word 新版文档文本 |
| DOC | 支持 | 旧版 Word 文档需要后端 LibreOffice 转换能力 |
| PDF | 支持 | 优先读取文本层；扫描 PDF 需要 OCR |
| JPG / PNG | 支持 | 扫描件或照片需要 OCR |
| 批量分析 | 支持 | 多文件加入待分析列表，逐份处理，单份失败不影响整批 |
| 用户模型配置 | 支持 | 用户在前端设置自己的模型后，本次和后续分析优先使用用户模型 |
| 全局模型配置 | 支持 | 管理员可在后端管理页配置全局默认模型 |
| 后端管理页 | 支持 | 管理模型、检查 OCR/模型连通性、查看运行配置 |
| 反馈管理 | 支持 | 反馈数据可写入 PostgreSQL/Neon，用于后续复盘 |
| Excel 导出 | 支持 | 支持单合同和批量汇总导出 |

## 版本演进

| 版本 | 重点变化 |
|------|----------|
| v1 | 单合同 DOCX Demo，前端提取文本，调用模型并展示结果 |
| v2 | 增加批量分析、批量历史和 Excel 汇总导出 |
| v3 | 增加反馈管理，反馈数据接入 PostgreSQL |
| v4 | 梳理平台说明、限制、部署和验证文档 |
| v5 | 增加合同分析 Skill，支持通过 AI 平台轻量使用 |
| v6 | 增加后端解析链路，目标正式支持 PDF / DOC / DOCX / JPG / PNG 和扫描件 OCR |

## 项目结构

```text
contract-analyzer/
  frontend/                 Next.js 前端工作台
  backend/                  FastAPI 后端服务，负责解析、OCR、模型调用和管理页
  docs/                     需求、技术方案、交付和部署文档
  design/                   原型图和设计素材
```

主要目录说明：

| 路径 | 说明 |
|------|------|
| `frontend/app/page.tsx` | 前端主页面与合同分析工作台 |
| `frontend/app/components/` | 分析结果、批量任务、反馈、设置等 UI 组件 |
| `frontend/app/api/` | 前端 API 路由，包含模型测试、反馈和后端代理入口 |
| `frontend/lib/` | DOCX 解析、Excel 导出、本地存储、PostgreSQL 连接等工具 |
| `backend/app/main.py` | 后端 API 入口 |
| `backend/app/services/parser_service.py` | PDF / DOC / DOCX / 图片解析链路 |
| `backend/app/services/ocr_service.py` | OCR 调用封装 |
| `backend/app/services/llm_service.py` | 大模型调用封装 |
| `backend/app/services/runtime_config.py` | 后端运行时模型配置 |
| `backend/app/services/admin_views.py` | 后端管理页 |

## 本地启动

### 1. 启动前端

```bash
cd frontend
npm install
npm run dev
```

访问：

```text
http://127.0.0.1:3000
```

### 2. 启动后端

后端用于 v6 的多格式解析、OCR 和模型分析。若只验证早期 DOCX 前端 Demo，可暂不启动后端。

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

访问：

```text
http://127.0.0.1:8000/api/health
http://127.0.0.1:8000/admin?token={BACKEND_ADMIN_TOKEN}
```

如本地没有 `backend/requirements.txt`，说明当前分支尚未完整合入 v6 后端文件，请从 v6 分支或最新 release 同步后端目录。

## 环境变量

不要把真实密钥写入代码仓库。以下均为示例占位。

### 前端

前端环境变量通常写入 `frontend/.env.local`，云托管部署时写入前端服务的环境变量。

```text
# 后端服务地址。浏览器侧和服务端代理都需要知道后端在哪里。
NEXT_PUBLIC_BACKEND_API_BASE_URL=http://127.0.0.1:8000
BACKEND_API_BASE_URL=http://127.0.0.1:8000

# 反馈数据存储。仅影响反馈管理，不影响合同解析。
DATABASE_URL=postgresql://USER:PASSWORD@HOST/neondb?sslmode=require&channel_binding=require
PG_SSL=true

# 早期前端本地模型接口仍可保留，用于 DOCX Demo 或模型连通性测试。
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4.1-mini
```

### 后端

后端环境变量通常写入 `backend/.env`，云托管部署时写入后端服务的环境变量。

```text
# 后端管理页口令
BACKEND_ADMIN_TOKEN=请替换为随机长口令

# 管理员配置的全局默认模型。用户在前端配置个人模型时，优先使用用户模型。
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4.1-mini

# OCR。JPG、PNG、扫描 PDF 需要配置。
ENABLE_OCR=true
TENCENTCLOUD_SECRET_ID=
TENCENTCLOUD_SECRET_KEY=

# DOC 转换。旧版 DOC 通常需要 LibreOffice。
ENABLE_DOC_CONVERT=true
```

## 分析链路

```text
用户上传合同
  -> 前端创建分析任务
  -> 后端保存任务并解析文件
  -> PDF / DOC / DOCX / JPG / PNG 转为文本
  -> 扫描件通过 OCR 提取文字
  -> 调用用户模型或管理员全局模型
  -> 返回付款计划、质保明细、合同问题和摘要
  -> 前端展示结果并支持 Excel 导出 / 反馈提交
```

模型优先级：

```text
用户前端配置的模型 > 后端管理员配置的全局模型 > 演示结果兜底
```

## 部署建议

v6 推荐使用 CloudBase 云托管拆分部署：

| 服务 | 建议名称 | 目录 | 端口 | 作用 |
|------|----------|------|------|------|
| 前端 | `contract-analyzer-frontend` | `frontend/` | `3000` | 页面、上传、轮询、结果展示、反馈 |
| 后端 | `contract-analyzer-backend` | `backend/` | `8000` | 文档解析、OCR、模型分析、管理页 |

推荐顺序：

1. 在腾讯 CloudBase 创建或选择云开发环境。
2. 先部署后端云托管服务，配置 `BACKEND_ADMIN_TOKEN`、模型变量、OCR 变量。
3. 访问后端 `/api/health` 和 `/admin?token=...` 验证可用。
4. 如需反馈管理，创建 Neon PostgreSQL，复制 `DATABASE_URL`。
5. 再部署前端云托管服务，配置 `NEXT_PUBLIC_BACKEND_API_BASE_URL`、`BACKEND_API_BASE_URL`、`DATABASE_URL`、`PG_SSL`。
6. 打开前端页面，分别验证 DOCX、DOC、PDF、JPG、PNG 上传分析。

历史部署方式仍可参考：

| 文档 | 说明 |
|------|------|
| `docs/Cloudflare部署说明.md` | Cloudflare Workers + OpenNext 早期前端部署说明 |
| `docs/Demo交付测试与部署说明.md` | 早期 Demo 测试和 Vercel 部署说明 |
| `docs/v3反馈管理交付与部署说明.md` | 反馈管理和 PostgreSQL 接入说明 |

如已同步 v6 文档，请优先查看：

```text
docs/v6部署交付文档.md
docs/v6版本需求文档.md
docs/v6版本技术方案文档.md
docs/v6 合同智能分析平台.html
```

## 验收清单

基础验收：

- 前端页面可打开，左侧导航、上传区、批量摘要、结果区正常显示。
- 上传 DOCX 可完成分析并展示付款计划、质保明细、合同问题。
- 未配置模型时，页面能清楚提示配置缺失，或返回演示结果用于联调。
- 配置用户模型后，分析优先使用用户模型。
- 后端管理页可通过 `BACKEND_ADMIN_TOKEN` 访问。
- 后端模型连通性测试和 OCR 配置检查可用。

v6 多格式验收：

- 文本型 PDF 可提取文字并分析。
- 扫描 PDF 在 OCR 配置正确时可识别并分析。
- DOCX 可正常分析。
- DOC 在 LibreOffice 可用时可转换并分析。
- JPG / PNG 扫描件在 OCR 配置正确时可识别并分析。
- 批量上传时，单个文件失败不会导致整批任务中断。

反馈和导出验收：

- 单合同可导出 Excel。
- 批量任务可导出汇总 Excel。
- 用户可提交“有帮助 / 有问题”反馈。
- 配置 `DATABASE_URL` 后，反馈可在反馈管理或云端总览中查看。

## 常见问题

### 为什么 v6 需要后端？

PDF、DOC、扫描件图片和 OCR 都不适合只放在浏览器里处理。v6 后端负责安装 Python 解析库、LibreOffice、OCR SDK，并统一调用模型。

### 前端里的模型配置还有用吗？

有。用户在前端设置自己的模型后，分析请求会优先使用用户模型；后端管理员配置的是全局默认模型，用于没有个人配置的场景。

### `DATABASE_URL` 影响合同解析吗？

不影响。`DATABASE_URL` 只用于反馈管理和云端总览。合同能否解析主要取决于后端地址、文档解析依赖、OCR 配置和模型配置。

### 浏览器请求为什么还打到前端 `/api/jobs`？

这是正常的前端代理入口。部署时需要同时配置 `NEXT_PUBLIC_BACKEND_API_BASE_URL` 和 `BACKEND_API_BASE_URL`，让前端 API 路由把请求转发到后端。

### 线上仍然只能上传 DOCX 是什么原因？

说明当前线上仍运行早期前端版本，或没有部署 v6 后端。要启用 PDF / DOC / JPG / PNG，需要按 v6 部署方案部署后端并配置 OCR、模型和前端后端地址。

## 开发约定

- 真实密钥只放在本地 `.env` 或云平台环境变量中，不提交到 Git。
- 文档中的连接串、Token、API Key 均使用占位符。
- 前端改动后至少执行 `npm run build`。
- 后端改动后至少执行 `pytest` 或对应服务测试。
- 涉及部署的改动需要同步更新 README 和部署交付文档。
