#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="/root/cdesktop"
BACKEND="$ROOT/backend"
PYTHON="$BACKEND/.venv/bin/python"
EXPECTED_LOCAL="z-ai/glm-5.2:free"
EXPECTED_RENDER="anthropic/claude-sonnet-4.5"
EXPECTED_URL="https://openrouter.ai/api/v1"
GATE="$ROOT/scripts/111_e2e_provider_release_gate.sh"

fail() {
    echo "[FAIL] $*"
    exit 1
}

echo "============================================================"
echo "CDESTKTOP — CLEAN RUNTIME + PROVIDER RELEASE GATE"
echo "============================================================"

echo "[1/10] Verifying project"
cd "$ROOT"

[[ -d "$BACKEND" ]] || fail "Backend directory missing: $BACKEND"
[[ -x "$PYTHON" ]] || fail "Backend Python missing: $PYTHON"
[[ -x "$GATE" ]] || fail "Release gate missing: $GATE"

echo "[PASS] Backend: $BACKEND"
echo "[PASS] Python: $PYTHON"

echo "[2/10] Capturing current shell provider overrides"

echo "OPENROUTER_MODEL=${OPENROUTER_MODEL-<unset>}"
echo "OPENROUTER_BASE_URL=${OPENROUTER_BASE_URL-<unset>}"

echo "[3/10] Removing stale shell overrides"

unset OPENROUTER_MODEL
unset OPENROUTER_BASE_URL

if [[ -n "${OPENROUTER_MODEL-}" ]]; then
    fail "OPENROUTER_MODEL remains exported"
fi

if [[ -n "${OPENROUTER_BASE_URL-}" ]]; then
    fail "OPENROUTER_BASE_URL remains exported"
fi

echo "[PASS] Shell OPENROUTER_MODEL cleared"
echo "[PASS] Shell OPENROUTER_BASE_URL cleared"

echo "[4/10] Verifying local Settings without shell override"

(
    cd "$BACKEND"

    env -u OPENROUTER_MODEL -u OPENROUTER_BASE_URL \
        "$PYTHON" - <<'PY'
from app.config import Settings

settings = Settings()

expected_model = "z-ai/glm-5.2:free"
expected_url = "https://openrouter.ai/api/v1"
expected_groq = "llama-3.3-70b-versatile"
expected_cerebras = "zai-glm-4.7"

assert settings.openrouter_model == expected_model, (
    f"Unexpected OpenRouter model: {settings.openrouter_model!r}"
)

assert settings.openrouter_base_url == expected_url, (
    f"Unexpected OpenRouter URL: {settings.openrouter_base_url!r}"
)

assert settings.groq_model == expected_groq, (
    f"Unexpected Groq model: {settings.groq_model!r}"
)

assert settings.cerebras_model == expected_cerebras, (
    f"Unexpected Cerebras model: {settings.cerebras_model!r}"
)

print(f"[PASS] Local OpenRouter = {settings.openrouter_model}")
print(f"[PASS] Local Groq       = {settings.groq_model}")
print(f"[PASS] Local Cerebras   = {settings.cerebras_model}")
print(f"[PASS] OpenRouter URL   = {settings.openrouter_base_url}")
PY
)

echo "[5/10] Verifying Render override independently"

(
    cd "$BACKEND"

    env \
        OPENROUTER_MODEL="$EXPECTED_RENDER" \
        OPENROUTER_BASE_URL="$EXPECTED_URL" \
        "$PYTHON" - <<'PY'
from app.config import Settings

settings = Settings()

assert settings.openrouter_model == "anthropic/claude-sonnet-4.5", (
    f"Render override failed: {settings.openrouter_model!r}"
)

assert settings.openrouter_base_url == "https://openrouter.ai/api/v1", (
    f"Render URL override failed: {settings.openrouter_base_url!r}"
)

print("[PASS] Render OPENROUTER_MODEL override")
print(f"[PASS] Effective Render model = {settings.openrouter_model}")
print(f"[PASS] Render OpenRouter URL = {settings.openrouter_base_url}")
PY
)

echo "[6/10] Verifying provider registry"

(
    cd "$BACKEND"

    env -u OPENROUTER_MODEL -u OPENROUTER_BASE_URL \
        "$PYTHON" - <<'PY'
from app.config import Settings
from app.providers.registry import build_providers

settings = Settings()
providers = build_providers(settings)

required = {"openrouter", "groq", "cerebras"}

assert required.issubset(providers), (
    f"Missing providers: {required - set(providers)}"
)

assert providers["openrouter"].model == "z-ai/glm-5.2:free", (
    f"OpenRouter registry model mismatch: "
    f"{providers['openrouter'].model!r}"
)

assert providers["openrouter"].base_url == "https://openrouter.ai/api/v1"

assert providers["groq"].model == "llama-3.3-70b-versatile"
assert providers["cerebras"].model == "zai-glm-4.7"

for name in sorted(providers):
    provider = providers[name]
    print(
        f"[PASS] {name}: "
        f"model={provider.model} "
        f"endpoint={provider.endpoint}"
    )
PY
)

echo "[7/10] Compiling complete backend"

(
    cd "$BACKEND"
    "$PYTHON" -m compileall -q app
)

echo "[PASS] Complete backend compilation"

echo "[8/10] Verifying FastAPI application"

(
    cd "$BACKEND"

    env -u OPENROUTER_MODEL -u OPENROUTER_BASE_URL \
        "$PYTHON" - <<'PY'
from app.main import app

assert app.title == "Traveler Dev API"

paths = {
    route.path
    for route in app.routes
    if hasattr(route, "path")
}

assert "/api/ai/chat" in paths, "/api/ai/chat route missing"

print(f"[PASS] Application: {app.title}")
print("[PASS] /api/ai/chat route discovered")
print(f"[INFO] Routes discovered: {len(paths)}")
PY
)

echo "[9/10] Running authoritative end-to-end release gate"

cd "$ROOT"

env \
    -u OPENROUTER_MODEL \
    -u OPENROUTER_BASE_URL \
    "$GATE"

echo "[10/10] Final shell verification"

if env | grep -q '^OPENROUTER_MODEL='; then
    fail "OPENROUTER_MODEL is still exported"
fi

if env | grep -q '^OPENROUTER_BASE_URL='; then
    fail "OPENROUTER_BASE_URL is still exported"
fi

echo "[PASS] No stale shell OpenRouter model override"
echo
echo "============================================================"
echo "PROVIDER RELEASE GATE COMPLETED"
echo "============================================================"
echo "Local OpenRouter : $EXPECTED_LOCAL"
echo "Render OpenRouter: $EXPECTED_RENDER"
echo "OpenRouter URL   : $EXPECTED_URL"
echo "Groq             : llama-3.3-70b-versatile"
echo "Cerebras         : zai-glm-4.7"
echo "============================================================"
