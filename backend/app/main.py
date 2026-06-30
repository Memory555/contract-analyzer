from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from urllib.parse import quote

from app.config import get_settings
from app.schemas import ApiError, BatchCreateRequest, BatchCreateResponse
from app.services.admin_views import render_admin_page
from app.services.id_service import timestamp_id
from app.services.job_service import JobService
from app.services.runtime_config import ModelRuntimeConfig, RuntimeConfigStore


settings = get_settings()
job_service = JobService(settings)
runtime_config_store = RuntimeConfigStore(settings)

app = FastAPI(title="Contract Analyzer Backend", version=settings.app_version)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ApiError)
async def api_error_handler(_, exc: ApiError):
    status_code = 404 if exc.code.endswith("NOT_FOUND") else 400
    return JSONResponse(status_code=status_code, content={"code": exc.code, "message": exc.message})


@app.get("/api/health")
async def health():
    return {"ok": True, "service": "contract-analyzer-backend", "version": settings.app_version}


@app.post("/api/model-test")
async def model_test(request: Request):
    body = await request.json()
    override = ModelRuntimeConfig(
        openai_api_key=(body.get("openaiApiKey") or "").strip() or None,
        openai_base_url=(body.get("openaiBaseUrl") or "").strip() or None,
        openai_model=(body.get("openaiModel") or "").strip() or None,
    )
    config = runtime_config_store.get_effective_model_config(override)
    if not config.openai_api_key:
        return JSONResponse(
            status_code=428,
            content={
                "code": "MODEL_SERVICE_NOT_CONFIGURED",
                "message": "尚未配置模型服务，请填写个人模型配置，或让管理员配置后端全局模型。",
            },
        )

    try:
        from openai import OpenAI

        client = OpenAI(api_key=config.openai_api_key, base_url=config.openai_base_url or None)
        try:
            response = client.responses.create(
                model=config.openai_model,
                input="请只回复 OK，用于测试模型服务连通性。",
                temperature=0.2,
                max_output_tokens=64,
            )
            sample = response.output_text
            mode = "responses"
        except Exception:
            response = client.chat.completions.create(
                model=config.openai_model,
                messages=[{"role": "user", "content": "请只回复 OK，用于测试模型服务连通性。"}],
                temperature=0.2,
                max_tokens=64,
            )
            sample = response.choices[0].message.content or "OK"
            mode = "chat_completions"
        return {
            "ok": True,
            "model": config.openai_model,
            "baseURL": config.openai_base_url or "SDK 默认地址",
            "sample": sample,
            "mode": mode,
            "source": {
                "apiKey": config.api_key_source,
                "baseURL": config.base_url_source,
                "model": config.model_source,
            },
        }
    except Exception as exc:
        return JSONResponse(
            status_code=502,
            content={
                "code": "MODEL_SERVICE_TEST_FAILED",
                "message": f"模型服务联通测试失败：{exc}",
            },
        )


def validate_admin_request(request: Request) -> None:
    if not settings.backend_admin_token:
        return
    token = request.headers.get("x-admin-token") or request.query_params.get("token")
    if token != settings.backend_admin_token:
        raise ApiError("ADMIN_UNAUTHORIZED", "管理口令不正确。")


@app.get("/admin", response_class=HTMLResponse)
async def admin_page(request: Request, message: str = ""):
    validate_admin_request(request)
    config = runtime_config_store.get_effective_model_config()
    return HTMLResponse(
        render_admin_page(
            config,
            has_admin_token=bool(settings.backend_admin_token),
            admin_token=request.query_params.get("token", ""),
            message=message,
        )
    )


@app.get("/api/admin/model-config")
async def get_model_config(request: Request):
    validate_admin_request(request)
    config = runtime_config_store.get_effective_model_config()
    return {
        "openaiBaseUrl": config.openai_base_url,
        "openaiModel": config.openai_model,
        "apiKeyConfigured": bool(config.openai_api_key),
        "apiKeySource": config.api_key_source,
        "baseUrlSource": config.base_url_source,
        "modelSource": config.model_source,
    }


@app.post("/admin/model-config")
async def update_model_config_form(
    request: Request,
    openai_api_key: str = Form(default=""),
    openai_base_url: str = Form(default=""),
    openai_model: str = Form(default=""),
):
    validate_admin_request(request)
    runtime_config_store.update_model_config(
        openai_api_key=openai_api_key.strip() or None,
        openai_base_url=openai_base_url.strip() or None,
        openai_model=openai_model.strip() or None,
        keep_existing_key=True,
    )
    token = request.query_params.get("token")
    redirect_url = "/admin?message=模型配置已保存"
    if token:
        redirect_url = f"/admin?token={token}&message=模型配置已保存"
    return RedirectResponse(redirect_url, status_code=303)


@app.post("/admin/model-test")
async def model_test_form(request: Request):
    validate_admin_request(request)
    token = request.query_params.get("token")
    try:
        config = runtime_config_store.get_effective_model_config()
        if not config.openai_api_key:
            message = "模型服务未配置：请先保存 API Key、Base URL 和模型名称"
        else:
            from openai import OpenAI

            client = OpenAI(api_key=config.openai_api_key, base_url=config.openai_base_url or None)
            try:
                response = client.responses.create(
                    model=config.openai_model,
                    input="请只回复 OK，用于测试模型服务连通性。",
                    temperature=0.2,
                    max_output_tokens=64,
                )
                sample = response.output_text or "OK"
                mode = "responses"
            except Exception:
                response = client.chat.completions.create(
                    model=config.openai_model,
                    messages=[{"role": "user", "content": "请只回复 OK，用于测试模型服务连通性。"}],
                    temperature=0.2,
                    max_tokens=64,
                )
                sample = response.choices[0].message.content or "OK"
                mode = "chat_completions"
            message = f"连通性测试成功：{config.openai_model}，{mode}，返回：{sample[:80]}"
    except Exception as exc:
        message = f"连通性测试失败：{exc}"

    redirect_url = f"/admin?message={quote(message)}"
    if token:
        redirect_url = f"/admin?token={quote(token)}&message={quote(message)}"
    return RedirectResponse(redirect_url, status_code=303)


@app.post("/api/admin/model-config")
async def update_model_config_api(request: Request):
    validate_admin_request(request)
    body = await request.json()
    runtime_config_store.update_model_config(
        openai_api_key=(body.get("openaiApiKey") or "").strip() or None,
        openai_base_url=(body.get("openaiBaseUrl") or "").strip() or None,
        openai_model=(body.get("openaiModel") or "").strip() or None,
        keep_existing_key=bool(body.get("keepExistingKey", True)),
    )
    config = runtime_config_store.get_effective_model_config()
    return {
        "openaiBaseUrl": config.openai_base_url,
        "openaiModel": config.openai_model,
        "apiKeyConfigured": bool(config.openai_api_key),
        "apiKeySource": config.api_key_source,
        "baseUrlSource": config.base_url_source,
        "modelSource": config.model_source,
    }


@app.post("/api/batches", response_model=BatchCreateResponse)
async def create_batch(request: BatchCreateRequest):
    if request.file_count > settings.max_batch_files:
        raise ApiError("TOO_MANY_FILES", f"单批最多支持 {settings.max_batch_files} 份合同。")
    return BatchCreateResponse(batchId=timestamp_id("b"))


@app.post("/api/jobs")
async def create_job(
    batch_id: str = Form(..., alias="batchId"),
    upload_index: int = Form(..., alias="uploadIndex"),
    openai_api_key: str = Form(default="", alias="openaiApiKey"),
    openai_base_url: str = Form(default="", alias="openaiBaseUrl"),
    openai_model: str = Form(default="", alias="openaiModel"),
    file: UploadFile = File(...),
):
    model_override = ModelRuntimeConfig(
        openai_api_key=openai_api_key.strip() or None,
        openai_base_url=openai_base_url.strip() or None,
        openai_model=openai_model.strip() or None,
    )
    return await job_service.create_job(batch_id, upload_index, file, model_override)


@app.get("/api/jobs/{job_id}")
async def get_job(job_id: str):
    return job_service.get_job(job_id)


@app.get("/api/jobs/{job_id}/result")
async def get_result(job_id: str):
    return job_service.get_result(job_id)
