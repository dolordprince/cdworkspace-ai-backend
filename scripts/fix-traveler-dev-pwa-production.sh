#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB="$ROOT/packages/local-web"
ENTRY="$WEB/src/app/entry/Bootstrap.tsx"
PWA="$WEB/src/pwa"

cd "$ROOT"

echo "============================================================"
echo " traveler_dev — PRODUCTION PWA REPAIR"
echo "============================================================"

test -d "$WEB" || {
  echo "[FAIL] local-web workspace not found"
  exit 1
}

test -f "$ENTRY" || {
  echo "[FAIL] real Vite entrypoint not found: $ENTRY"
  exit 1
}

echo
echo "===== 1. FIX SERVICE WORKER SYMBOL ====="

python3 - "$ENTRY" <<'PY'
from pathlib import Path
import re
import sys

p = Path(sys.argv[1])
s = p.read_text()

s = s.replace(
    "registerTravelerServiceWorker();",
    "registerServiceWorker();",
)

p.write_text(s)
PY

grep -n "registerServiceWorker" "$ENTRY"

if grep -q "registerTravelerServiceWorker" "$ENTRY"; then
  echo "[FAIL] obsolete service-worker symbol remains"
  exit 1
fi

echo "[PASS] service worker symbol corrected"

echo
echo "===== 2. VERIFY PWA MODULE ====="

test -f "$PWA/register-service-worker.ts" || {
  echo "[FAIL] missing PWA registration module"
  exit 1
}

grep -q "navigator.serviceWorker" "$PWA/register-service-worker.ts" || {
  echo "[FAIL] registration module does not use Service Worker API"
  exit 1
}

echo "[PASS] Service Worker registration module"

echo
echo "===== 3. VERIFY MANIFEST ====="

MANIFEST="$WEB/public/manifest.json"

test -f "$MANIFEST" || {
  echo "[FAIL] manifest.json missing"
  exit 1
}

node - "$MANIFEST" <<'NODE'
const fs = require("fs");

const file = process.argv[2];
const manifest = JSON.parse(fs.readFileSync(file, "utf8"));

const required = [
  "name",
  "short_name",
  "start_url",
  "display",
  "icons"
];

for (const key of required) {
  if (!(key in manifest)) {
    throw new Error(`manifest missing ${key}`);
  }
}

if (manifest.short_name !== "traveler_dev") {
  throw new Error(`unexpected short_name: ${manifest.short_name}`);
}

if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
  throw new Error("manifest has no icons");
}

console.log("[PASS] traveler_dev manifest");
NODE

echo
echo "===== 4. VERIFY PRODUCTION API ====="

ENV="$WEB/.env.local"

grep -q \
  '^VITE_WORKSPACE_API_URL=https://cdworkspace-ai-backend.onrender.com$' \
  "$ENV" || {
    echo "[FAIL] Vite production API target is incorrect"
    exit 1
  }

grep -q \
  '^NEXT_PUBLIC_WORKSPACE_API_URL=https://cdworkspace-ai-backend.onrender.com$' \
  "$ENV" || {
    echo "[FAIL] Next-compatible production API target is incorrect"
    exit 1
  }

echo "[PASS] Render FastAPI production target"

echo
echo "===== 5. VERIFY REAL BACKEND ====="

HEALTH="$(curl -4 -fsS \
  --connect-timeout 15 \
  --max-time 30 \
  https://cdworkspace-ai-backend.onrender.com/health)"

echo "$HEALTH"

node - "$HEALTH" <<'NODE'
const body = JSON.parse(process.argv[2]);

if (body.status !== "ok") {
  throw new Error("Render backend health status is not ok");
}

if (body.primary_provider !== "groq") {
  throw new Error("Groq is not the primary provider");
}

if (body.fallback_provider !== "cerebras") {
  throw new Error("Cerebras is not the fallback provider");
}

console.log("[PASS] Render FastAPI health");
console.log("[PASS] Groq primary");
console.log("[PASS] Cerebras fallback");
NODE

echo
echo "===== 6. VERIFY WORKSPACE CONTRACT ====="

CONFIG="$ROOT/config/traveler-workspace.json"

node - "$CONFIG" <<'NODE'
const fs = require("fs");

const file = process.argv[2];
const x = JSON.parse(fs.readFileSync(file, "utf8"));

if (x.name !== "traveler_dev") {
  throw new Error("workspace name is not traveler_dev");
}

if (x.project !== "traveler_dev") {
  throw new Error("workspace project is not traveler_dev");
}

if (x.ai.primary.provider !== "groq") {
  throw new Error("primary AI provider is not Groq");
}

if (x.ai.secondary.provider !== "cerebras") {
  throw new Error("secondary AI provider is not Cerebras");
}

if (!x.capabilities.mcp) {
  throw new Error("MCP is disabled");
}

if (!x.capabilities.github) {
  throw new Error("GitHub integration is disabled");
}

if (!x.capabilities.androidDeveloperDocs) {
  throw new Error("Android developer documentation is disabled");
}

if (!x.capabilities.workspaceBuild) {
  throw new Error("workspace build is disabled");
}

if (!x.capabilities.workspaceTest) {
  throw new Error("workspace test is disabled");
}

console.log("[PASS] traveler_dev workspace contract");
NODE

echo
echo "===== 7. TYPESCRIPT ====="

pnpm --filter local-web exec tsc --noEmit

echo "[PASS] TypeScript"

echo
echo "===== 8. PRODUCTION BUILD ====="

# CDesktop is being built inside the constrained mobile/proot environment.
# Give Vite enough V8 heap without requiring a machine-specific global setting.
NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=4096" \
  pnpm --filter local-web build

echo "[PASS] production build"

echo
echo "===== 9. VERIFY DIST ====="

test -f "$WEB/dist/index.html" || {
  echo "[FAIL] production index.html missing"
  exit 1
}

test -f "$WEB/dist/manifest.json" || {
  echo "[FAIL] production manifest missing from dist"
  exit 1
}

test -f "$WEB/dist/sw.js" || {
  echo "[FAIL] production service worker missing from dist"
  exit 1
}

echo "[PASS] production PWA artifacts"

echo
echo "============================================================"
echo " traveler_dev — PRODUCTION PWA READY"
echo "============================================================"
echo
echo "Backend:"
echo "  https://cdworkspace-ai-backend.onrender.com"
echo
echo "Frontend:"
echo "  traveler_dev"
echo
echo "Install targets:"
echo "  Android phone  -> Chrome -> Install app"
echo "  Android tablet -> Chrome -> Install app"
echo "  Windows        -> Chrome/Edge -> Install"
echo "  macOS          -> Chrome/Safari -> Add to Dock"
echo "  Linux          -> Chrome/Chromium -> Install"
echo
echo "AI:"
echo "  Groq primary"
echo "  Cerebras fallback"
echo
echo "Capabilities:"
echo "  MCP"
echo "  GitHub"
echo "  Android Developer Docs"
echo "  Workspace Build"
echo "  Workspace Test"
echo
echo "PWA:"
echo "  standalone"
echo "  responsive"
echo "  installable"
echo "  offline application shell"
echo "  HTTPS backend"
echo
