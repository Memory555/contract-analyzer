# Backend

后端用于实现合同分析 API：

- 接收 PDF / DOC / DOCX 上传。
- 将合同文件解析为纯文本。
- 调用 LLM 并解析结构化 JSON。
- 生成包含三张 Sheet 的 Excel 文件。
- 返回解析结果与下载链接。

建议后续使用 FastAPI 实现，模块可拆分为：

- `main.py`：API 入口。
- `parser.py`：文档解析。
- `llm_client.py`：LLM 调用封装。
- `excel_writer.py`：Excel 生成。

