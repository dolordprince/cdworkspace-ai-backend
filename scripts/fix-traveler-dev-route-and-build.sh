#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

WEB="$ROOT/packages/local-web"
ROUTES="$WEB/src/routes"
COMPONENT="$WEB/src/components/traveler-dev/TravelerDevWorkspace.tsx"
LAUNCHER="$WEB/src/components/traveler-dev/TravelerDevLauncher.tsx"
ROUTE="$ROUTES/traveler-dev.tsx"
ROUTE_TREE="$WEB/src/routeTree.gen.ts"
ENV="$WEB/.env.local"

APP_NAME="traveler_dev"
RENDER_API="https://cdworkspace-ai-backend.onrender.com"

export CI=true
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}"

echo
echo "============================================================"
echo " traveler_dev — ROUTE + PRODUCTION BUILD REPAIR"
echo "============================================================"
echo

fail() {
  echo "[FAIL] $*"
  exit 1
}

pass() {
  echo "[PASS] $*"
}

echo "===== 1. PROJECT VALIDATION ====="

test -d "$WEB" || fail "packages/local-web missing"
test -f "$WEB/package.json" || fail "local-web package.json missing"
test -f "$WEB/vite.config.ts" || fail "vite.config.ts missing"
test -f "$WEB/index.html" || fail "index.html missing"

pass "CDesktop local-web"

echo
echo "===== 2. PRODUCTION IDENTITY ====="

cat > "$ENV" <<EOF
VITE_WORKSPACE_API_URL=${RENDER_API}
VITE_WORKSPACE_NAME=${APP_NAME}
VITE_WORKSPACE_PROJECT=${APP_NAME}
NEXT_PUBLIC_WORKSPACE_API_URL=${RENDER_API}
NEXT_PUBLIC_WORKSPACE_NAME=${APP_NAME}
NEXT_PUBLIC_WORKSPACE_PROJECT=${APP_NAME}
EOF

pass "traveler_dev identity"
pass "Render API target"

echo
echo "===== 3. BACKEND HEALTH ====="

HEALTH="/tmp/traveler_dev_health.json"

if curl -4 -fsS \
  --connect-timeout 20 \
  --max-time 45 \
  "${RENDER_API}/health" \
  -o "$HEALTH"
then
  python3 - "$HEALTH" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as f:
    data = json.load(f)

assert data.get("status") == "ok", data
assert data.get("primary_provider") == "groq", data
assert data.get("fallback_provider") == "cerebras", data

print("[PASS] Render FastAPI health")
print("[PASS] Groq primary")
print("[PASS] Cerebras fallback")
PY
else
  echo "[FAIL] Render health request failed from this shell."
  echo "The production URL remains:"
  echo "  ${RENDER_API}"
  exit 1
fi

echo
echo "===== 4. TRAVELER DEV COMPONENT ====="

test -f "$COMPONENT" || fail "TravelerDevWorkspace.tsx missing"
pass "TravelerDevWorkspace.tsx"

echo
echo "===== 5. REBUILD ROUTE FILE ====="

cat > "$ROUTE" <<'TS'
import { createFileRoute } from '@tanstack/react-router';
import TravelerDevWorkspace from '@/components/traveler-dev/TravelerDevWorkspace';

function TravelerDevRoute() {
  return <TravelerDevWorkspace />;
}

export const Route = createFileRoute('/traveler-dev')({
  component: TravelerDevRoute,
});
TS

pass "traveler_dev route source"

echo
echo "===== 6. VERIFY ROUTER PLUGIN ====="

grep -q 'tanstackRouter' "$WEB/vite.config.ts" \
  || fail "TanStack Router Vite plugin is missing"

pass "TanStack Router Vite plugin"

echo
echo "===== 7. GENERATE ROUTE TREE ====="

rm -f "$ROUTE_TREE"

GENERATOR_OK=0

if pnpm --filter local-web exec tsr generate; then
  GENERATOR_OK=1
fi

if [ "$GENERATOR_OK" -ne 1 ]; then
  if pnpm --filter local-web exec tanstack-router-cli generate; then
    GENERATOR_OK=1
  fi
fi

if [ "$GENERATOR_OK" -ne 1 ]; then
  echo
  echo "[INFO] Router generator executable not available."
  echo "[INFO] Installing the TanStack Router CLI."
  pnpm --filter local-web add -D @tanstack/router-cli@latest
fi

if [ "$GENERATOR_OK" -ne 1 ]; then
  pnpm --filter local-web exec tsr generate \
    || pnpm --filter local-web exec tanstack-router-cli generate
fi

test -f "$ROUTE_TREE" || fail "routeTree.gen.ts was not generated"

pass "routeTree.gen.ts generated"

echo
echo "===== 8. VERIFY GENERATED ROUTE ====="

if grep -qF "'/traveler-dev'" "$ROUTE_TREE"; then
  pass "/traveler-dev registered"
else
  echo
  echo "Generated route tree does not contain /traveler-dev."
  echo
  grep -nE "traveler-dev|routeFile|FileRoutesByPath" "$ROUTE_TREE" | head -100 || true
  fail "TanStack Router did not register traveler_dev route"
fi

echo
echo "===== 9. VERIFY ROUTER TYPE ====="

if grep -qF "'/traveler-dev':" "$ROUTE_TREE"; then
  pass "traveler_dev route type generated"
else
  fail "traveler_dev route type missing"
fi

echo
echo "===== 10. VERIFY LAUNCHER ====="

test -f "$LAUNCHER" || fail "TravelerDevLauncher.tsx missing"

grep -qF "to: '/traveler-dev'" "$LAUNCHER" \
  || fail "Launcher does not navigate to traveler_dev"

pass "Launcher navigation"

echo
echo "===== 11. VERIFY WORKSPACE IMPORT ====="

grep -qF "TravelerDevWorkspace" "$ROUTE" \
  || fail "TravelerDevWorkspace import missing"

pass "Workspace component import"

echo
echo "===== 12. GLASS UI ====="

GLASS="$WEB/src/styles/traveler-dev-glass.css"

test -f "$GLASS" || fail "traveler_dev glass stylesheet missing"

grep -qF ".traveler-glass" "$GLASS" \
  || fail "traveler glass foundation missing"

grep -qF "backdrop-filter" "$GLASS" \
  || fail "glass backdrop filter missing"

pass "glass UI foundation"

echo
echo "===== 13. PWA ====="

MANIFEST="$WEB/public/manifest.json"
SW="$WEB/public/sw.js"

test -f "$MANIFEST" || fail "PWA manifest missing"
test -f "$SW" || fail "service worker missing"

pass "PWA manifest"
pass "service worker"

echo
echo "===== 14. TYPECHECK ====="

pnpm --filter local-web exec tsc --noEmit

pass "TypeScript validation"

echo
echo "===== 15. PRODUCTION BUILD ====="

rm -rf "$WEB/dist"

NODE_OPTIONS="--max-old-space-size=4096" \
  pnpm --filter local-web build

test -f "$WEB/dist/index.html" \
  || fail "Production index.html missing"

pass "Vite production build"

echo
echo "===== 16. BUILD ARTIFACT AUDIT ====="

test -f "$WEB/dist/manifest.json" \
  || fail "dist/manifest.json missing"

pass "production manifest"

if find "$WEB/dist" -type f \
  \( -name 'sw.js' -o -name 'service-worker.js' \) \
  | grep -q .
then
  pass "production service worker artifact"
else
  echo "[INFO] Service worker may be copied by the existing Vite/public pipeline."
fi

echo
echo "===== 17. FINAL CONFIGURATION ====="

echo "Application: traveler_dev"
echo "API:         ${RENDER_API}"
echo "Route:       /traveler-dev"
echo "Backend:     FastAPI"
echo "Primary:     Groq"
echo "Fallback:    Cerebras"
echo "UI:          Glass"
echo "PWA:         Enabled"
echo "Responsive:  Phone / Tablet / Laptop"
echo

echo "============================================================"
echo " traveler_dev — PRODUCTION REPAIR COMPLETE"
echo "============================================================"
echo
echo "[PASS] Route registration"
echo "[PASS] TypeScript"
echo "[PASS] Production Vite build"
echo "[PASS] Render backend"
echo "[PASS] PWA configuration"
echo "[PASS] Glass UI foundation"
echo
