from pathlib import Path
import json

from pydantic import BaseModel

from app.config import Settings


class ModelRuntimeConfig(BaseModel):
    openai_api_key: str | None = None
    openai_base_url: str | None = None
    openai_model: str | None = None


class EffectiveModelConfig(BaseModel):
    openai_api_key: str | None = None
    openai_base_url: str | None = None
    openai_model: str
    api_key_source: str
    base_url_source: str
    model_source: str


class RuntimeConfigStore:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.path = self._resolve_path(settings.runtime_config_path)
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def get_saved_model_config(self) -> ModelRuntimeConfig:
        if not self.path.exists():
            return ModelRuntimeConfig()
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
            return ModelRuntimeConfig(**data)
        except Exception:
            return ModelRuntimeConfig()

    def get_effective_model_config(self, override: ModelRuntimeConfig | None = None) -> EffectiveModelConfig:
        saved = self.get_saved_model_config()
        override = override or ModelRuntimeConfig()
        api_key = override.openai_api_key or saved.openai_api_key or self.settings.openai_api_key
        base_url = override.openai_base_url or saved.openai_base_url or self.settings.openai_base_url
        model = override.openai_model or saved.openai_model or self.settings.openai_model or "gpt-4.1-mini"
        return EffectiveModelConfig(
            openai_api_key=api_key,
            openai_base_url=base_url,
            openai_model=model,
            api_key_source="user" if override.openai_api_key else "admin" if saved.openai_api_key else "env",
            base_url_source="user" if override.openai_base_url else "admin" if saved.openai_base_url else "env",
            model_source="user" if override.openai_model else "admin" if saved.openai_model else "env",
        )

    def update_model_config(
        self,
        *,
        openai_api_key: str | None,
        openai_base_url: str | None,
        openai_model: str | None,
        keep_existing_key: bool = True,
    ) -> ModelRuntimeConfig:
        current = self.get_saved_model_config()
        next_config = ModelRuntimeConfig(
            openai_api_key=(openai_api_key or None) if not keep_existing_key else (openai_api_key or current.openai_api_key),
            openai_base_url=openai_base_url or None,
            openai_model=openai_model or None,
        )
        self.path.write_text(
            json.dumps(next_config.model_dump(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return next_config

    def _resolve_path(self, path: Path) -> Path:
        if path.is_absolute():
            return path
        return Path.cwd() / path
