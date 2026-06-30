# Contract Analyzer Backend v6

FastAPI backend for CloudBase Run. It receives PDF / DOC / DOCX / JPG / PNG files, creates asynchronous analysis jobs, extracts text, optionally runs OCR, calls the configured LLM, and returns v5-compatible analysis results.

## Local Run

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Health check:

```text
http://localhost:8000/api/health
```

## Environment

Copy `.env.example` to `.env` and fill real keys. `backend/.env` is ignored by git.

```text
APP_VERSION=v6.0.0
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4.1-mini
BACKEND_ADMIN_TOKEN=
RUNTIME_CONFIG_PATH=backend/data/model-config.json
MAX_UPLOAD_MB=20
MAX_BATCH_FILES=20
ENABLE_OCR=true
ENABLE_DOC_CONVERT=true
LIBREOFFICE_PATH=
TENCENTCLOUD_SECRET_ID=
TENCENTCLOUD_SECRET_KEY=
TENCENTCLOUD_OCR_REGION=ap-guangzhou
```

`OPENAI_*` 是后端兜底模型配置。实际分析优先级为：前端用户个人模型 > 后端管理员全局模型 > 后端 `.env`。

## Backend Admin

Start the backend and open:

```text
http://127.0.0.1:8000/admin
```

The admin page can update the backend model `Base URL`, `Model` and `API Key` without restarting the service. Runtime model configuration is stored in:

```text
backend/data/model-config.json
```

This file is ignored by git because it may contain secrets.

For deployed environments, set `BACKEND_ADMIN_TOKEN` and open:

```text
https://your-backend-domain/admin?token=your-token
```
