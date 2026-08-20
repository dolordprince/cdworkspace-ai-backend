#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RENDER_API="${VITE_WORKSPACE_API_URL:-https://cdworkspace-ai-backend.onrender.com}"
RENDER_API="${RENDER_API%/}"

echo
echo "============================================================"
echo " traveler_dev — PRODUCTION VERIFICATION"
echo "============================================================"
echo

fail() {
  echo "[FAIL] $1"
  exit 1
}

pass() {
  echo "[PASS] $1"
}

echo "===== PROJECT ====="

test -f packages/local-web/package.json \
  || fail "local-web package missing"

test -f packages/local-web/vite.config.ts \
  || fail "Vite configuration missing"

test -f packages/local-web/index.html \
  || fail "Vite index.html missing"

pass "CDesktop local-web workspace"

echo
echo "===== IDENTITY ====="

grep -q 'traveler_dev' packages/local-web/.env.local \
  || fail "traveler_dev identity missing"

pass "traveler_dev identity"

echo
echo "===== PRODUCTION API CONFIGURATION ====="

grep -q 'https://cdworkspace-ai-backend.onrender.com' \
  packages/local-web/.env.local \
  || fail "Render API target missing"

pass "Render FastAPI production target"

echo
echo "===== WORKSPACE CAPABILITIES ====="

test -f config/traveler-workspace.json \
  || fail "traveler workspace configuration missing"

node <<'NODE'
const fs = require("fs");

const file = "config/traveler-workspace.json";
const config = JSON.parse(fs.readFileSync(file, "utf8"));

if (config.ai?.primary?.provider !== "groq") {
  throw new Error("Groq is not configured as primary provider");
}

if (config.ai?.secondary?.provider !== "cerebras") {
  throw new Error("Cerebras is not configured as secondary provider");
}

if (config.capabilities?.mcp !== true) {
  throw new Error("MCP capability is disabled");
}

if (config.capabilities?.github !== true) {
  throw new Error("GitHub capability is disabled");
}

if (config.capabilities?.androidDeveloperDocs !== true) {
  throw new Error("Android Developer Docs capability is disabled");
}

if (config.capabilities?.workspaceBuild !== true) {
  throw new Error("Workspace build capability is disabled");
}

if (config.capabilities?.workspaceTest !== true) {
  throw new Error("Workspace test capability is disabled");
}

console.log("[PASS] Groq primary");
console.log("[PASS] Cerebras secondary");
console.log("[PASS] MCP enabled");
console.log("[PASS] GitHub enabled");
console.log("[PASS] Android Developer Docs enabled");
console.log("[PASS] workspace build enabled");
console.log("[PASS] workspace test enabled");
NODE

echo
echo "===== RENDER HTTPS ====="

HTTP_CODE="$(
  curl -4 -sS \
    --connect-timeout 20 \
    --max-time 45 \
    -o /tmp/traveler-dev-health.json \
    -w '%{http_code}' \
    "$RENDER_API/health" \
    2>/tmp/traveler-dev-health.err \
  || true
)"

if [ "$HTTP_CODE" != "200" ]; then
  echo "[FAIL] Render /health returned HTTP ${HTTP_CODE:-connection-error}"
  echo
  cat /tmp/traveler-dev-health.err 2>/dev/null || true
  echo
  echo "The frontend configuration is valid."
  echo "The production backend must be reachable from this network before"
  echo "a live backend verification can pass."
  exit 1
fi

pass "Render FastAPI /health"

echo
echo "===== BACKEND CONTRACT ====="

node <<'NODE'
const fs = require("fs");

const body = JSON.parse(
  fs.readFileSync("/tmp/traveler-dev-health.json", "utf8")
);

if (body.status !== "ok") {
  throw new Error("Backend status is not ok");
}

if (body.primary_provider !== "groq") {
  throw new Error("Backend primary provider is not Groq");
}

if (body.fallback_provider !== "cerebras") {
  throw new Error("Backend fallback provider is not Cerebras");
}

const providers = Array.isArray(body.providers)
  ? body.providers
  : [];

const groq = providers.find((p) => p.provider === "groq");
const cerebras = providers.find((p) => p.provider === "cerebras");

if (!groq?.configured) {
  throw new Error("Groq is not configured on Render");
}

if (!cerebras?.configured) {
  throw new Error("Cerebras is not configured on Render");
}

console.log("[PASS] backend status");
console.log("[PASS] Groq backend configuration");
console.log("[PASS] Cerebras backend configuration");
NODE

echo
echo "===== TYPESCRIPT ====="

pnpm --filter local-web exec tsc --noEmit

pass "TypeScript"

echo
echo "===== PRODUCTION BUILD ====="

NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}" \
pnpm --filter local-web build

pass "Vite production build"

echo
echo "===== PWA OUTPUT ====="

DIST="packages/local-web/dist"

test -f "$DIST/index.html" \
  || fail "production index.html missing"

test -f "$DIST/manifest.json" \
  || fail "production manifest.json missing"

test -f "$DIST/sw.js" \
  || fail "production service worker missing"

pass "PWA manifest"
pass "service worker"
pass "production dist"

echo
echo "============================================================"
echo " traveler_dev — PRODUCTION VERIFICATION PASSED"
echo "============================================================"
echo
echo "Backend:"
echo "  $RENDER_API"
echo
echo "Primary:"
echo "  Groq"
echo
echo "Fallback:"
echo "  Cerebras"
echo
echo "Application:"
echo "  traveler_dev"
echo
echo "Install targets:"
echo "  Android phone"
echo "  Android tablet"
echo "  Windows"
echo "  macOS"
echo "  Linux"
echo
