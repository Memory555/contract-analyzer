---
title: "合同智能分析 Skill"
description: "快速分析 DOCX 合同文件，提取付款计划、质保明细和合同问题。适用于偶尔分析 1-2 份合同、快速看看付款和质保条款的场景。"
agent_created: true
---

# 合同智能分析 Skill

## 能力

这是一个独立运行的 CLI 工具，可以在各类 AI 工具（包括 WorkBuddy、Cursor、Windsurf 等）中使用，用于快速分析单份 DOCX 合同文件。

### 支持的分析内容
- **付款计划**：阶段、比例、触发条件、时限、备注
- **质保明细**：质保期、响应时效、违约金、服务范围等
- **合同问题**：条款矛盾、数值缺失、逻辑冲突、定义模糊（三级严重程度：error / warning / info）

### 输出形式
默认输出为人类可读的 Markdown 报告，支持输出到控制台或保存为文件。
可选原始 JSON 输出，便于嵌入其他自动化流程。

## 安装与使用

### 安装

从 GitHub Releases 下载 skill 包后解压，运行：

```bash
npm install
```

### 基本用法

```bash
# 方式一：使用环境变量
export OPENAI_API_KEY="your-api-key"
export OPENAI_BASE_URL="https://api.openai.com/v1"  # 可选
export MODEL="gpt-4.1-mini"  # 可选
node scripts/analyze.js --file 合同.docx

# 方式二：命令行传入
node scripts/analyze.js --file 合同.docx --api-key sk-xxx --base-url https://api.deepseek.com/v1

# 输出到文件
node scripts/analyze.js --file 合同.docx --output 分析报告.md
```

### 支持的 AI 平台

| 平台 | Base URL |
|------|----------|
| OpenAI | `https://api.openai.com/v1` |
| NVIDIA NIM | `https://integrate.api.nvidia.com/v1` |
| DeepSeek | `https://api.deepseek.com/v1` |
| 阿里百炼 | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| 自定义 | 任何 OpenAI-compatible 服务 |

## 工作流程

```
DOCX 文件
    ↓
mammoth.js 提取纯文本
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
| 交互方式 | Web 界面 | 命令行 / 对话 |
| 批量分析 | 支持（最多 20 份） | 不支持（单份） |
| 历史记录 | 本地 IndexedDB + 云端 PostgreSQL | 无（临时分析） |
| Excel 导出 | 多 Sheet 批量汇总 | 不支持（仅文本报告） |
| 反馈管理 | 云端存储 | 无 |
| 应用场景 | 对外服务、团队协作 | 个人快速分析、嵌入 AI 工作流 |

## 免责声明

本分析结果仅供参考，不构成法律意见。请始终以合同原文为准。

## 下载

- **GitHub 仓库**：https://github.com/Memory555/contract-analyzer
- **Releases 下载**：https://github.com/Memory555/contract-analyzer/releases
- **当前版本**：v5.0.0

## License

MIT
