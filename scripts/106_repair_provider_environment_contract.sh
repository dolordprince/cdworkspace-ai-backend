#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="/root/cdesktop"
BACKEND="$ROOT/backend"
PY="$BACKEND/.venv/bin/python"
CONFIG="$BACKEND/app/config.py"
REGISTRY="$BACKEND/app/providers/registry.py"
ENV="$BACKEND/.env"
ENV_EXAMPLE="$BACKEND/.env.example"

PRIMARY="z-ai/glm-5.2:free"
OPENROUTER_URL="https://openrouter.ai/api/v1"
FALLBACK="openrouter/free"

STAMP="$(date +%Y%m%d%H%M%S)"
BACKUP="$ROOT/.provider-env-contract-backup-$STAMP"

echo "============================================================"
echo "CDESTKTOP — PROVIDER ENVIRONMENT CONTRACT REPAIR"
echo "============================================================"

if [ ! -x "$PY" ]; then
    echo "[FAIL] Backend Python environment missing: $PY"
    exit 1
fi

if [ ! -f "$CONFIG" ]; then
    echo "[FAIL] Missing $CONFIG"
    exit 1
fi

mkdir -p "$BACKUP"

echo "[1/10] Creating complete provider configuration backup"

cp -a "$CONFIG" "$BACKUP/config.py"
cp -a "$REGISTRY" "$BACKUP/registry.py"

[ -f "$ENV" ] && cp -a "$ENV" "$BACKUP/.env"
[ -f "$ENV_EXAMPLE" ] && cp -a "$ENV_EXAMPLE" "$BACKUP/.env.example"

echo "[PASS] Backup: $BACKUP"

echo "[2/10] Validating Python source before modification"

"$PY" -m py_compile "$CONFIG" "$REGISTRY"
echo "[PASS] Configuration and provider registry compile"

echo "[3/10] Normalizing backend runtime environment"

"$PY" - "$ENV" "$PRIMARY" "$OPENROUTER_URL" "$FALLBACK" <<'PY'
from pathlib import Path
import sys

env_path = Path(sys.argv[1])
primary = sys.argv[2]
url = sys.argv[3]
fallback = sys.argv[4]

lines = env_path.read_text(encoding="utf-8").splitlines() if env_path.exists() else []

managed = {
    "OPENROUTER_MODEL",
    "OPENROUTER_BASE_URL",
    "OPENROUTER_FALLBACK_MODEL",
    "OPENROUTER_FALLBACK_MODELS",
}

out = []

for line in lines:
    stripped = line.strip()

    if not stripped or stripped.startswith("#") or "=" not in line:
        out.append(line)
        continue

    key = line.split("=", 1)[0].strip()

    if key == "OPENROUTER_MODEL":
        continue

    if key == "OPENROUTER_BASE_URL":
        continue

    if key == "OPENROUTER_FALLBACK_MODEL":
        continue

    if key == "OPENROUTER_FALLBACK_MODELS":
        continue

    out.append(line)

out.extend([
    "",
    "# OpenRouter primary model is controlled by app.config.Settings.",
    "# Do not set OPENROUTER_MODEL here.",
    f"OPENROUTER_FALLBACK_MODELS={fallback}",
    f"OPENROUTER_FALLBACK_MODEL={fallback}",
])

env_path.write_text("\n".join(out) + "\n", encoding="utf-8")
PY

echo "[PASS] backend/.env normalized"

echo "[4/10] Normalizing environment template"

if [ -f "$ENV_EXAMPLE" ]; then
    "$PY" - "$ENV_EXAMPLE" "$PRIMARY" "$OPENROUTER_URL" "$FALLBACK" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
primary = sys.argv[2]
url = sys.argv[3]
fallback = sys.argv[4]

lines = path.read_text(encoding="utf-8").splitlines()

out = []

for line in lines:
    if "=" not in line:
        out.append(line)
        continue

    key = line.split("=", 1)[0].strip()

    if key == "OPENROUTER_MODEL":
        out.append(f"# OPENROUTER_MODEL={primary}")
    elif key == "OPENROUTER_BASE_URL":
        out.append(f"OPENROUTER_BASE_URL={url}")
    elif key == "OPENROUTER_FALLBACK_MODEL":
        out.append(f"OPENROUTER_FALLBACK_MODEL={fallback}")
    elif key == "OPENROUTER_FALLBACK_MODELS":
        out.append(f"OPENROUTER_FALLBACK_MODELS={fallback}")
    else:
        out.append(line)

path.write_text("\n".join(out) + "\n", encoding="utf-8")
PY

    echo "[PASS] backend/.env.example normalized"
else
    echo "[INFO] backend/.env.example does not exist"
fi

echo "[5/10] Verifying source defaults"

"$PY" - "$CONFIG" "$PRIMARY" "$OPENROUTER_URL" <<'PY'
from pathlib import Path
import sys
import ast

path = Path(sys.argv[1])
expected_model = sys.argv[2]
expected_url = sys.argv[3]

tree = ast.parse(path.read_text(encoding="utf-8"))

values = {}

for node in ast.walk(tree):
    if not isinstance(node, ast.AnnAssign):
        continue

    if not isinstance(node.target, ast.Name):
        continue

    if node.target.id not in {
        "openrouter_model",
        "openrouter_base_url",
    }:
        continue

    if isinstance(node.value, ast.Constant) and isinstance(node.value.value, str):
        values[node.target.id] = node.value.value

assert values.get("openrouter_model") == expected_model, (
    f"Unexpected source OpenRouter model: {values.get('openrouter_model')!r}"
)

assert values.get("openrouter_base_url") == expected_url, (
    f"Unexpected source OpenRouter URL: {values.get('openrouter_base_url')!r}"
)

print(f"[PASS] Source model = {expected_model}")
print(f"[PASS] Source URL   = {expected_url}")
PY

echo "[6/10] Checking active environment files for conflicting model overrides"

CONFLICTS=0

while IFS= read -r file; do
    [ -f "$file" ] || continue

    if grep -nE '^[[:space:]]*OPENROUTER_MODEL[[:space:]]*=' "$file" >/dev/null 2>&1; then
        echo "[FAIL] Conflicting OPENROUTER_MODEL in $file"
        grep -nE '^[[:space:]]*OPENROUTER_MODEL[[:space:]]=' "$file" || true
        CONFLICTS=1
    fi

    if grep -nE 'qwen/qwen3-coder:free' "$file" >/dev/null 2>&1; then
        echo "[FAIL] Stale qwen model found in active file: $file"
        grep -nE 'qwen/qwen3-coder:free' "$file" || true
        CONFLICTS=1
    fi
done < <(
    printf '%s\n' \
        "$ENV" \
        "$ENV_EXAMPLE" \
        "$ROOT/.env" \
        "$ROOT/.env.production" \
        "$BACKEND/.env.production"
)

if [ "$CONFLICTS" -ne 0 ]; then
    echo "[FAIL] Active environment still contains conflicting values"
    exit 1
fi

echo "[PASS] No conflicting active OpenRouter model assignments"

echo "[7/10] Loading sanitized production Settings"

env -u OPENROUTER_MODEL \
    -u OPENROUTER_BASE_URL \
    "$PY" - "$BACKEND" "$PRIMARY" "$OPENROUTER_URL" "$FALLBACK" <<'PY'
import os
import sys

backend = sys.argv[1]
expected_model = sys.argv[2]
expected_url = sys.argv[3]
expected_fallback = sys.argv[4]

os.chdir(backend)

from app.config import Settings

settings = Settings()

print(f"Runtime OpenRouter model : {settings.openrouter_model}")
print(f"Runtime OpenRouter URL   : {settings.openrouter_base_url}")
print(f"Runtime Groq model       : {settings.groq_model}")
print(f"Runtime Cerebras model   : {settings.cerebras_model}")

assert settings.openrouter_model == expected_model, (
    f"Unexpected runtime OpenRouter model: {settings.openrouter_model!r}"
)

assert settings.openrouter_base_url == expected_url, (
    f"Unexpected runtime OpenRouter URL: {settings.openrouter_base_url!r}"
)

assert settings.openrouter_model != "qwen/qwen3-coder:free"

print(f"[PASS] Runtime model = {expected_model}")
print(f"[PASS] Runtime URL   = {expected_url}")
PY

echo "[8/10] Validating provider registry"

env -u OPENROUTER_MODEL \
    -u OPENROUTER_BASE_URL \
    "$PY" - "$BACKEND" "$PRIMARY" <<'PY'
import os
import sys

backend = sys.argv[1]
expected_model = sys.argv[2]

os.chdir(backend)

from app.config import Settings
from app.providers.registry import build_providers, provider_status

settings = Settings()
providers = build_providers(settings)

assert "openrouter" in providers
assert "groq" in providers
assert "cerebras" in providers

assert providers["openrouter"].model == expected_model

print("[PASS] OpenRouter provider registered")
print(f"[PASS] OpenRouter model = {providers['openrouter'].model}")
print("[PASS] Groq provider registered")
print("[PASS] Cerebras provider registered")
PY

echo "[9/10] Checking shell runtime override"

if [ -n "${OPENROUTER_MODEL:-}" ]; then
    echo "[WARN] Current shell exports OPENROUTER_MODEL"
    echo "[WARN] Current shell value: ${OPENROUTER_MODEL}"
    echo
    echo "[ACTION] This script cannot unset a variable in the parent shell."
    echo "[ACTION] Run:"
    echo "        unset OPENROUTER_MODEL"
else
    echo "[PASS] Current shell does not export OPENROUTER_MODEL"
fi

if [ -n "${OPENROUTER_BASE_URL:-}" ]; then
    echo "[WARN] Current shell exports OPENROUTER_BASE_URL"
    echo "[ACTION] Run:"
    echo "        unset OPENROUTER_BASE_URL"
else
    echo "[PASS] Current shell does not export OPENROUTER_BASE_URL"
fi

echo "[10/10] Final production architecture audit"

"$PY" - "$BACKEND" "$PRIMARY" "$OPENROUTER_URL" <<'PY'
import os
import sys

backend = sys.argv[1]
expected_model = sys.argv[2]
expected_url = sys.argv[3]

os.chdir(backend)

from app.config import Settings
from app.providers.registry import build_providers

settings = Settings()
providers = build_providers(settings)

assert settings.openrouter_model == expected_model
assert settings.openrouter_base_url == expected_url

assert providers["openrouter"].model == expected_model
assert providers["openrouter"].base_url == expected_url

assert providers["groq"].model
assert providers["cerebras"].model

print("")
print("APPLICATION       : Traveler Dev")
print("ENVIRONMENT        : production")
print(f"OPENROUTER MODEL   : {settings.openrouter_model}")
print(f"OPENROUTER URL     : {settings.openrouter_base_url}")
print(f"GROQ MODEL         : {settings.groq_model}")
print(f"GROQ URL           : {settings.groq_base_url}")
print(f"CEREBRAS MODEL     : {settings.cerebras_model}")
print(f"CEREBRAS URL       : {settings.cerebras_base_url}")
print("PROVIDERS          : cerebras, groq, openrouter")
print("")
print("[PASS] Provider configuration contract is consistent")
PY

echo
echo "============================================================"
echo "PROVIDER ENVIRONMENT CONTRACT REPAIR COMPLETE"
echo "============================================================"
echo "Primary model : $PRIMARY"
echo "Base URL      : $OPENROUTER_URL"
echo "Fallback      : $FALLBACK"
echo "Backup        : $BACKUP"
echo "============================================================"
