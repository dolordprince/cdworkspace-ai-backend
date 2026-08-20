#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="/root/cdesktop"
BACKEND="$ROOT/backend"
STAMP="$(date +%Y%m%d%H%M%S)"
BACKUP="$ROOT/.runtime-openrouter-backup-$STAMP"

echo "============================================================"
echo "CDESTKTOP — OPENROUTER RUNTIME MODEL FINALIZATION"
echo "============================================================"

mkdir -p "$BACKUP"

echo "[1/8] Locating environment files"

ENV_FILES=()

for file in \
    "$BACKEND/.env" \
    "$ROOT/.env" \
    "$BACKEND/.env.production" \
    "$ROOT/.env.production"
do
    if [ -f "$file" ]; then
        ENV_FILES+=("$file")
        echo "[FOUND] $file"
    fi
done

echo "[2/8] Backing up environment files"

for file in "${ENV_FILES[@]}"; do
    cp -a "$file" "$BACKUP/$(basename "$file").bak"
done

echo "[PASS] Environment backup: $BACKUP"

echo "[3/8] Inspecting OpenRouter runtime overrides"

for file in "${ENV_FILES[@]}"; do
    echo "--- $file ---"
    grep -nE '^[[:space:]]*(export[[:space:]]+)?OPENROUTER_(MODEL|FALLBACK_MODEL|FALLBACK_MODELS)[[:space:]]*=' "$file" || true
done

echo "[4/8] Removing conflicting OPENROUTER_MODEL assignments"

for file in "${ENV_FILES[@]}"; do
    tmp="${file}.tmp.$$"

    awk '
        /^[[:space:]]*(export[[:space:]]+)?OPENROUTER_MODEL[[:space:]]*=/ {
            next
        }
        { print }
    ' "$file" > "$tmp"

    mv "$tmp" "$file"
done

echo "[PASS] OPENROUTER_MODEL runtime override removed"

echo "[5/8] Verifying fallback configuration"

for file in "${ENV_FILES[@]}"; do
    echo "--- $file ---"

    grep -nE '^[[:space:]]*(export[[:space:]]+)?OPENROUTER_(FALLBACK_MODEL|FALLBACK_MODELS)[[:space:]]*=' "$file" || true
done

echo "[6/8] Validating actual Settings runtime"

cd "$BACKEND"

unset OPENROUTER_MODEL

.venv/bin/python - <<'PY'
from app.config import Settings

settings = Settings()

expected = "z-ai/glm-5.2:free"

print("Runtime OpenRouter model:", settings.openrouter_model)
print("Runtime OpenRouter URL  :", settings.openrouter_base_url)

assert settings.openrouter_model == expected, (
    f"OpenRouter runtime model is {settings.openrouter_model!r}; "
    f"expected {expected!r}"
)

assert settings.openrouter_base_url == "https://openrouter.ai/api/v1"

print("[PASS] Runtime OpenRouter model = z-ai/glm-5.2:free")
print("[PASS] Runtime OpenRouter base URL is correct")
PY

echo "[7/8] Validating provider registry runtime"

.venv/bin/python - <<'PY'
from app.config import Settings
from app.providers.registry import build_providers

settings = Settings()
providers = build_providers(settings)

assert "openrouter" in providers
assert "groq" in providers
assert "cerebras" in providers

assert providers["openrouter"].model == "z-ai/glm-5.2:free"
assert providers["openrouter"].base_url == "https://openrouter.ai/api/v1"

print("[PASS] OpenRouter provider model = z-ai/glm-5.2:free")
print("[PASS] Groq provider registered")
print("[PASS] Cerebras provider registered")
PY

echo "[8/8] Final source/runtime audit"

.venv/bin/python - <<'PY'
import ast
from pathlib import Path

path = Path("app/config.py")
tree = ast.parse(path.read_text())

settings_class = next(
    node for node in tree.body
    if isinstance(node, ast.ClassDef) and node.name == "Settings"
)

source_model = None

for node in settings_class.body:
    if (
        isinstance(node, ast.AnnAssign)
        and isinstance(node.target, ast.Name)
        and node.target.id == "openrouter_model"
        and node.value is not None
    ):
        source_model = ast.literal_eval(node.value)

assert source_model == "z-ai/glm-5.2:free"

print("[PASS] Source model = z-ai/glm-5.2:free")
print("[PASS] Runtime model = z-ai/glm-5.2:free")
print("[PASS] Configuration contract is consistent")
PY

echo ""
echo "============================================================"
echo "OPENROUTER RUNTIME MODEL FINALIZATION COMPLETE"
echo "============================================================"
echo "Primary model: z-ai/glm-5.2:free"
echo "Base URL:      https://openrouter.ai/api/v1"
echo "Providers:     openrouter, groq, cerebras"
echo "Backup:        $BACKUP"
echo "============================================================"
