#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$HOME/cdesktop"
WEB="$ROOT/packages/local-web"
SRC="$WEB/src"

cd "$ROOT"

echo "============================================================"
echo " traveler_dev — CDesktop ROUTER INTEGRATION AUDIT"
echo "============================================================"

show_file() {
  local file="$1"

  if [ -f "$file" ]; then
    echo
    echo "----- $file -----"
    sed -n '1,360p' "$file"
  else
    echo "[INFO] Missing: $file"
  fi
}

echo
echo "===== BOOTSTRAP ====="
show_file "$SRC/app/entry/Bootstrap.tsx"

echo
echo "===== APP ENTRY ====="
show_file "$SRC/app/entry/App.tsx"

echo
echo "===== ROUTER ====="
show_file "$SRC/app/router/index.ts"

echo
echo "===== TRAVELER COMPONENT ====="
show_file "$SRC/components/traveler-dev/TravelerDevWorkspace.tsx"

echo
echo "===== TRAVELER API ====="
show_file "$SRC/lib/workspace-api.ts"

echo
echo "===== TRAVELER WORKSPACE ====="
show_file "$SRC/lib/traveler-workspace.ts"

echo
echo "===== EXISTING WORKSPACE ROUTES ====="

find "$SRC/routes" \
  -type f \
  -name '*.tsx' \
  -print \
  | sort \
  | while IFS= read -r file; do
      if grep -qE \
        'workspaces|Workspace' \
        "$file"; then
        echo
        echo "----- $file -----"
        sed -n '1,300p' "$file"
      fi
    done

echo
echo "===== ROUTE TREE ====="

grep -nE \
  'workspaces|projects|hosts|routines|Traveler|traveler' \
  "$SRC/routeTree.gen.ts" \
  | head -n 220 || true

echo
echo "===== TRAVELER MOUNT SEARCH ====="

if grep -Rqs \
  'TravelerDevWorkspace' \
  "$SRC/routes" \
  --include='*.tsx'
then
  echo "[PASS] TravelerDevWorkspace already mounted in a route"
else
  echo "[INFO] TravelerDevWorkspace is not yet mounted in a route"
fi

echo
echo "===== VITE ENTRYPOINT ====="

if grep -qs \
  'src/app/entry/Bootstrap.tsx' \
  "$WEB/index.html"
then
  echo "[PASS] Bootstrap.tsx is the real Vite entrypoint"
else
  echo "[FAIL] Bootstrap.tsx is not referenced by index.html"
  exit 1
fi

echo
echo "===== SERVICE WORKER REGISTRATION ====="

COUNT="$(grep -R \
  -h \
  'registerServiceWorker' \
  "$SRC/app/entry/Bootstrap.tsx" \
  "$SRC/app/router/index.ts" \
  2>/dev/null \
  | wc -l)"

echo "registration references: $COUNT"

if [ "$COUNT" -gt 1 ]; then
  echo "[WARN] Multiple service-worker registration references detected"
fi

echo
echo "===== RESULT ====="
echo "[PASS] Router audit completed without modifying project files"
