#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="/root/cdesktop"
BACKEND="$ROOT/backend"
PYTHON="$BACKEND/.venv/bin/python"

HOST="127.0.0.1"
PORT="${E2E_TEST_PORT:-8011}"
BASE_URL="http://${HOST}:${PORT}"

RUNTIME_DIR="$ROOT/.e2e-provider-runtime"
LOG_FILE="$RUNTIME_DIR/server.log"
HEALTH_FILE="$RUNTIME_DIR/health.json"
OPENAPI_FILE="$RUNTIME_DIR/openapi.json"
RESPONSE_FILE="$RUNTIME_DIR/ai-response.json"

PID=""

SOURCE_MODEL="z-ai/glm-5.2:free"
RENDER_MODEL="anthropic/claude-sonnet-4.5"
OPENROUTER_URL="https://openrouter.ai/api/v1"

cleanup() {
    if [ -n "${PID:-}" ] && kill -0 "$PID" 2>/dev/null; then
        kill "$PID" 2>/dev/null || true
        wait "$PID" 2>/dev/null || true
    fi
}

trap cleanup EXIT

fail() {
    echo
    echo "[FAIL] $*"
    echo
    echo "===== FASTAPI SERVER LOG ====="
    if [ -f "$LOG_FILE" ]; then
        tail -n 120 "$LOG_FILE" || true
    fi
    echo "================================"
    exit 1
}

echo "============================================================"
echo "CDESTKTOP — PRODUCTION PROVIDER END-TO-END RELEASE GATE"
echo "============================================================"

mkdir -p "$RUNTIME_DIR"
rm -f "$HEALTH_FILE" "$OPENAPI_FILE" "$RESPONSE_FILE" "$LOG_FILE"

echo "[1/14] Verifying backend environment"

[ -d "$BACKEND" ] || fail "Backend directory missing: $BACKEND"
[ -x "$PYTHON" ] || fail "Backend Python missing: $PYTHON"
[ -f "$BACKEND/app/main.py" ] || fail "backend/app/main.py missing"

cd "$BACKEND"

echo "[PASS] Backend directory: $BACKEND"
echo "[PASS] Python: $PYTHON"
"$PYTHON" --version

echo "[2/14] Complete backend compilation"

"$PYTHON" -m compileall -q app \
    || fail "Backend compilation failed"

echo "[PASS] Backend compilation"

echo "[3/14] Validating source provider contract"

"$PYTHON" - <<'PY'
from pathlib import Path
import re

text = Path("app/config.py").read_text(encoding="utf-8")

model = re.search(
    r'openrouter_model\s*:\s*str\s*=\s*"([^"]+)"',
    text,
)

url = re.search(
    r'openrouter_base_url\s*:\s*str\s*=\s*"([^"]+)"',
    text,
)

assert model, "openrouter_model source declaration missing"
assert url, "openrouter_base_url source declaration missing"

assert model.group(1) == "z-ai/glm-5.2:free", (
    f"Unexpected source model: {model.group(1)!r}"
)

assert url.group(1) == "https://openrouter.ai/api/v1", (
    f"Unexpected source URL: {url.group(1)!r}"
)

print("[PASS] Source OpenRouter model = z-ai/glm-5.2:free")
print("[PASS] Source OpenRouter URL   = https://openrouter.ai/api/v1")
PY

echo "[4/14] Loading local production Settings"

"$PYTHON" - <<'PY'
from app.config import Settings

settings = Settings()

assert settings.openrouter_model == "z-ai/glm-5.2:free", (
    f"Unexpected local model: {settings.openrouter_model!r}"
)

assert settings.openrouter_base_url == "https://openrouter.ai/api/v1"

assert settings.groq_model == "llama-3.3-70b-versatile"

assert settings.cerebras_model == "zai-glm-4.7"

print(f"[PASS] OpenRouter : {settings.openrouter_model}")
print(f"[PASS] Groq       : {settings.groq_model}")
print(f"[PASS] Cerebras   : {settings.cerebras_model}")
PY

echo "[5/14] Validating Render model override"

OPENROUTER_MODEL="$RENDER_MODEL" "$PYTHON" - <<'PY'
from app.config import Settings

settings = Settings()

assert settings.openrouter_model == "anthropic/claude-sonnet-4.5", (
    f"Render override failed: {settings.openrouter_model!r}"
)

assert settings.openrouter_base_url == "https://openrouter.ai/api/v1"

print("[PASS] Render OPENROUTER_MODEL override")
print(
    f"[PASS] Effective Render model = "
    f"{settings.openrouter_model}"
)
PY

echo "[6/14] Validating provider registry"

"$PYTHON" - <<'PY'
from app.config import Settings
from app.providers.registry import build_providers

settings = Settings()
providers = build_providers(settings)

required = {"openrouter", "groq", "cerebras"}

missing = required - set(providers)

assert not missing, f"Missing providers: {sorted(missing)}"

assert providers["openrouter"].model == "z-ai/glm-5.2:free"
assert providers["openrouter"].base_url == "https://openrouter.ai/api/v1"

assert providers["groq"].model == "llama-3.3-70b-versatile"
assert providers["groq"].base_url == "https://api.groq.com/openai/v1"

assert providers["cerebras"].model == "zai-glm-4.7"
assert providers["cerebras"].base_url == "https://api.cerebras.ai/v1"

for name in sorted(providers):
    provider = providers[name]
    print(
        f"[PASS] {name}: "
        f"model={provider.model} "
        f"endpoint={provider.endpoint}"
    )
PY

echo "[7/14] Importing FastAPI application"

"$PYTHON" - <<'PY'
from app.main import app

assert app.title == "Traveler Dev API"

paths = {
    route.path
    for route in app.routes
    if hasattr(route, "path")
}

assert "/api/ai/chat" in paths

print(f"[PASS] Application: {app.title}")
print(f"[PASS] Version: {app.version}")
print("[PASS] POST /api/ai/chat discovered")
print(f"[INFO] Direct route count: {len(paths)}")
PY

echo "[8/14] Starting isolated FastAPI production server"

if ss -ltn 2>/dev/null | grep -q ":${PORT} "; then
    fail "Test port ${PORT} is already occupied"
fi

(
    cd "$BACKEND"

    export OPENROUTER_MODEL="$RENDER_MODEL"

    exec "$PYTHON" -m uvicorn app.main:app \
        --host "$HOST" \
        --port "$PORT" \
        --proxy-headers \
        --forwarded-allow-ips="*" \
        --log-level warning
) >"$LOG_FILE" 2>&1 &

PID=$!

echo "[INFO] FastAPI PID: $PID"
echo "[INFO] Test URL: $BASE_URL"

echo "[9/14] Waiting for FastAPI readiness"

READY="0"

for _ in $(seq 1 40); do
    if ! kill -0 "$PID" 2>/dev/null; then
        fail "FastAPI process exited before readiness"
    fi

    if curl -4 -fsS \
        --connect-timeout 3 \
        --max-time 5 \
        "$BASE_URL/health" \
        -o "$HEALTH_FILE" 2>/dev/null
    then
        READY="1"
        break
    fi

    sleep 1
done

if [ "$READY" != "1" ]; then
    fail "FastAPI did not become ready"
fi

echo "[PASS] FastAPI server reachable"

echo "[10/14] Health endpoint"

"$PYTHON" - "$HEALTH_FILE" <<'PY'
import json
import sys

path = sys.argv[1]

with open(path, "r", encoding="utf-8") as fh:
    data = json.load(fh)

assert isinstance(data, dict), "Health response is not JSON object"

print("[PASS] Health response is valid JSON")
print("[INFO] Health:", json.dumps(data, separators=(",", ":")))
PY

echo "[11/14] OpenAPI production contract"

curl -4 -fsS \
    --connect-timeout 5 \
    --max-time 15 \
    "$BASE_URL/openapi.json" \
    -o "$OPENAPI_FILE" \
    || fail "OpenAPI request failed"

"$PYTHON" - "$OPENAPI_FILE" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as fh:
    data = json.load(fh)

paths = data.get("paths", {})

assert "/api/ai/chat" in paths
assert "post" in paths["/api/ai/chat"]

print("[PASS] OpenAPI document valid")
print("[PASS] POST /api/ai/chat published")
print(f"[INFO] Published paths: {len(paths)}")
PY

echo "[12/14] REAL OpenRouter / Claude inference through FastAPI"

REQUEST_BODY="$(
    "$PYTHON" <<'PY'
import json

print(
    json.dumps(
        {
            "message": "Reply with exactly CDESTKTOP_PROVIDER_E2E_OK",
            "model": "anthropic/claude-sonnet-4.5",
            "temperature": 0,
            "max_tokens": 32,
        }
    )
)
PY
)"

HTTP_CODE="$(
    curl -4 \
        -sS \
        --connect-timeout 20 \
        --max-time 180 \
        -o "$RESPONSE_FILE" \
        -w "%{http_code}" \
        -X POST \
        "$BASE_URL/api/ai/chat" \
        -H "Content-Type: application/json" \
        -H "Accept: application/json" \
        --data "$REQUEST_BODY"
)" || fail "HTTP request to /api/ai/chat failed"

echo "[INFO] HTTP status: $HTTP_CODE"

if [ "$HTTP_CODE" != "200" ]; then
    echo
    echo "[FAIL] /api/ai/chat returned HTTP $HTTP_CODE"
    echo
    echo "===== API RESPONSE ====="
    cat "$RESPONSE_FILE" 2>/dev/null || true
    echo
    echo "========================"
    exit 1
fi

echo "[PASS] /api/ai/chat returned HTTP 200"

echo "[13/14] Validating real provider response"

"$PYTHON" - "$RESPONSE_FILE" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as fh:
    data = json.load(fh)

assert isinstance(data, dict), "AI response is not a JSON object"

print("[INFO] Response keys:", ", ".join(sorted(data.keys())))

content = None

for key in (
    "response",
    "content",
    "text",
    "output",
    "answer",
):
    value = data.get(key)

    if isinstance(value, str) and value.strip():
        content = value.strip()
        break

message = data.get("message")

if content is None and isinstance(message, str) and message.strip():
    content = message.strip()

if content is None and isinstance(message, dict):
    nested = message.get("content")
    if isinstance(nested, str) and nested.strip():
        content = nested.strip()

assert content, (
    "Production response contains no textual AI output"
)

print("[PASS] Real AI response received")
print("[INFO] Response:", content[:1000])
PY

echo "[14/14] Final release gate"

echo
echo "============================================================"
echo "PRODUCTION PROVIDER END-TO-END TEST PASSED"
echo "============================================================"
echo "Application       : Traveler Dev API"
echo "API route         : POST /api/ai/chat"
echo "Provider          : OpenRouter"
echo "Render model      : $RENDER_MODEL"
echo "OpenRouter URL    : $OPENROUTER_URL"
echo "Source default    : $SOURCE_MODEL"
echo "Fallback          : openrouter/free"
echo "Other providers   : groq, cerebras"
echo "============================================================"
echo "[PASS] SAFE TO PUSH TO GITHUB"
echo "============================================================"
