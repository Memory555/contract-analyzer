from dataclasses import dataclass
from pathlib import Path
import asyncio

from fastapi import UploadFile

from app.config import Settings
from app.schemas import ApiError, ExtractionResult, JobResponse, JobResultResponse, JobStatus
from app.services.id_service import now_iso, timestamp_id
from app.services.llm_service import LlmService
from app.services.parser_service import ParserService, detect_file_type, validate_upload
from app.services.runtime_config import ModelRuntimeConfig


@dataclass
class JobRecord:
    job_id: str
    contract_id: str
    batch_id: str
    upload_index: int
    file_name: str
    file_type: str
    file_size: int
    file_path: Path
    status: JobStatus
    progress: int
    stage_message: str
    created_at: str
    updated_at: str
    error_code: str | None = None
    error_message: str | None = None
    extraction: ExtractionResult | None = None
    analysis: dict | None = None
    model_override: ModelRuntimeConfig | None = None


class JobService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.parser_service = ParserService(settings)
        self.llm_service = LlmService(settings)
        self.jobs: dict[str, JobRecord] = {}

    async def create_job(
        self,
        batch_id: str,
        upload_index: int,
        file: UploadFile,
        model_override: ModelRuntimeConfig | None = None,
    ) -> JobResponse:
        content_length = 0
        job_id = timestamp_id("j")
        contract_id = timestamp_id("c")
        file_type = detect_file_type(file.filename or "")
        safe_name = Path(file.filename or f"contract.{file_type}").name
        file_path = self.settings.upload_dir / f"{job_id}_{safe_name}"

        with file_path.open("wb") as target:
            while chunk := await file.read(1024 * 1024):
                content_length += len(chunk)
                if content_length > self.settings.max_upload_mb * 1024 * 1024:
                    file_path.unlink(missing_ok=True)
                    raise ApiError("FILE_TOO_LARGE", f"文件大小超过 {self.settings.max_upload_mb}MB，请选择更小的文件。")
                target.write(chunk)

        validate_upload(safe_name, content_length, self.settings.max_upload_mb)

        created_at = now_iso()
        record = JobRecord(
            job_id=job_id,
            contract_id=contract_id,
            batch_id=batch_id,
            upload_index=upload_index,
            file_name=safe_name,
            file_type=file_type,
            file_size=content_length,
            file_path=file_path,
            status=JobStatus.uploaded,
            progress=5,
            stage_message="文件已上传，等待解析。",
            created_at=created_at,
            updated_at=created_at,
            model_override=model_override,
        )
        self.jobs[job_id] = record
        asyncio.create_task(self.run_job(job_id))
        return self.to_response(record)

    async def run_job(self, job_id: str) -> None:
        record = self.jobs[job_id]
        try:
            self.update_job(record, JobStatus.extracting, 20, "正在解析合同文本。")
            extraction = await self.parser_service.parse(record.file_path, record.file_name)
            record.extraction = extraction

            self.update_job(record, JobStatus.analyzing, 75, "正在调用模型分析合同。")
            analysis = await self.llm_service.analyze(record.file_name, extraction.plain_text, record.model_override)
            record.analysis = analysis

            self.update_job(record, JobStatus.succeeded, 100, "分析完成。")
        except ApiError as exc:
            record.error_code = exc.code
            record.error_message = exc.message
            next_status = JobStatus.ocr_processing if exc.code == "OCR_REQUIRED" else JobStatus.failed
            if next_status == JobStatus.ocr_processing:
                record.status = JobStatus.failed
                record.progress = 45
                record.stage_message = exc.message
                record.updated_at = now_iso()
            else:
                self.update_job(record, JobStatus.failed, record.progress, exc.message)
        except Exception as exc:
            record.error_code = "JOB_FAILED"
            record.error_message = "任务处理失败，请稍后重试。"
            self.update_job(record, JobStatus.failed, record.progress, record.error_message)

    def update_job(self, record: JobRecord, status: JobStatus, progress: int, stage_message: str) -> None:
        record.status = status
        record.progress = progress
        record.stage_message = stage_message
        record.updated_at = now_iso()

    def get_job(self, job_id: str) -> JobResponse:
        record = self.jobs.get(job_id)
        if not record:
            raise ApiError("JOB_NOT_FOUND", "未找到对应任务。")
        return self.to_response(record)

    def get_result(self, job_id: str) -> JobResultResponse:
        record = self.jobs.get(job_id)
        if not record:
            raise ApiError("JOB_NOT_FOUND", "未找到对应任务。")
        if record.status != JobStatus.succeeded or not record.extraction or not record.analysis:
            raise ApiError("JOB_NOT_READY", "任务尚未完成，暂不能获取结果。")
        return JobResultResponse(
            jobId=record.job_id,
            contractId=record.contract_id,
            batchId=record.batch_id,
            extraction=record.extraction,
            analysis=record.analysis,
        )

    def to_response(self, record: JobRecord) -> JobResponse:
        return JobResponse(
            jobId=record.job_id,
            contractId=record.contract_id,
            batchId=record.batch_id,
            uploadIndex=record.upload_index,
            fileName=record.file_name,
            fileType=record.file_type,
            fileSize=record.file_size,
            status=record.status,
            progress=record.progress,
            stageMessage=record.stage_message,
            errorCode=record.error_code,
            errorMessage=record.error_message,
            createdAt=record.created_at,
            updatedAt=record.updated_at,
        )
