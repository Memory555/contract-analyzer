# 合同智能分析平台

当前仓库已完成 v1 版本交付，包含可运行的合同智能分析 Demo、Vercel 部署配置和 Cloudflare Workers + OpenNext 部署适配。

## 当前内容

- `frontend/`：Next.js 合同智能分析前端应用，包含 DOCX 上传、合同文本提取、模型分析、结果展示、本地历史记录和 Excel 导出。
- `backend/`：后端 API 与文档解析服务预留目录，v1 暂未启用独立后端服务。
- `docs/需求分析与原型说明.md`：基于现有需求文档整理的产品分析、功能范围、交互状态与已确认设计决策。
- `docs/UI设计说明文档.md`：当前 UI 设计决策、布局、模块、交互与后续原型范围。
- `docs/技术方案文档.md`：前后端架构、OpenAI LLM 接入、文档解析、Excel 导出与部署方案。
- `docs/Demo版本技术方案文档.md`：早期 Demo 方案，暂定全部部署在 Vercel，仅支持 DOCX。
- `docs/Demo交付测试与部署说明.md`：Demo 使用、测试和 Vercel 部署步骤。
- `docs/Cloudflare部署说明.md`：Cloudflare Workers + OpenNext 配置和部署流程。
- `docs/v1版本交付说明.md`：v1 版本范围、部署入口、验收清单和 v2 迭代建议。
- `design/prototypes/low_fidelity_wireframe_v2_nav.svg`：导航版低保真原型沟通图。
- `design/assets/素材清单.md`：后续正式设计与开发可能需要补充的素材和业务样例。

## v1 快速启动

```bash
cd frontend
npm install
npm run dev
```

访问：

```text
http://localhost:3000
```

生产构建验证：

```bash
npm run build
```

## 建议开发路线

1. v1 已完成前端 Demo、模型服务配置、DOCX 分析、Excel 导出、Vercel 部署和 Cloudflare 部署适配。
2. v2 建议优先补齐 PDF / DOC 支持、长合同分段抽取、云端历史记录、批量分析和更细粒度的审查规则。
3. 如进入生产化阶段，再评估是否拆出独立后端服务、文件存储、任务队列和权限体系。
