from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Traveler Dev"
    environment: str = "production"

    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    groq_base_url: str = "https://api.groq.com/openai/v1"

    cerebras_api_key: str = ""
    cerebras_model: str = "zai-glm-4.7"
    cerebras_base_url: str = "https://api.cerebras.ai/v1"

    cloudflare_account_id: str = ""
    cloudflare_api_token: str = ""
    cloudflare_api_base_url: str = "https://api.cloudflare.com/client/v4"
    cloudflare_default_project: str = "traveler-dev"

    request_timeout: float = 180.0
    max_request_body_bytes: int = 15_000_000

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
