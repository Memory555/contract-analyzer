# 合同智能分析平台 Demo 交付测试与部署说明

版本：Demo V0.1  
日期：2026-06-17  
应用目录：`D:\feidu\工具1\contract-analyzer\frontend`

## 1. 当前交付内容

本次交付的是可运行的早期 Demo 平台。

已实现：

- 左侧导航工作台界面。
- 左侧导航支持收缩和展开。
- 导航项支持切换到对应页面，占位模块展示待开发内容。
- DOCX 文件上传与格式校验。
- 浏览器端 DOCX 文本提取。
- `/api/analyze` 分析接口。
- OpenAI API Key / Base URL / Model 环境变量配置。
- 设置页支持浏览器临时配置 OpenAI Base URL、API Key 和模型名。
- 若浏览器设置和服务端环境变量都未提供 API Key，系统提示用户先配置模型服务。
- 合同问题提示，支持错误、警告、提示三级。
- 付款计划明细表。
- 质保明细表，支持核心字段和扩展字段。
- LLM 解析置信度展示。
- 合同原文片段 / 条款位置侧边抽屉。
- 是否包含合同问题 Sheet 的 Excel 下载配置。
- ExcelJS 前端生成 Excel。
- IndexedDB 保存最近分析记录，启动时自动清理超过 15 天的记录。
- 设置页采用单列折叠列表，包含“模型服务配置”和“关于平台”。

暂不支持：

- PDF。
- DOC。
- 扫描件。
- 用户登录。
- 云端历史记录。
- 多合同批量分析。

## 2. 本地启动步骤

进入前端目录：

```bash
cd D:\feidu\工具1\contract-analyzer\frontend
```

安装依赖：

```bash
npm install
```

启动开发环境：

```bash
npm run dev
```

浏览器访问：

```text
http://localhost:3000
```

也可以先构建再启动生产模式：

```bash
npm run build
npm start
```

## 3. OpenAI 配置

复制环境变量示例：

```bash
copy .env.example .env.local
```

填写：

```text
OPENAI_API_KEY=你的 OpenAI 或兼容服务 Key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4.1-mini
NEXT_PUBLIC_DEMO_MODE=true
```

说明：

- `OPENAI_API_KEY` 不要加 `NEXT_PUBLIC_` 前缀。
- `OPENAI_BASE_URL` 可改成兼容 OpenAI 协议的中转地址。
- 若未配置 `OPENAI_API_KEY`，需要先到平台“设置”中填写模型服务配置，否则无法解析。

## 4. 用户点测流程

### 4.1 初始页面

1. 打开 `http://localhost:3000`。
2. 确认左侧导航展示：工作台、合同分析、问题审查、导出中心、设置。
3. 确认当前高亮为“合同分析”。
4. 确认页面标题为“上传 DOCX 合同并生成结构化分析结果”。
5. 点击导航栏收缩按钮，确认导航可收起为图标模式。
6. 再次点击收缩按钮，确认导航可展开。

### 4.1.1 导航跳转

1. 点击“工作台”。
2. 预期：进入“工作台”待开发占位页。
3. 点击“问题审查”。
4. 预期：进入“问题审查”待开发占位页。
5. 点击“导出中心”。
6. 预期：进入“导出中心”待开发占位页。
7. 点击“合同分析”。
8. 预期：回到合同上传分析页面。

### 4.1.2 设置页

1. 点击“设置”。
2. 点击展开“模型服务配置”。
3. 填写或修改 Base URL，例如 `https://api.openai.com/v1`。
4. 按需填写 API Key 和模型名。
5. 点击“保存设置”。
6. 刷新页面后再次进入设置页。
7. 预期：配置仍保存在当前浏览器。
8. 点击展开“关于平台”。
9. 预期：显示平台版本、文件范围、部署形态和数据说明。

### 4.2 文件格式校验

1. 上传非 DOCX 文件，例如 `.txt` 或 `.pdf`。
2. 预期：页面提示“Demo 版本暂时仅支持 DOCX 文件”。

### 4.3 DOCX 上传与分析

1. 上传 `D:\feidu\工具1\飞渡采购合同模板-V2.0.docx`。
2. 预期：页面先显示提取文本或 AI 解析中的状态。
3. 如果没有配置 OpenAI Key，预期提示先到“设置”配置模型服务。
4. 如果已配置 OpenAI Key，预期显示真实 LLM 分析结果。

### 4.4 结果展示

检查以下内容：

1. 合同问题提示区展示问题标签。
2. 问题等级包含“错误 / 警告 / 提示”。
3. 付款计划明细表中付款描述按多行展示。
4. 质保明细展示核心字段和扩展字段。
5. 任务摘要展示整体置信度。

### 4.5 原文定位

1. 点击问题或表格中的“查看原文位置”。
2. 预期：右侧打开侧边抽屉。
3. 抽屉展示涉及位置和原文片段。

### 4.6 Excel 下载

1. 保持“包含合同问题 Sheet”勾选。
2. 点击“下载 Excel”。
3. 预期：下载 `合同分析结果_{原文件名}.xlsx`。
4. 用 Excel 或 WPS 打开，确认包含：
   - 付款计划明细
   - 质保明细
   - 合同问题
5. 取消“包含合同问题 Sheet”后再次下载。
6. 预期：新的 Excel 不包含“合同问题”Sheet。

### 4.7 本地历史记录

1. 完成一次分析后，刷新页面。
2. 查看底部“最近分析记录”。
3. 点击记录。
4. 预期：恢复该次分析结果。
5. 说明：本地历史记录只保留 15 天，超过 15 天会在应用启动时自动清理。

## 5. 已执行冒烟测试

本地已执行：

```bash
npm run build
```

结果：通过。

已启动本地生产服务：

```bash
npm start
```

页面访问：

```text
http://localhost:3000
```

结果：HTTP 200。

API 冒烟测试：

```text
POST http://localhost:3000/api/analyze
```

结果：在未配置 `OPENAI_API_KEY` 时返回 428，并提示先配置模型服务。

## 6. Vercel 部署步骤

### 6.1 准备代码

确保部署目录为：

```text
D:\feidu\工具1\contract-analyzer\frontend
```

如果用 GitHub 连接 Vercel，需要把 `contract-analyzer` 或 `frontend` 推到仓库。

### 6.2 Vercel 项目设置

在 Vercel 创建项目时：

| 项目 | 设置 |
|------|------|
| Framework Preset | Next.js |
| Root Directory | `frontend` |
| Build Command | `npm run build` |
| Output Directory | 默认即可 |
| Install Command | `npm install` |

### 6.3 环境变量

在 Vercel Project Settings → Environment Variables 添加：

```text
OPENAI_API_KEY
OPENAI_BASE_URL
OPENAI_MODEL
NEXT_PUBLIC_DEMO_MODE
```

推荐值：

```text
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4.1-mini
NEXT_PUBLIC_DEMO_MODE=true
```

### 6.4 部署后测试

部署完成后打开 Vercel 域名，按“用户点测流程”完整测试一遍。

重点确认：

- DOCX 上传是否成功。
- `/api/analyze` 是否能调用模型。
- 设置页填写的 `OPENAI_BASE_URL` 和 Key 是否可用于调用模型。
- Excel 是否能下载。
- 刷新页面后本地历史记录是否仍在。
- 超过 15 天的 IndexedDB 历史记录会在应用启动时自动清理。

## 7. 后续建议

Demo 验证通过后，建议下一步补：

- UI 细节打磨。
- 真实 OpenAI 返回的提示词调优。
- 分析结果 Schema 更严格的校验。
- 合同文本过长时的截断或分段策略。
- 扩展 PDF / DOC 支持时，再升级到阿里云后端方案。
