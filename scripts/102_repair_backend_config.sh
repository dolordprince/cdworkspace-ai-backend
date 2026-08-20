#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="/root/cdesktop"
BACKEND="$ROOT/backend"
PY="$BACKEND/.venv/bin/python"
CONFIG="$BACKEND/app/config.py"
STAMP="$(date +%Y%m%d%H%M%S)"
BACKUP="$ROOT/.config-repair-backup-$STAMP"

echo "============================================================"
echo "CDESTKTOP — BACKEND CONFIGURATION REPAIR"
echo "============================================================"

cd "$ROOT"

if [ ! -x "$PY" ]; then
    echo "[FAIL] Backend Python missing: $PY"
    exit 1
fi

if [ ! -f "$CONFIG" ]; then
    echo "[FAIL] Missing: $CONFIG"
    exit 1
fi

echo "[1/8] Backing up current configuration"

mkdir -p "$BACKUP"
cp -a "$CONFIG" "$BACKUP/config.py"

echo "[PASS] Backup: $BACKUP/config.py"

echo "[2/8] Reading existing configuration fields"

cat "$CONFIG"

echo
echo "[3/8] Writing clean production configuration"

cat > "$CONFIG" <<'PY'
from __future__ import annotations

import os
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # Application
    app_name: str = "Traveler Dev API"
    app_version: str = "1.0.0"

    # Server
    host: str = "0.0.0.0"
    port: int = 8000

    # OpenRouter — production primary
    openrouter_api_key: str = Field(
        default_factory=lambda: os.getenv(
            "OPENROUTER_API_KEY",
            "",
        ).strip()
    )

    openrouter_base_url: str = (
        "https://openrouter.ai/api/v1"
    )

    openrouter_model: str = (
        "z-ai/glm-5.2:free"
    )

    openrouter_fallback_model: str = (
        "openrouter/free"
    )

    openrouter_fallback_models: str = ""

    openrouter_site_url: str = ""

    openrouter_app_name: str = "Traveler Dev"

    # OpenRouter resilience
    openrouter_retry_max: int = 2
    openrouter_retry_default_seconds: float = 5.0

    # Groq
    groq_api_key: str = Field(
        default_factory=lambda: os.getenv(
            "GROQ_API_KEY",
            "",
        ).strip()
    )

    groq_base_url: str = (
        "https://api.groq.com/openai/v1"
    )

    groq_model: str = ""

    # Cerebras
    cerebras_api_key: str = Field(
        default_factory=lambda: os.getenv(
            "CEREBRAS_API_KEY",
            "",
        ).strip()
    )

    cerebras_base_url: str = (
        "https://api.cerebras.ai/v1"
    )

    cerebras_model: str = ""

    # HTTP
    request_timeout: float = 120.0

    # CORS
    cors_origins: str = (
        "http://localhost:3000,"
        "http://localhost:5173"
    )

    # Trusted hosts
    trusted_hosts: str = (
        "localhost,"
        "127.0.0.1,"
        "testserver,"
        "*.hf.space,"
        "*.onrender.com"
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
PY

echo "[PASS] Clean config.py written"

echo "[4/8] Compiling configuration"

cd "$BACKEND"

PYTHONPATH="$BACKEND" "$PY" -m py_compile "$CONFIG"

echo "[PASS] config.py syntax valid"

echo "[5/8] Loading Settings"

PYTHONPATH="$BACKEND" "$PY" - <<'PY'
from app.config import Settings

settings = Settings()

assert settings.openrouter_model == "z-ai/glm-5.2:free"
assert settings.openrouter_base_url == "https://openrouter.ai/api/v1"
assert settings.openrouter_fallback_model == "openrouter/free"

print("[PASS] Settings loaded")
print("[PASS] Primary:", settings.openrouter_model)
print("[PASS] Fallback:", settings.openrouter_fallback_model)
print("[PASS] OpenRouter:", settings.openrouter_base_url)
PY

echo "[6/8] Validating provider registry"

PYTHONPATH="$BACKEND" "$PY" - <<'PY'
from app.config import Settings
from app.providers.registry import (
    SUPPORTED_PROVIDERS,
    build_providers,
)

settings = Settings()

expected = {
    "openrouter",
    "groq",
    "cerebras",
}

if SUPPORTED_PROVIDERS != expected:
    raise SystemExit(
        f"Provider set mismatch: {SUPPORTED_PROVIDERS!r}"
    )

providers = build_providers(settings)

if "openrouter" not in providers:
    raise SystemExit(
        "OpenRouter provider was not constructed"
    )

provider = providers["openrouter"]

assert provider.model == "z-ai/glm-5.2:free"
assert provider.base_url == "https://openrouter.ai/api/v1"
assert provider.endpoint == (
    "https://openrouter.ai/api/v1/chat/completions"
)

print("[PASS] Provider registry")
print("[PASS] OpenRouter provider construction")
PY

echo "[7/8] Compiling complete backend"

PYTHONPATH="$BACKEND" "$PY" -m compileall -q "$BACKEND/app"

echo "[PASS] Complete backend compilation"

echo "[8/8] Importing FastAPI application"

PYTHONPATH="$BACKEND" "$PY" - <<'PY'
from app.main import app

if app is None:
    raise SystemExit("FastAPI app is unavailable")

print("[PASS] FastAPI application imported")
print("[PASS] Routes:", len(app.routes))
PY

echo
echo "============================================================"
echo "BACKEND CONFIGURATION REPAIR COMPLETE"
echo "============================================================"
echo "Primary model:  z-ai/glm-5.2:free"
echo "Fallback model: openrouter/free"
echo "OpenRouter:      https://openrouter.ai/api/v1"
echo "Providers:       openrouter, groq, cerebras"
echo "Backup:          $BACKUP/config.py"
echo "============================================================"
