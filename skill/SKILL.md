---
title: "合同智能分析 Skill"
description: "快速分析 DOCX 合同文件，提取付款计划、质保明细和合同问题。适用于偶尔分析 1-2 份合同、快速看看付款和质保条款的场景。"
agent_created: true
---

# 合同智能分析 Skill

## 能力

这是一个轻量级的合同分析能力包，可以在多种环境中使用，用于快速分析单份 DOCX 合同文件。

### 支持的分析内容
- **付款计划**：阶段、比例、触发条件、时限、备注
- **质保明细**：质保期、响应时效、违约金、服务范围等
- **合同问题**：条款矛盾、数值缺失、逻辑冲突、定义模糊（三级严重程度：error / warning / info）

### 输出形式
- 人类可读的 Markdown 报告（表格 + 列表格式）
- 可选原始 JSON 输出，便于嵌入其他自动化流程

---

## 使用方式

本 Skill 提供三种使用方式，按适用场景选择：

| 方式 | 适用场景 | 是否需要配置 API | 是否需要安装 |
|------|----------|------------------|-------------|
| **AI 平台 Skill** | 日常使用 Codex / Claude / WorkBuddy | ❌ 不需要 | 一次安装 |
| **终端命令行（CLI）** | 开发者、自动化脚本、CI/CD | ✅ 需要自行配置 | 需要 Node.js |
| **直接对话上传** | 临时使用、快速查看 | ❌ 不需要 | 不需要 |

### 方式一：AI 平台 Skill（推荐）

适合在支持 Skill 扩展的 AI 工具中使用（如 Codex、Claude、WorkBuddy 等）。

**优势：** 无需配置 API Key，由 AI 平台统一提供模型能力。

#### 安装方式 A：AI 平台直接安装（推荐）

无需下载任何文件。直接在 AI 平台对话中发送安装指令，平台自动从 GitHub 拉取并集成 Skill。

| 平台 | 安装指令 |
|------|----------|
| **Codex** | `从 https://github.com/Memory555/contract-analyzer/releases/download/v5.0.0/contract-analyzer-skill-v5.0.0.zip 安装合同智能分析 Skill` |
| **Claude** | 在 Project Settings → Skills 中添加 URL：`https://github.com/Memory555/contract-analyzer/releases/download/v5.0.0/contract-analyzer-skill-v5.0.0.zip` |
| **WorkBuddy** | `从 https://github.com/Memory555/contract-analyzer/releases/download/v5.0.0/contract-analyzer-skill-v5.0.0.zip 安装合同智能分析 Skill` |

安装完成后，直接在对话中上传合同文件即可分析：

> **用户：** 分析这份合同，提取付款计划和质保条款 [上传 合同.docx]
>
> **AI：** 正在分析合同...
>
> 📊 **付款计划**
> | 阶段 | 名称 | 比例 | 触发条件 | 时限 |
> | 第一阶段 | 预付款 | 30% | 合同签订后 | 5个工作日 |
> ...
>
> 🔧 **质保明细**
> ...
>
> ⚠️ **发现 1 个问题**
> 【ERROR】条款矛盾：...

#### 安装方式 B：下载到本地项目中使用

适合开发者或需要离线使用的场景。下载 Skill 包到本地，通过代码调用或命令行运行。

1. **下载 Skill 包：**
   ```bash
   # 下载 zip 包
   curl -L https://github.com/Memory555/contract-analyzer/releases/download/v5.0.0/contract-analyzer-skill-v5.0.0.zip -o skill.zip
   unzip skill.zip -d my-project/skills

   # 或克隆 v5 分支
   git clone https://github.com/Memory555/contract-analyzer.git -b v5
   cp -r contract-analyzer/skill my-project/skills/contract-analyzer
   ```

2. **在项目中通过代码调用：**
   ```javascript
   const skill = require('./skills/contract-analyzer');
   const result = await skill.analyze('合同.docx');
   console.log(result.paymentPlan);  // 付款计划
   console.log(result.warranty);     // 质保明细
   console.log(result.issues);       // 合同问题
   ```

3. **或通过命令行运行（需配置 API Key）：**
   ```bash
   cd my-project/skills/contract-analyzer
   npm install
   export OPENAI_API_KEY="your-api-key"
   node scripts/analyze.js --file 合同.docx --output 结果.md
   ```

#### 工作原理

Skill 中包含完整的分析 Prompt 和 JSON Schema 定义。AI 平台使用自身内置的模型能力执行分析，无需用户配置 API Key。分析逻辑与平台版本（v4）完全一致。

---

### 方式二：终端命令行（CLI）

适合开发者、自动化脚本或需要集成到 CI/CD 流水线的场景。

#### 安装

```bash
# 从 GitHub Releases 下载
curl -L https://github.com/Memory555/contract-analyzer/releases/download/v5.0.0/contract-analyzer-skill-v5.0.0.zip -o skill.zip
unzip skill.zip -d contract-analyzer-skill

# 或克隆仓库
git clone https://github.com/Memory555/contract-analyzer.git -b v5
cd contract-analyzer/skill

# 安装依赖
npm install
```

#### 使用

```bash
# 方式一：环境变量（推荐）
export OPENAI_API_KEY="your-api-key"
export OPENAI_BASE_URL="https://api.openai.com/v1"  # 可选
export MODEL="gpt-4.1-mini"  # 可选
node scripts/analyze.js --file 合同.docx

# 方式二：命令行传入
node scripts/analyze.js --file 合同.docx --api-key sk-xxx --base-url https://api.deepseek.com/v1

# 输出到文件
node scripts/analyze.js --file 合同.docx --output 分析报告.md

# 输出 JSON
node scripts/analyze.js --file 合同.docx --json
```

#### 支持的 AI 平台

| 平台 | Base URL |
|------|----------|
| OpenAI | `https://api.openai.com/v1` |
| NVIDIA NIM | `https://integrate.api.nvidia.com/v1` |
| DeepSeek | `https://api.deepseek.com/v1` |
| 阿里百炼 | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| 自定义 | 任何 OpenAI-compatible 服务 |

---

### 方式三：直接对话上传（最简）

适合临时使用，无需安装任何工具。

在任何支持文件上传的 AI 对话中（ChatGPT、Claude、Gemini、Kimi 等），直接上传 DOCX 文件并粘贴以下提示词：

```
请分析这份合同，提取以下结构化信息，以 Markdown 表格输出：

1. 付款计划：阶段、名称、比例、触发条件、时限、备注
2. 质保明细：质保期、响应时效、违约金、服务范围、质保期起算日、质保金退还条件、质保范围排除项
3. 合同问题：检查条款矛盾、数值缺失、逻辑冲突、定义模糊，按 ERROR / WARNING / INFO 分级

注意：
- 比例总和应为 100%，如果不符请标注
- 质保期如有多种表述（如"3年"和"验收后1年"），请指出矛盾
- 输出格式：Markdown 表格 + 问题列表
```

**局限性：** 依赖 AI 自身对文件的理解能力，结构化程度不如 Skill / CLI 版本稳定。

---

## 工作流程

```
DOCX 文件
    ↓
mammoth.js 提取纯文本（保留段落结构）
    ↓
OpenAI Responses API + JSON Schema 结构化输出
    ↓
Markdown 报告 / JSON 结果
```

## 技术栈

- **文档解析**：[mammoth](https://github.com/mwilliamson/mammoth.js) - 纯组语级别的 DOCX 文本提取，保留段落结构
- **AI 调用**：[OpenAI SDK](https://github.com/openai/openai-node) - 支持任何 OpenAI-compatible 服务
- **结构化输出**：JSON Schema + Responses API - 稳定的结构化抽取，避免模型幻觉
- **输出格式**：Markdown 报告 - 人类可读，支持在对话中展示

## 与平台版本的区别

| | 平台版本 (v4) | Skill 版本 (v5) |
|---|---|---|
| 交互方式 | Web 界面 | CLI / AI 对话 / 直接对话 |
| 批量分析 | 支持（最多 20 份） | 不支持（单份） |
| 历史记录 | 本地 IndexedDB + 云端 PostgreSQL | 无（临时分析） |
| Excel 导出 | 多 Sheet 批量汇总 | 不支持（仅文本报告） |
| 反馈管理 | 云端存储 | 无 |
| API 配置 | Web 界面配置一次 | CLI 需配置 / AI 平台无需配置 |
| 应用场景 | 对外服务、团队协作 | 个人快速分析、嵌入 AI 工作流 |

## 免责声明

本分析结果仅供参考，不构成法律意见。请始终以合同原文为准。

## 下载

- **GitHub 仓库**：https://github.com/Memory555/contract-analyzer
- **Releases 下载**：https://github.com/Memory555/contract-analyzer/releases
- **当前版本**：v5.0.0
- **Skill 下载**：https://github.com/Memory555/contract-analyzer/releases/download/v5.0.0/contract-analyzer-skill-v5.0.0.zip

## License

MIT
