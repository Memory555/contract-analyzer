# 合同智能分析平台

本目录用于后续前后端开发与原型迭代。

## 当前内容

- `frontend/`：前端单页应用预留目录。
- `backend/`：后端 API 与文档解析服务预留目录。
- `docs/需求分析与原型说明.md`：基于现有需求文档整理的产品分析、功能范围、交互状态与已确认设计决策。
- `docs/UI设计说明文档.md`：当前 UI 设计决策、布局、模块、交互与后续原型范围。
- `docs/技术方案文档.md`：前后端架构、OpenAI LLM 接入、文档解析、Excel 导出与部署方案。
- `docs/Demo版本技术方案文档.md`：早期 Demo 方案，暂定全部部署在 Vercel，仅支持 DOCX。
- `docs/Demo交付测试与部署说明.md`：Demo 使用、测试和 Vercel 部署步骤。
- `design/prototypes/low_fidelity_wireframe_v2_nav.svg`：导航版低保真原型沟通图。
- `design/assets/素材清单.md`：后续正式设计与开发可能需要补充的素材和业务样例。

## 建议开发路线

1. 基于导航版低保真原型确认可交互原型范围与页面状态。
2. 完成前端静态交互原型。
3. 接入后端上传、文档解析、OpenAI LLM 调用与 Excel 下载接口，OpenAI 调用需支持 `OPENAI_BASE_URL` 配置。
4. 使用样例合同做端到端验收。
5. 根据部署选择接入 Vercel 或阿里云运行环境。
