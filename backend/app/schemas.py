from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class JobStatus(str, Enum):
    created = "created"
    uploaded = "uploaded"
    extracting = "extracting"
    ocr_processing = "ocr_processing"
    analyzing = "analyzing"
    succeeded = "succeeded"
    failed = "failed"
    cancelled = "cancelled"


class BatchCreateRequest(BaseModel):
    file_count: int = Field(alias="fileCount", ge=1)
    source: str = "web"


class BatchCreateResponse(BaseModel):
    batch_id: str = Field(alias="batchId")


class JobResponse(BaseModel):
    job_id: str = Field(alias="jobId")
    contract_id: str = Field(alias="contractId")
    batch_id: str = Field(alias="batchId")
    upload_index: int = Field(alias="uploadIndex")
    file_name: str = Field(alias="fileName")
    file_type: str = Field(alias="fileType")
    file_size: int = Field(alias="fileSize")
    status: JobStatus
    progress: int = 0
    stage_message: str = Field(default="", alias="stageMessage")
    error_code: str | None = Field(default=None, alias="errorCode")
    error_message: str | None = Field(default=None, alias="errorMessage")
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")


class ExtractionResult(BaseModel):
    source_type: str = Field(alias="sourceType")
    plain_text: str = Field(alias="plainText")
    segments: list[dict[str, Any]] = Field(default_factory=list)
    page_count: int | None = Field(default=None, alias="pageCount")
    char_count: int = Field(alias="charCount")
    warnings: list[str] = Field(default_factory=list)
    parser_version: str = Field(default="v6.0.0", alias="parserVersion")


class JobResultResponse(BaseModel):
    job_id: str = Field(alias="jobId")
    contract_id: str = Field(alias="contractId")
    batch_id: str = Field(alias="batchId")
    extraction: ExtractionResult
    analysis: dict[str, Any]


class ApiError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)
