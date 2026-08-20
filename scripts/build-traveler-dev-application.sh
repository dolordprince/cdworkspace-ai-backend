#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo
echo "============================================================"
echo " traveler_dev — PRODUCTION APPLICATION BUILD"
echo "============================================================"
echo

test -f packages/local-web/vite.config.ts
test -f packages/local-web/index.html
test -f packages/local-web/src/app/router/index.ts

echo "[PASS] Vite application structure"

echo
echo "===== TYPESCRIPT ====="

pnpm --filter local-web exec tsc --noEmit

echo "[PASS] TypeScript"

echo
echo "===== VITE BUILD ====="

NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}" \
pnpm --filter local-web build

echo "[PASS] production Vite build"

echo
echo "===== PWA ARTIFACTS ====="

test -f packages/local-web/dist/index.html
test -f packages/local-web/dist/manifest.json
test -f packages/local-web/dist/sw.js

echo "[PASS] index.html"
echo "[PASS] manifest.json"
echo "[PASS] sw.js"

echo
echo "============================================================"
echo " traveler_dev — APPLICATION BUILD COMPLETE"
echo "============================================================"
