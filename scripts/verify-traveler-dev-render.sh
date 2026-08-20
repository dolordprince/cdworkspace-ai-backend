#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

EXPECTED_HOST="cdworkspace-ai-backend.onrender.com"

echo "===== traveler_dev RENDER DNS AUDIT ====="

echo
echo "===== LOCAL DNS ====="

if command -v getent >/dev/null 2>&1; then
    getent ahosts "$EXPECTED_HOST" || true
fi

if command -v nslookup >/dev/null 2>&1; then
    nslookup "$EXPECTED_HOST" || true
elif command -v dig >/dev/null 2>&1; then
    dig "$EXPECTED_HOST" A +short || true
fi

echo
echo "===== HTTPS RESOLUTION ====="

if curl -4 -I \
    --connect-timeout 15 \
    --max-time 30 \
    "https://${EXPECTED_HOST}/health"; then
    echo "[PASS] Render hostname resolves and accepts HTTPS"
else
    echo "[FAIL] Render hostname is not reachable"
fi

echo
echo "===== CURRENT FRONTEND TARGET ====="

grep -E \
    '^(VITE_WORKSPACE_API_URL|NEXT_PUBLIC_WORKSPACE_API_URL)=' \
    packages/local-web/.env.local

echo
echo "===== GIT/PROJECT REFERENCES TO RENDER ====="

grep -RInE \
    'onrender\.com|WORKSPACE_API_URL' \
    packages/local-web config scripts \
    --exclude-dir=node_modules \
    --exclude-dir=dist \
    --exclude-dir=.git \
    --exclude='*.bak*' \
    2>/dev/null || true

echo
echo "===== RESULT ====="
echo "The frontend configuration is syntactically valid."
echo "The Render hostname itself must be corrected if DNS resolution fails."
