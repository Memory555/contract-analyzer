from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    app_version: str = "v6.0.0"
    openai_api_key: str | None = None
    openai_base_url: str | None = "https://api.openai.com/v1"
    openai_model: str = "gpt-4.1-mini"
    backend_admin_token: str | None = None
    runtime_config_path: Path = Field(default=BACKEND_ROOT / "data" / "model-config.json")
    max_upload_mb: int = 20
    max_batch_files: int = 20
    enable_ocr: bool = True
    enable_doc_convert: bool = True
    libreoffice_path: str | None = None
    tencentcloud_secret_id: str | None = None
    tencentcloud_secret_key: str | None = None
    tencentcloud_ocr_region: str = "ap-guangzhou"
    upload_dir: Path = Field(default=Path("tmp/uploads"))

    model_config = SettingsConfigDict(
        env_file=(BACKEND_ROOT / ".env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    return settings
