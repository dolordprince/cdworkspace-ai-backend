#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="/root/cdesktop"
BACKEND="$ROOT/backend"
PY="$BACKEND/.venv/bin/python"

echo "============================================================"
echo "CDESTKTOP — RUNTIME PROVIDER CONTRACT TEST REPAIR"
echo "============================================================"

cd "$ROOT"

if [[ ! -x "$PY" ]]; then
    echo "[FAIL] Backend virtual environment missing:"
    echo "       $PY"
    exit 1
fi

STAMP="$(date +%Y%m%d%H%M%S)"
BACKUP="$ROOT/.runtime-contract-test-backup-$STAMP"
mkdir -p "$BACKUP"

echo "[1/9] Backing up configuration"

cp "$BACKEND/app/config.py" "$BACKUP/config.py"
cp "$BACKEND/app/providers/registry.py" "$BACKUP/registry.py"

if [[ -f "$BACKEND/.env" ]]; then
    cp "$BACKEND/.env" "$BACKUP/backend.env"
fi

echo "[PASS] Backup: $BACKUP"

echo "[2/9] Verifying backend application package"

if [[ ! -f "$BACKEND/app/__init__.py" ]]; then
    echo "[FAIL] backend/app/__init__.py is missing"
    exit 1
fi

if [[ ! -f "$BACKEND/app/config.py" ]]; then
    echo "[FAIL] backend/app/config.py is missing"
    exit 1
fi

echo "[PASS] Backend app package exists"

echo "[3/9] Testing isolated backend import"

cd "$BACKEND"

PYTHONPATH="$BACKEND" \
"$PY" - <<'PY'
import sys
from pathlib import Path

expected = Path("/root/cdesktop/backend").resolve()

print(f"[INFO] Python: {sys.executable}")
print(f"[INFO] Application root: {expected}")

if str(expected) not in sys.path:
    raise SystemExit(
        "[FAIL] Backend application root is not in sys.path"
    )

import app

print(f"[PASS] Imported app from: {Path(app.__file__).resolve()}")

actual = Path(app.__file__).resolve()

if not str(actual).startswith(str(expected / "app")):
    raise SystemExit(
        f"[FAIL] Wrong app package imported: {actual}"
    )

print("[PASS] Correct backend app package imported")
PY

echo "[4/9] Loading production Settings"

PYTHONPATH="$BACKEND" \
"$PY" - <<'PY'
from app.config import get_settings

settings = get_settings()

model = settings.openrouter_model.strip()
base_url = settings.openrouter_base_url.rstrip("/")

print(f"[INFO] OpenRouter model : {model}")
print(f"[INFO] OpenRouter URL   : {base_url}")
print(f"[INFO] Groq model       : {settings.groq_model}")
print(f"[INFO] Cerebras model   : {settings.cerebras_model}")

if not model:
    raise SystemExit(
        "[FAIL] OpenRouter model is empty"
    )

if base_url != "https://openrouter.ai/api/v1":
    raise SystemExit(
        "[FAIL] OpenRouter base URL is incorrect"
    )

print("[PASS] Runtime Settings loaded")
PY

echo "[5/9] Verifying Render model override"

PYTHONPATH="$BACKEND" \
OPENROUTER_MODEL="anthropic/claude-sonnet-4.5" \
"$PY" - <<'PY'
from app.config import get_settings

settings = get_settings()

print(
    f"[INFO] Test environment model: "
    f"{settings.openrouter_model}"
)

if settings.openrouter_model != "anthropic/claude-sonnet-4.5":
    raise SystemExit(
        "[FAIL] OPENROUTER_MODEL environment override failed"
    )

print("[PASS] Render model override works")
PY

echo "[6/9] Validating provider registry"

PYTHONPATH="$BACKEND" \
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

for name in sorted(required):
    provider = providers[name]
    print(
        f"[PASS] {name}: "
        f"model={provider.model} "
        f"endpoint={provider.endpoint}"
    )

openrouter = providers["openrouter"]

if openrouter.endpoint != (
    "https://openrouter.ai/api/v1/chat/completions"
):
    raise SystemExit(
        "[FAIL] OpenRouter endpoint mismatch"
    )
PY

echo "[7/9] Compiling complete backend"

PYTHONPATH="$BACKEND" \
"$PY" -m compileall -q "$BACKEND/app"

echo "[PASS] Backend compilation"

echo "[8/9] Testing FastAPI application import"

PYTHONPATH="$BACKEND" \
"$PY" - <<'PY'
from app.main import app

print(f"[PASS] FastAPI application imported")
print(f"[INFO] Application title: {app.title}")
print(f"[INFO] Application version: {app.version}")

paths = set()

for route in app.routes:
    path = getattr(route, "path", None)

    if path:
        paths.add(path)

if "/api/ai/chat" not in paths:
    raise SystemExit(
        "[FAIL] /api/ai/chat route is missing"
    )

print("[PASS] /api/ai/chat route discovered")
print(f"[INFO] Direct routes discovered: {len(paths)}")
PY

echo "[9/9] Final provider contract"

PYTHONPATH="$BACKEND" \
"$PY" - <<'PY'
from app.config import get_settings
from app.providers.registry import build_providers

settings = get_settings()
providers = build_providers(settings)

print("============================================================")
print("FINAL PROVIDER CONTRACT")
print("============================================================")
print(f"Application : {settings.app_name}")
print(f"Environment : {settings.environment}")
print("")
print(f"OpenRouter  : {settings.openrouter_model}")
print(f"OpenRouter  : {settings.openrouter_base_url}")
print(f"Groq        : {settings.groq_model}")
print(f"Cerebras    : {settings.cerebras_model}")
print("")
print(
    "Providers   : "
    + ", ".join(sorted(providers))
)

if not settings.openrouter_api_key.strip():
    print("[WARN] OpenRouter key is not loaded locally")
else:
    print("[PASS] OpenRouter key is loaded locally")

print("[PASS] Provider contract validated")
print("============================================================")
PY

echo ""
echo "Render production model:"
echo "OPENROUTER_MODEL=anthropic/claude-sonnet-4.5"
echo ""
echo "The source default remains:"
echo "z-ai/glm-5.2:free"
echo ""
echo "The Render environment overrides that default."
echo ""
echo "Backup: $BACKUP"
echo "============================================================"
