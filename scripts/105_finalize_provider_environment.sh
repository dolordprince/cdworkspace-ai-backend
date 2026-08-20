#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="/root/cdesktop"
BACKEND="$ROOT/backend"
STAMP="$(date +%Y%m%d%H%M%S)"
BACKUP="$ROOT/.provider-env-final-backup-$STAMP"

echo "============================================================"
echo "CDESTKTOP — PROVIDER ENVIRONMENT FINALIZATION"
echo "============================================================"

cd "$ROOT"

echo "[1/7] Creating environment-template backup"

mkdir -p "$BACKUP"

if [ -f "$BACKEND/.env.example" ]; then
    cp -a "$BACKEND/.env.example" "$BACKUP/.env.example"
fi

echo "[PASS] Backup: $BACKUP"

echo "[2/7] Updating backend environment template"

if [ -f "$BACKEND/.env.example" ]; then
    sed -i \
        's|^OPENROUTER_MODEL=.*|OPENROUTER_MODEL=z-ai/glm-5.2:free|' \
        "$BACKEND/.env.example"

    sed -i \
        's|^OPENROUTER_FALLBACK_MODEL=.*|OPENROUTER_FALLBACK_MODEL=openrouter/free|' \
        "$BACKEND/.env.example"
else
    cat > "$BACKEND/.env.example" <<'ENV'
APP_NAME=Traveler Dev
ENVIRONMENT=production

OPENROUTER_API_KEY=
OPENROUTER_MODEL=z-ai/glm-5.2:free
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_FALLBACK_MODEL=openrouter/free

GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_BASE_URL=https://api.groq.com/openai/v1

CEREBRAS_API_KEY=
CEREBRAS_MODEL=zai-glm-4.7
CEREBRAS_BASE_URL=https://api.cerebras.ai/v1

REQUEST_TIMEOUT=180
MAX_REQUEST_BODY_BYTES=15000000
ENV
fi

echo "[PASS] Environment template finalized"

echo "[3/7] Verifying active environment"

if grep -q '^OPENROUTER_MODEL=' "$BACKEND/.env"; then
    echo "[FAIL] Active .env still contains OPENROUTER_MODEL"
    exit 1
fi

echo "[PASS] Active .env does not override primary model"

echo "[4/7] Verifying configuration"

cd "$BACKEND"

.venv/bin/python - <<'PY'
from app.config import Settings

s = Settings()

assert s.openrouter_model == "z-ai/glm-5.2:free"
assert s.openrouter_base_url == "https://openrouter.ai/api/v1"

assert s.groq_model == "llama-3.3-70b-versatile"
assert s.groq_base_url == "https://api.groq.com/openai/v1"

assert s.cerebras_model == "zai-glm-4.7"
assert s.cerebras_base_url == "https://api.cerebras.ai/v1"

print("[PASS] All provider runtime configuration values are correct")
PY

echo "[5/7] Verifying provider construction"

.venv/bin/python - <<'PY'
from app.config import Settings
from app.providers.registry import build_providers

s = Settings()
providers = build_providers(s)

required = {"openrouter", "groq", "cerebras"}

assert set(providers) == required

assert providers["openrouter"].model == "z-ai/glm-5.2:free"
assert providers["groq"].model == "llama-3.3-70b-versatile"
assert providers["cerebras"].model == "zai-glm-4.7"

print("[PASS] All three providers construct correctly")
PY

echo "[6/7] Compiling complete backend"

.venv/bin/python -m compileall -q app

echo "[PASS] Backend compilation succeeded"

echo "[7/7] Final environment audit"

echo ""
echo "ACTIVE PROVIDER CONTRACT"
echo "------------------------"
echo "OpenRouter : z-ai/glm-5.2:free"
echo "Fallback   : openrouter/free"
echo "Groq       : llama-3.3-70b-versatile"
echo "Cerebras   : zai-glm-4.7"
echo ""

echo "Environment template:"
grep -nE \
    '^(OPENROUTER_MODEL|OPENROUTER_FALLBACK_MODEL|GROQ_MODEL|CEREBRAS_MODEL)=' \
    "$BACKEND/.env.example" || true

echo ""
echo "[PASS] Provider environment finalized"

echo "============================================================"
echo "PROVIDER ENVIRONMENT FINALIZATION COMPLETE"
echo "============================================================"
