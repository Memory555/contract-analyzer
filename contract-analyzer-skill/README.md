# 合同智能分析 Skill

**轻量级合同分析工具，可直接在 AI 平台（Codex / Claude / WorkBuddy）中使用，无需配置 API Key。**

## 两种使用方式

| 方式 | 适用场景 | 是否需要安装 | 是否需要 API Key |
|------|----------|------------|----------------|
| **🤖 AI 平台 Skill**（推荐） | 日常使用 Codex / Claude / WorkBuddy | 一次安装 | ❌ 不需要 |
| **💬 直接对话上传** | 临时使用、任何 AI 对话 | 不需要 | ❌ 不需要 |

---

## 方式一：AI 平台 Skill（推荐）

适合在支持 Skill 扩展的 AI 工具中使用（Codex、Claude、WorkBuddy 等）。安装后，直接在对话中上传合同文件即可分析，**无需配置 API Key**（由 AI 平台统一提供模型能力）。

### 安装方式 A：远程安装（推荐）

直接在 AI 平台对话中发送安装指令，平台自动从 GitHub 拉取并集成 Skill：

| 平台 | 指令 |
|------|------|
| **Codex** | `从 https://github.com/Memory555/contract-analyzer/releases/download/v5.0.0/contract-analyzer-skill-v5.0.0.zip 安装合同智能分析 Skill` |
| **Claude** | 在 Project Settings → Skills 中添加 URL：`https://github.com/Memory555/contract-analyzer/releases/download/v5.0.0/contract-analyzer-skill-v5.0.0.zip` |
| **WorkBuddy** | `从 https://github.com/Memory555/contract-analyzer/releases/download/v5.0.0/contract-analyzer-skill-v5.0.0.zip 安装合同智能分析 Skill` |

安装完成后，直接在对话中上传合同文件：

> **用户：** 分析这份合同，提取付款计划和质保条款 [上传 合同.docx]
>
> **AI：** 正在分析...

### 安装方式 B：本地路径安装

适合网络受限或需要自定义 Skill 的场景：

1. 浏览器下载 [contract-analyzer-skill-v5.0.0.zip](https://github.com/Memory555/contract-analyzer/releases/download/v5.0.0/contract-analyzer-skill-v5.0.0.zip)，解压到项目目录（如 `my-project/skills/contract-analyzer`）
2. 在 AI 平台中指定本地路径安装：
   - **Codex**：`从本地 my-project/skills/contract-analyzer 目录安装 Skill`
   - **Claude**：在 Project Settings → Skills 中添加本地路径
   - **WorkBuddy**：`从本地 E:\my-project\skills\contract-analyzer 目录安装合同智能分析 Skill`

---

## 方式二：直接对话上传（零安装）

适合临时使用。直接在 ChatGPT、Claude、Gemini、Kimi 等任何支持文件上传的 AI 对话中：

1. 上传 DOCX 合同文件
2. 粘贴以下提示词：

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

AI 直接读取文件并输出分析结果。**无需安装任何工具，无需配置 API Key。**

> ⚠️ 局限性：直接对话方式依赖 AI 自身对文件的理解能力，结构化程度不如 Skill 版本稳定。

---

## 功能对比

| 功能 | AI 平台 Skill | 直接对话 |
|------|-------------|----------|
| 安装成本 | 一次安装 | 无 |
| API Key | ❌ 不需要 | ❌ 不需要 |
| 付款计划提取 | ✅ 完整 | ⚠️ 依赖 AI |
| 质保明细提取 | ✅ 完整 | ⚠️ 依赖 AI |
| 合同问题检查 | ✅ 三级分级 | ⚠️ 不稳定 |
| 比例校验 | ✅ 自动 | ⚠️ 不稳定 |
| 置信度标注 | ✅ 有 | ❌ 无 |
| 结构化 JSON 输出 | ✅ 支持 | ❌ 不支持 |
| 适用场景 | 日常分析 | 临时快速查看 |

---

## 下载

- **Skill 安装包**：`https://github.com/Memory555/contract-analyzer/releases/download/v5.0.0/contract-analyzer-skill-v5.0.0.zip`
- **完整项目**：`https://github.com/Memory555/contract-analyzer/tree/v5`

---

## 技术说明

- **前端平台版本**：见 `docs/v5 合同智能分析平台.html`
- **分析逻辑**：SKILL.md 中定义了完整的 Prompt 和 JSON Schema
- **文档解析**：浏览器端使用 mammoth.js，无需后端服务

---

*免责声明：AI 分析结果仅供参考，不构成法律意见。关键合同条款请交由专业法务人员审核。*
