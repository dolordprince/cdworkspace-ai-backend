#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="/root/cdesktop"
BACKEND="$ROOT/backend"
PY="$BACKEND/.venv/bin/python"
STAMP="$(date +%Y%m%d%H%M%S)"
BACKUP="$ROOT/.provider-migration-backup-$STAMP"

echo "============================================================"
echo "CDESTKTOP — PRODUCTION PROVIDER ARCHITECTURE FINALIZATION"
echo "============================================================"

cd "$ROOT"

echo "[1/10] Creating complete backend backup"
mkdir -p "$BACKUP"

cp -a "$BACKEND/app" "$BACKUP/app"
[ -f "$BACKEND/start.sh" ] && cp -a "$BACKEND/start.sh" "$BACKUP/start.sh" || true
[ -f "$BACKEND/requirements.txt" ] && cp -a "$BACKEND/requirements.txt" "$BACKUP/requirements.txt" || true
echo "[PASS] Backup: $BACKUP"

echo "[2/10] Verifying backend Python environment"

if [ ! -x "$PY" ]; then
    echo "[FAIL] Backend virtual environment missing: $PY"
    exit 1
fi

"$PY" --version

"$PY" - <<'PY'
import importlib.util

required = ("fastapi", "httpx", "pydantic", "bs4")

missing = [
    name for name in required
    if importlib.util.find_spec(name) is None
]

if missing:
    raise SystemExit(
        "[FAIL] Missing backend dependencies: " + ", ".join(missing)
    )

print("[PASS] Required backend dependencies available")
PY

echo "[3/10] Validating provider implementation"

cd "$BACKEND"

PYTHONPATH="$BACKEND" "$PY" - <<'PY'
from app.providers.openai_compatible import (
    OpenAICompatibleProvider,
    ProviderError,
)

assert OpenAICompatibleProvider is not None
assert ProviderError is not None

print("[PASS] OpenAI-compatible provider imports correctly")
PY

echo "[4/10] Validating provider registry"

PYTHONPATH="$BACKEND" "$PY" - <<'PY'
from app.providers.registry import (
    SUPPORTED_PROVIDERS,
    provider_status,
)

expected = {"openrouter", "groq", "cerebras"}

if SUPPORTED_PROVIDERS != expected:
    raise SystemExit(
        f"[FAIL] Provider registry mismatch: {SUPPORTED_PROVIDERS!r}"
    )

print("[PASS] Providers:", ", ".join(sorted(SUPPORTED_PROVIDERS)))
PY

echo "[5/10] Validating production configuration"

PYTHONPATH="$BACKEND" "$PY" - <<'PY'
from app.config import Settings

settings = Settings()

assert settings.openrouter_model.strip() == "z-ai/glm-5.2:free", (
    f"Unexpected OpenRouter model: {settings.openrouter_model!r}"
)

assert settings.openrouter_base_url.rstrip("/") == \
    "https://openrouter.ai/api/v1", (
        f"Unexpected OpenRouter base URL: "
        f"{settings.openrouter_base_url!r}"
    )

print("[PASS] OpenRouter primary model = z-ai/glm-5.2:free")
print("[PASS] OpenRouter base URL = https://openrouter.ai/api/v1")
PY

echo "[6/10] Validating provider model chain"

PYTHONPATH="$BACKEND" "$PY" - <<'PY'
from app.config import Settings

settings = Settings()

primary = settings.openrouter_model.strip()

if primary != "z-ai/glm-5.2:free":
    raise SystemExit(
        f"[FAIL] Invalid primary model: {primary!r}"
    )

fallback = getattr(settings, "openrouter_fallback_model", None)

if fallback is not None:
    fallback = str(fallback).strip()

if fallback and fallback == primary:
    raise SystemExit(
        "[FAIL] Fallback model must not equal primary model"
    )

print(f"[PASS] Primary model = {primary}")

if fallback:
    print(f"[PASS] Configured fallback model = {fallback}")
else:
    print("[INFO] No static fallback model field configured")
PY

echo "[7/10] Validating provider construction without external calls"

PYTHONPATH="$BACKEND" "$PY" - <<'PY'
from app.providers.openai_compatible import OpenAICompatibleProvider

provider = OpenAICompatibleProvider(
    name="openrouter",
    api_key="validation-key",
    base_url="https://openrouter.ai/api/v1",
    model="z-ai/glm-5.2:free",
    timeout=120,
)

assert provider.name == "openrouter"
assert provider.api_key == "validation-key"
assert provider.base_url == "https://openrouter.ai/api/v1"
assert provider.model == "z-ai/glm-5.2:free"
assert provider.endpoint == (
    "https://openrouter.ai/api/v1/chat/completions"
)

print("[PASS] OpenRouter provider construction")
print("[PASS] OpenRouter endpoint:", provider.endpoint)
PY

echo "[8/10] Compiling complete backend"

PYTHONPATH="$BACKEND" "$PY" -m compileall -q "$BACKEND/app"

echo "[PASS] Backend compilation completed"

echo "[9/10] Verifying FastAPI application import"

PYTHONPATH="$BACKEND" "$PY" - <<'PY'
from app.main import app

assert app is not None

routes = {
    getattr(route, "path", "")
    for route in app.routes
}

print("[PASS] FastAPI application imports successfully")
print(f"[PASS] Registered routes: {len(routes)}")
PY

echo "[10/10] Running structural provider audit"

PYTHONPATH="$BACKEND" "$PY" - <<'PY'
from pathlib import Path

root = Path("/root/cdesktop/backend/app")

registry = root / "providers" / "registry.py"
provider = root / "providers" / "openai_compatible.py"
config = root / "config.py"
main = root / "main.py"

required = [registry, provider, config, main]

for path in required:
    if not path.is_file():
        raise SystemExit(f"[FAIL] Required file missing: {path}")

registry_text = registry.read_text()
provider_text = provider.read_text()
config_text = config.read_text()

checks = {
    "openrouter registry": '"openrouter"' in registry_text,
    "groq registry": '"groq"' in registry_text,
    "cerebras registry": '"cerebras"' in registry_text,
    "OpenAI-compatible implementation":
        "class OpenAICompatibleProvider" in provider_text,
    "OpenRouter model":
        'openrouter_model: str = "z-ai/glm-5.2:free"' in config_text,
    "OpenRouter base URL":
        'openrouter_base_url: str = "https://openrouter.ai/api/v1"'
        in config_text,
}

failed = [name for name, ok in checks.items() if not ok]

if failed:
    for name in failed:
        print(f"[FAIL] {name}")
    raise SystemExit(1)

for name in checks:
    print(f"[PASS] {name}")

print("[PASS] Provider architecture structural audit")
PY

echo
echo "============================================================"
echo "PROVIDER ARCHITECTURE FINALIZATION COMPLETE"
echo "============================================================"
echo "Backup: $BACKUP"
echo "Backend: $BACKEND"
echo "Python:  $PY"
echo
echo "Primary provider: OpenRouter"
echo "Primary model:    z-ai/glm-5.2:free"
echo "Fallback model:   openrouter/free when configured by runtime"
echo "Providers:        openrouter, groq, cerebras"
echo "============================================================"
