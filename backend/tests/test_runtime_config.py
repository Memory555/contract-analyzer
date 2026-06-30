from app.config import Settings
from app.services.runtime_config import ModelRuntimeConfig, RuntimeConfigStore


def test_runtime_config_overrides_env_model(tmp_path):
    settings = Settings(
        openai_api_key="env-key",
        openai_base_url="https://env.example/v1",
        openai_model="env-model",
        runtime_config_path=tmp_path / "model-config.json",
        upload_dir=tmp_path / "uploads",
    )
    store = RuntimeConfigStore(settings)
    store.update_model_config(
        openai_api_key="admin-key",
        openai_base_url="https://admin.example/v1",
        openai_model="admin-model",
    )

    config = store.get_effective_model_config()

    assert config.openai_api_key == "admin-key"
    assert config.openai_base_url == "https://admin.example/v1"
    assert config.openai_model == "admin-model"
    assert config.api_key_source == "admin"


def test_runtime_config_falls_back_to_env(tmp_path):
    settings = Settings(
        openai_api_key="env-key",
        openai_base_url="https://env.example/v1",
        openai_model="env-model",
        runtime_config_path=tmp_path / "missing.json",
        upload_dir=tmp_path / "uploads",
    )
    store = RuntimeConfigStore(settings)

    config = store.get_effective_model_config()

    assert config.openai_api_key == "env-key"
    assert config.openai_base_url == "https://env.example/v1"
    assert config.openai_model == "env-model"
    assert config.api_key_source == "env"


def test_user_override_takes_priority_over_admin_and_env(tmp_path):
    settings = Settings(
        openai_api_key="env-key",
        openai_base_url="https://env.example/v1",
        openai_model="env-model",
        runtime_config_path=tmp_path / "model-config.json",
        upload_dir=tmp_path / "uploads",
    )
    store = RuntimeConfigStore(settings)
    store.update_model_config(
        openai_api_key="admin-key",
        openai_base_url="https://admin.example/v1",
        openai_model="admin-model",
    )

    config = store.get_effective_model_config(
        override=ModelRuntimeConfig(
            openai_api_key="user-key",
            openai_base_url="https://user.example/v1",
            openai_model="user-model",
        )
    )

    assert config.openai_api_key == "user-key"
    assert config.openai_base_url == "https://user.example/v1"
    assert config.openai_model == "user-model"
    assert config.api_key_source == "user"
