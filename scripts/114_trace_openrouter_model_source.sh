#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="/root/cdesktop"
BACKEND="$ROOT/backend"
PYTHON="$BACKEND/.venv/bin/python"

echo "============================================================"
echo "CDESTKTOP — OPENROUTER MODEL SOURCE TRACE"
echo "============================================================"

echo "[1/7] Python environment"

echo "Python: $PYTHON"
"$PYTHON" --version

echo "[2/7] Environment variables"

if [[ -n "${OPENROUTER_MODEL:-}" ]]; then
    echo "[WARN] Shell OPENROUTER_MODEL=$OPENROUTER_MODEL"
else
    echo "[PASS] Shell OPENROUTER_MODEL is not exported"
fi

if [[ -n "${OPENROUTER_BASE_URL:-}" ]]; then
    echo "[WARN] Shell OPENROUTER_BASE_URL=$OPENROUTER_BASE_URL"
else
    echo "[PASS] Shell OPENROUTER_BASE_URL is not exported"
fi

echo "[3/7] Searching active backend environment files"

grep -RInE \
    --exclude='*.pyc' \
    --exclude-dir='__pycache__' \
    --exclude-dir='.git' \
    '^[[:space:]]*OPENROUTER_MODEL[[:space:]]*=' \
    "$BACKEND" \
    "$ROOT/.env" \
    "$ROOT/.env.production" \
    2>/dev/null || true

echo "[4/7] Searching provider implementation"

grep -RInE \
    --exclude='*.pyc' \
    --exclude-dir='__pycache__' \
    --exclude-dir='.git' \
    'qwen/qwen3-coder:free|OPENROUTER_MODEL|openrouter_model' \
    "$BACKEND/app" \
    2>/dev/null || true

echo "[5/7] Inspecting Settings object"

cd "$BACKEND"

env -u OPENROUTER_MODEL \
    -u OPENROUTER_BASE_URL \
    "$PYTHON" - <<'PY'
from app.config import Settings

settings = Settings()

print("Settings.openrouter_model =", repr(settings.openrouter_model))
print("Settings.openrouter_base_url =", repr(settings.openrouter_base_url))

print("Settings model fields:")

for name in dir(settings):
    if "openrouter" in name.lower():
        try:
            print(f"  {name} = {getattr(settings, name)!r}")
        except Exception:
            pass
PY

echo "[6/7] Inspecting build_providers input and output"

cd "$BACKEND"

env -u OPENROUTER_MODEL \
    -u OPENROUTER_BASE_URL \
    "$PYTHON" - <<'PY'
from app.config import Settings
from app.providers.registry import build_providers

settings = Settings()

print("BEFORE build_providers:")
print("  settings.openrouter_model =", repr(settings.openrouter_model))

providers = build_providers(settings)

print("AFTER build_providers:")
print("  settings.openrouter_model =", repr(settings.openrouter_model))

provider = providers["openrouter"]

print("OPENROUTER PROVIDER:")
print("  class    =", type(provider).__name__)
print("  model    =", repr(provider.model))
print("  base_url =", repr(provider.base_url))
print("  endpoint =", repr(provider.endpoint))

if settings.openrouter_model != provider.model:
    print("[FAIL] Provider registry changed or replaced the configured model")
    raise SystemExit(2)

print("[PASS] Provider model matches Settings")
PY

echo "[7/7] Full repository stale-model search"

grep -RInE \
    --exclude='*.pyc' \
    --exclude-dir='__pycache__' \
    --exclude-dir='.git' \
    --exclude-dir='target' \
    --exclude-dir='node_modules' \
    'qwen/qwen3-coder:free' \
    "$ROOT" \
    2>/dev/null || true

echo "============================================================"
echo "MODEL SOURCE TRACE COMPLETE"
echo "============================================================"
