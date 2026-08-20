#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="/root/cdesktop"
BACKEND="$ROOT/backend"
PY="$BACKEND/.venv/bin/python"

echo "============================================================"
echo "CDESTKTOP — OPENROUTER RUNTIME CONTRACT ALIGNMENT"
echo "============================================================"

cd "$ROOT"

if [[ ! -x "$PY" ]]; then
    echo "[FAIL] Backend Python environment missing: $PY"
    exit 1
fi

STAMP="$(date +%Y%m%d%H%M%S)"
BACKUP="$ROOT/.openrouter-runtime-contract-backup-$STAMP"

mkdir -p "$BACKUP"

echo "[1/8] Backing up provider configuration"

cp "$BACKEND/app/config.py" "$BACKUP/config.py"
cp "$BACKEND/app/providers/registry.py" "$BACKUP/registry.py"

[[ -f "$BACKEND/.env" ]] &&
    cp "$BACKEND/.env" "$BACKUP/backend.env"

[[ -f "$BACKEND/.env.example" ]] &&
    cp "$BACKEND/.env.example" "$BACKUP/backend.env.example"

echo "[PASS] Backup: $BACKUP"

echo "[2/8] Inspecting current Settings defaults"

grep -nE \
    'openrouter_model|openrouter_base_url|openrouter_fallback' \
    "$BACKEND/app/config.py" || true

echo "[3/8] Verifying OpenRouter Settings source"

cd "$BACKEND"

env -u PYTHONPATH \
"$PY" - <<'PY'
from pathlib import Path

path = Path("app/config.py")
text = path.read_text(encoding="utf-8")

required = [
    'openrouter_model: str = "z-ai/glm-5.2:free"',
    'openrouter_base_url: str = "https://openrouter.ai/api/v1"',
]

for item in required:
    if item not in text:
        raise SystemExit(
            f"[FAIL] Missing source default: {item}"
        )

print("[PASS] Source default = z-ai/glm-5.2:free")
print("[PASS] Source URL = https://openrouter.ai/api/v1")
PY

echo "[4/8] Validating runtime Settings"

env -u PYTHONPATH \
PYTHONSAFEPATH=1 \
"$PY" - <<'PY'
import sys

print(f"[INFO] Python executable: {sys.executable}")

from app.config import get_settings

settings = get_settings()

model = settings.openrouter_model.strip()
url = settings.openrouter_base_url.rstrip("/")

print(f"[INFO] Runtime OpenRouter model: {model}")
print(f"[INFO] Runtime OpenRouter URL  : {url}")

if not model:
    raise SystemExit(
        "[FAIL] Runtime OpenRouter model is empty"
    )

if url != "https://openrouter.ai/api/v1":
    raise SystemExit(
        "[FAIL] Runtime OpenRouter URL is incorrect"
    )

print("[PASS] Runtime OpenRouter model configured")
print("[PASS] Runtime OpenRouter URL correct")
PY

echo "[5/8] Validating provider registry"

env -u PYTHONPATH \
PYTHONSAFEPATH=1 \
"$PY" - <<'PY'
from app.config import get_settings
from app.providers.registry import build_providers

settings = get_settings()
providers = build_providers(settings)

required = {
    "openrouter",
    "groq",
    "cerebras",
}

missing = required - set(providers)

if missing:
    raise SystemExit(
        f"[FAIL] Missing providers: {sorted(missing)}"
    )

openrouter = providers["openrouter"]

expected_endpoint = (
    "https://openrouter.ai/api/v1/chat/completions"
)

if openrouter.endpoint != expected_endpoint:
    raise SystemExit(
        f"[FAIL] OpenRouter endpoint mismatch: "
        f"{openrouter.endpoint}"
    )

print(f"[PASS] OpenRouter model = {openrouter.model}")
print(f"[PASS] OpenRouter endpoint = {openrouter.endpoint}")
print("[PASS] Groq provider registered")
print("[PASS] Cerebras provider registered")
PY

echo "[6/8] Verifying Render environment override behavior"

env -u PYTHONPATH \
PYTHONSAFEPATH=1 \
OPENROUTER_MODEL="anthropic/claude-sonnet-4.5" \
"$PY" - <<'PY'
from app.config import get_settings

settings = get_settings()

model = settings.openrouter_model.strip()

print(f"[INFO] Simulated Render model: {model}")

if model != "anthropic/claude-sonnet-4.5":
    raise SystemExit(
        "[FAIL] Environment model does not override source default"
    )

print(
    "[PASS] Render OPENROUTER_MODEL override works"
)
PY

echo "[7/8] Backend compilation"

env -u PYTHONPATH \
PYTHONSAFEPATH=1 \
"$PY" -m compileall -q app

echo "[PASS] Backend compilation"

echo "[8/8] Final production contract"

env -u PYTHONPATH \
PYTHONSAFEPATH=1 \
"$PY" - <<'PY'
from app.config import get_settings
from app.providers.registry import build_providers

settings = get_settings()
providers = build_providers(settings)

print("============================================================")
print("OPENROUTER RUNTIME CONTRACT")
print("============================================================")
print(f"Provider : openrouter")
print(f"Model    : {settings.openrouter_model}")
print(f"Base URL : {settings.openrouter_base_url}")
print(f"Endpoint : {providers['openrouter'].endpoint}")

if settings.openrouter_api_key.strip():
    print("[PASS] OpenRouter API key loaded")
else:
    print("[WARN] OpenRouter API key not loaded locally")

print("[PASS] Provider architecture is runtime-configurable")
print("============================================================")
PY

echo ""
echo "Render production configuration:"
echo "OPENROUTER_MODEL=anthropic/claude-sonnet-4.5"
echo "OPENROUTER_BASE_URL=https://openrouter.ai/api/v1"
echo "OPENROUTER_FALLBACK_MODEL=openrouter/free"
echo ""
echo "Backup: $BACKUP"
echo "============================================================"
