#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="/root/cdesktop"
BACKEND="$ROOT/backend"
PY="$BACKEND/.venv/bin/python"
CONFIG="$BACKEND/app/config.py"
STAMP="$(date +%Y%m%d%H%M%S)"
BACKUP="$ROOT/.openrouter-config-backup-$STAMP"

echo "============================================================"
echo "CDESTKTOP — OPENROUTER PRODUCTION MODEL CORRECTION"
echo "============================================================"

cd "$ROOT"

if [ ! -x "$PY" ]; then
    echo "[FAIL] Backend Python missing: $PY"
    exit 1
fi

if [ ! -f "$CONFIG" ]; then
    echo "[FAIL] Configuration missing: $CONFIG"
    exit 1
fi

echo "[1/7] Creating configuration backup"

mkdir -p "$BACKUP"
cp -a "$CONFIG" "$BACKUP/config.py"

echo "[PASS] Backup: $BACKUP/config.py"

echo "[2/7] Inspecting current OpenRouter configuration"

grep -nE \
    'openrouter_(model|base_url)' \
    "$CONFIG" || true

echo "[3/7] Replacing incorrect OpenRouter model"

"$PY" - "$CONFIG" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
text = path.read_text()

replacement = "openrouter_model: str = \"z-ai/glm-5.2:free\""

pattern = r'(?m)^\s*openrouter_model\s*:\s*str\s*=\s*["\'][^"\']*["\']\s*$'

new_text, count = re.subn(
    pattern,
    replacement,
    text,
    count=1,
)

if count == 0:
    raise SystemExit(
        "[FAIL] Could not locate openrouter_model in config.py"
    )

path.write_text(new_text)

print("[PASS] OpenRouter model set to z-ai/glm-5.2:free")
PY

echo "[4/7] Verifying exact configuration"

"$PY" - "$CONFIG" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text()

expected_model = 'openrouter_model: str = "z-ai/glm-5.2:free"'
expected_url = (
    'openrouter_base_url: str = '
    '"https://openrouter.ai/api/v1"'
)

if expected_model not in text:
    raise SystemExit(
        "[FAIL] Production OpenRouter model is not correct"
    )

if expected_url not in text:
    raise SystemExit(
        "[FAIL] Production OpenRouter base URL is not correct"
    )

print("[PASS] Model = z-ai/glm-5.2:free")
print("[PASS] Base URL = https://openrouter.ai/api/v1")
PY

echo "[5/7] Loading configuration through backend"

cd "$BACKEND"

PYTHONPATH="$BACKEND" "$PY" - <<'PY'
from app.config import Settings

settings = Settings()

print("Loaded model:", settings.openrouter_model)
print("Loaded base URL:", settings.openrouter_base_url)

if settings.openrouter_model != "z-ai/glm-5.2:free":
    raise SystemExit(
        "[FAIL] Runtime configuration still has the wrong model"
    )

if settings.openrouter_base_url.rstrip("/") != \
    "https://openrouter.ai/api/v1":
    raise SystemExit(
        "[FAIL] Runtime configuration has the wrong base URL"
    )

print("[PASS] Runtime configuration is correct")
PY

echo "[6/7] Compiling backend"

PYTHONPATH="$BACKEND" "$PY" -m compileall -q "$BACKEND/app"

echo "[PASS] Backend compilation successful"

echo "[7/7] Running provider registry validation"

PYTHONPATH="$BACKEND" "$PY" - <<'PY'
from app.config import Settings
from app.providers.registry import (
    SUPPORTED_PROVIDERS,
    provider_status,
)

settings = Settings()

expected = {
    "openrouter",
    "groq",
    "cerebras",
}

if SUPPORTED_PROVIDERS != expected:
    raise SystemExit(
        f"[FAIL] Provider registry mismatch: "
        f"{SUPPORTED_PROVIDERS!r}"
    )

if settings.openrouter_model != "z-ai/glm-5.2:free":
    raise SystemExit(
        "[FAIL] OpenRouter primary model mismatch"
    )

statuses = provider_status(settings)

if not isinstance(statuses, list):
    raise SystemExit(
        "[FAIL] provider_status() did not return a list"
    )

names = {
    item.get("provider")
    for item in statuses
    if isinstance(item, dict)
}

if names != expected:
    raise SystemExit(
        f"[FAIL] Provider status mismatch: {names!r}"
    )

print("[PASS] OpenRouter = z-ai/glm-5.2:free")
print("[PASS] Provider registry = openrouter/groq/cerebras")
print("[PASS] Provider status contract")
PY

echo
echo "============================================================"
echo "OPENROUTER MODEL CORRECTION COMPLETE"
echo "============================================================"
echo "Primary model: z-ai/glm-5.2:free"
echo "Base URL:      https://openrouter.ai/api/v1"
echo "Providers:     openrouter, groq, cerebras"
echo "Backup:        $BACKUP"
echo "============================================================"
