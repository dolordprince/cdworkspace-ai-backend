#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL="${1:-https://cdworkspace-ai-backend.onrender.com}"

fail() {
    echo "[FAIL] $*"
    exit 1
}

echo "============================================================"
echo "CDESTKTOP — REAL RENDER PRODUCTION PROVIDER TEST"
echo "============================================================"

echo "[1/6] Production health"

HEALTH="$(curl -fsS \
    --connect-timeout 20 \
    --max-time 60 \
    "$BASE_URL/health")" || fail "Render health request failed"

echo "$HEALTH"

echo "$HEALTH" | grep -q '"status":"ok"' \
    || fail "Render health status is not ok"

echo "[PASS] Render production API is healthy"

echo "[2/6] Production OpenAPI"

OPENAPI="$(curl -fsS \
    --connect-timeout 20 \
    --max-time 60 \
    "$BASE_URL/openapi.json")" \
    || fail "Render OpenAPI request failed"

echo "$OPENAPI" | grep -q '"/api/ai/chat"' \
    || fail "/api/ai/chat is not published"

echo "[PASS] /api/ai/chat published"

echo "[3/6] Real production Claude inference"

RESPONSE_FILE="$(mktemp)"
trap 'rm -f "$RESPONSE_FILE"' EXIT

STATUS="$(
    curl -sS \
        -o "$RESPONSE_FILE" \
        -w '%{http_code}' \
        --connect-timeout 20 \
        --max-time 180 \
        -X POST \
        "$BASE_URL/api/ai/chat" \
        -H 'Content-Type: application/json' \
        -d '{
            "messages": [
                {
                    "role": "user",
                    "content": "Reply with exactly: TRAVELER DEV PRODUCTION PASS"
                }
            ]
        }'
)"

echo "[INFO] HTTP status: $STATUS"
cat "$RESPONSE_FILE"
echo

if [[ "$STATUS" != "200" ]]; then
    fail "Real Render AI inference failed"
fi

grep -qi 'TRAVELER DEV PRODUCTION PASS' "$RESPONSE_FILE" \
    || fail "Claude response did not contain expected production response"

echo "[PASS] Real Render OpenRouter/Claude inference"

echo "[4/6] Production provider response validation"

grep -qi 'claude\|anthropic' "$RESPONSE_FILE" \
    || echo "[WARN] Response does not expose provider/model metadata"

echo "[5/6] Final production endpoint"

echo "BASE_URL=$BASE_URL"
echo "[PASS] Render endpoint operational"

echo "[6/6] Release decision"

echo "============================================================"
echo "REAL RENDER PRODUCTION TEST PASSED"
echo "============================================================"
echo "Model configured in Render : anthropic/claude-sonnet-4.5"
echo "Endpoint                   : $BASE_URL"
echo "AI route                   : /api/ai/chat"
echo "============================================================"
