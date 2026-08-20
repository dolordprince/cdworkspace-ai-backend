#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="/root/cdesktop"
BACKEND="$ROOT/backend"
PYTHON="$BACKEND/.venv/bin/python"

RENDER_URL="${RENDER_URL:-https://cdworkspace-ai-backend.onrender.com}"
RENDER_MODEL="anthropic/claude-sonnet-4.5"

fail() {
    echo "[FAIL] $*"
    exit 1
}

echo "============================================================"
echo "CDESTKTOP — RENDER DEPLOY + REAL PRODUCTION RELEASE"
echo "============================================================"

cd "$ROOT"

echo "[1/12] Repository"

git rev-parse --is-inside-work-tree >/dev/null \
    || fail "Not a Git repository"

BRANCH="$(git branch --show-current)"

echo "[INFO] Branch: $BRANCH"

[[ "$BRANCH" == "main" ]] \
    || fail "Expected main branch, found: $BRANCH"

echo "[PASS] Git repository and main branch"

echo "[2/12] Checking secrets are not tracked"

if git ls-files | grep -E '(^|/)(\.env|\.env\.production|backend/\.env)$' >/dev/null 2>&1; then
    fail "A runtime environment file is tracked by Git"
fi

echo "[PASS] Runtime secrets are not tracked"

echo "[3/12] Backend compilation"

"$PYTHON" -m compileall -q "$BACKEND/app"

echo "[PASS] Backend compilation"

echo "[4/12] Local production contract"

(
    cd "$BACKEND"

    env -u OPENROUTER_MODEL -u OPENROUTER_BASE_URL \
        "$PYTHON" - <<'PY'
from app.config import Settings
from app.providers.registry import build_providers

settings = Settings()

assert settings.openrouter_model == "z-ai/glm-5.2:free"
assert settings.openrouter_base_url == "https://openrouter.ai/api/v1"
assert settings.groq_model == "llama-3.3-70b-versatile"
assert settings.cerebras_model == "zai-glm-4.7"

providers = build_providers(settings)

assert providers["openrouter"].model == "z-ai/glm-5.2:free"
assert providers["groq"].model == "llama-3.3-70b-versatile"
assert providers["cerebras"].model == "zai-glm-4.7"

print("[PASS] Local provider contract")
PY
)

echo "[5/12] Render model override contract"

(
    cd "$BACKEND"

    env \
        OPENROUTER_MODEL="$RENDER_MODEL" \
        OPENROUTER_BASE_URL="https://openrouter.ai/api/v1" \
        "$PYTHON" - <<'PY'
from app.config import Settings

settings = Settings()

assert settings.openrouter_model == "anthropic/claude-sonnet-4.5"
assert settings.openrouter_base_url == "https://openrouter.ai/api/v1"

print("[PASS] Render model override")
print(f"[INFO] Effective model: {settings.openrouter_model}")
PY
)

echo "[6/12] Git diff"

git status --short

echo "[INFO] Current commit:"
git log -1 --oneline

echo "[7/12] Committing release changes"

if [[ -n "$(git status --porcelain)" ]]; then
    git add \
        scripts/100_finalize_provider_architecture.sh \
        scripts/101_fix_openrouter_model.sh \
        scripts/102_repair_backend_config.sh \
        scripts/104_fix_runtime_openrouter_model.sh \
        scripts/105_finalize_provider_environment.sh \
        scripts/106_repair_provider_environment_contract.sh \
        scripts/107_test_production_provider_workflow.sh \
        scripts/108_diagnose_openrouter_credentials.sh \
        scripts/109_align_openrouter_runtime_contract.sh \
        scripts/110_fix_runtime_contract_test.sh \
        scripts/111_e2e_provider_release_gate.sh \
        scripts/113_fix_provider_release_gate_registry.sh \
        scripts/114_trace_openrouter_model_source.sh \
        scripts/115_clean_shell_and_run_provider_release_gate.sh \
        scripts/116_test_render_production.sh \
        scripts/117_deploy_and_test_render_release.sh \
        2>/dev/null || true

    git add -- \
        backend/app/config.py \
        backend/app/providers/registry.py \
        backend/app/providers/ 2>/dev/null || true

    git status --short

    git commit -m "Finalize production OpenRouter provider architecture"
else
    echo "[INFO] No uncommitted changes"
fi

echo "[8/12] Pushing main"

git push origin main

echo "[PASS] main pushed"
echo "[INFO] Render should now deploy the new commit if auto-deploy is enabled."

echo "[9/12] Waiting for Render deployment"

READY=0

for _ in $(seq 1 60); do
    if curl -fsS \
        --connect-timeout 10 \
        --max-time 30 \
        "$RENDER_URL/health" \
        >/tmp/cdesktop-render-health.json 2>/dev/null; then

        if grep -q '"status":"ok"' /tmp/cdesktop-render-health.json; then
            READY=1
            break
        fi
    fi

    sleep 5
done

[[ "$READY" == "1" ]] \
    || fail "Render did not become healthy"

echo "[PASS] Render production server healthy"

echo "[10/12] Production OpenAPI"

curl -fsS \
    --connect-timeout 20 \
    --max-time 60 \
    "$RENDER_URL/openapi.json" \
    >/tmp/cdesktop-render-openapi.json

grep -q '"/api/ai/chat"' /tmp/cdesktop-render-openapi.json \
    || fail "Production /api/ai/chat route missing"

echo "[PASS] Production /api/ai/chat published"

echo "[11/12] REAL Render AI contract"

RESPONSE="/tmp/cdesktop-render-ai.json"

STATUS="$(
    curl -sS \
        --connect-timeout 20 \
        --max-time 180 \
        -o "$RESPONSE" \
        -w '%{http_code}' \
        -X POST \
        "$RENDER_URL/api/ai/chat" \
        -H 'Content-Type: application/json' \
        -d '{
            "message": "Reply with exactly: TRAVELER DEV PRODUCTION PASS"
        }'
)"

echo "[INFO] HTTP status: $STATUS"
cat "$RESPONSE"
echo

[[ "$STATUS" == "200" ]] \
    || fail "Render /api/ai/chat returned HTTP $STATUS"

grep -qi 'TRAVELER DEV PRODUCTION PASS' "$RESPONSE" \
    || fail "Expected production response not found"

echo "[PASS] REAL Render AI inference succeeded"

echo "[12/12] Final release verification"

echo "============================================================"
echo "RENDER PRODUCTION RELEASE PASSED"
echo "============================================================"
echo "URL        : $RENDER_URL"
echo "AI route   : /api/ai/chat"
echo "Render model:"
echo "  $RENDER_MODEL"
echo
echo "Local default:"
echo "  z-ai/glm-5.2:free"
echo
echo "Fallback:"
echo "  openrouter/free"
echo
echo "Providers:"
echo "  openrouter"
echo "  groq"
echo "  cerebras"
echo "============================================================"
