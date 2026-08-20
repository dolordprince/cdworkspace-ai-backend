#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT/packages/local-web/dist"
PROJECT="traveler_dev"

cd "$ROOT"

echo
echo "============================================================"
echo " traveler_dev — CLOUDFLARE PAGES DEPLOYMENT"
echo "============================================================"

fail() {
  echo "[FAIL] $1"
  exit 1
}

pass() {
  echo "[PASS] $1"
}

command -v npx >/dev/null 2>&1 \
  || fail "Node/npm/npx is required"

test -d "$DIST" \
  || fail "Production dist directory missing"

test -f "$DIST/index.html" \
  || fail "Production index.html missing"

test -f "$DIST/manifest.json" \
  || fail "Production manifest missing"

test -f "$DIST/sw.js" \
  || fail "Production service worker missing"

echo
echo "===== PRODUCTION ARTIFACT ====="

du -sh "$DIST"

pass "production artifact"

echo
echo "===== CLOUDFLARE AUTHENTICATION ====="

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo
  echo "CLOUDFLARE_API_TOKEN is not configured."
  echo
  echo "Authenticate Wrangler with:"
  echo
  echo "  npx wrangler login"
  echo
  echo "Then rerun:"
  echo
  echo "  ./scripts/publish-traveler-dev-cloudflare.sh"
  echo
  exit 2
fi

pass "Cloudflare API token detected"

echo
echo "===== CLOUDFLARE DEPLOYMENT ====="

npx wrangler pages deploy "$DIST" \
  --project-name "$PROJECT" \
  --commit-dirty=true

echo
echo "===== DEPLOYMENT COMPLETE ====="

echo
echo "Application:"
echo "  $PROJECT"

echo
echo "Backend:"
echo "  https://cdworkspace-ai-backend.onrender.com"

echo
echo "PWA installation:"
echo "  Android phone/tablet -> browser -> Install app"
echo "  Windows -> Chrome/Edge -> Install"
echo "  macOS -> browser -> Add to Dock"
echo "  Linux -> Chrome/Chromium -> Install"

echo
pass "traveler_dev deployed"
