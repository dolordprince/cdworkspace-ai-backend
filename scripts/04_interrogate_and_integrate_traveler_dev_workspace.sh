#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "============================================================"
echo "TRAVELER DEV — COMPLETE WORKSPACE INTERROGATION"
echo "============================================================"
echo "ROOT: $ROOT"
echo

fail() {
  echo "[FAIL] $*" >&2
  exit 1
}

pass() {
  echo "[PASS] $*"
}

require_file() {
  [[ -f "$1" ]] || fail "Required file missing: $1"
  pass "Found $1"
}

echo "===== 1. REPOSITORY ====="
git rev-parse --is-inside-work-tree >/dev/null || fail "Not a git repository"
echo "Branch: $(git branch --show-current)"
echo "Remote:"
git remote -v || true
echo

echo "===== 2. SOURCE INVENTORY ====="

find backend -type f \
  ! -path '*/__pycache__/*' \
  ! -name '*.pyc' \
  -print | sort > /tmp/traveler_backend_files.txt

if [[ -d traveler-dev ]]; then
  find traveler-dev -type f \
    ! -path '*/node_modules/*' \
    ! -path '*/dist/*' \
    ! -path '*/build/*' \
    -print | sort > /tmp/traveler_workspace_files.txt
else
  : > /tmp/traveler_workspace_files.txt
fi

if [[ -d packages/web ]]; then
  find packages/web -type f \
    ! -path '*/node_modules/*' \
    ! -path '*/dist/*' \
    ! -path '*/build/*' \
    -print | sort > /tmp/traveler_web_files.txt
else
  : > /tmp/traveler_web_files.txt
fi

echo "--- backend ---"
cat /tmp/traveler_backend_files.txt
echo
echo "--- traveler-dev workspace ---"
cat /tmp/traveler_workspace_files.txt
echo
echo "--- packages/web ---"
cat /tmp/traveler_web_files.txt
echo

echo "===== 3. FRONTEND CONTRACT INTERROGATION ====="

for f in \
  traveler-dev/package.json \
  traveler-dev/vite.config.* \
  traveler-dev/index.html \
  packages/web/package.json \
  packages/web/vite.config.* \
  packages/web/index.html
do
  for actual in $f; do
    [[ -f "$actual" ]] || continue
    echo
    echo "----- $actual -----"
    sed -n '1,260p' "$actual"
  done
done

echo
echo "===== 4. WORKSPACE UI SOURCE INTERROGATION ====="

grep -RInE \
  'Claude|OpenRouter|MCP|workspace|agent|prompt|terminal|Monaco|preview|build|deploy|Cloudflare|Traveler|Workspace AI|Groq' \
  traveler-dev packages/web 2>/dev/null \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=build \
  --exclude='*.map' \
  | head -n 1000 || true

echo
echo "===== 5. BACKEND ROUTE INTERROGATION ====="

grep -RInE \
  '@router\.(get|post|put|delete)|APIRouter|include_router|FastAPI\(' \
  backend/app \
  --exclude-dir=__pycache__ \
  --exclude='*.pyc' \
  | head -n 1500 || true

echo
echo "===== 6. PROVIDER CONTRACT ====="

require_file backend/app/config.py
require_file backend/app/providers/registry.py

if [[ -f backend/app/providers/openrouter.py ]]; then
  sed -n '1,320p' backend/app/providers/openrouter.py
else
  fail "OpenRouter provider source is missing"
fi

echo
echo "===== 7. MCP CONTRACT ====="

require_file backend/app/mcp/server.py
sed -n '1,360p' backend/app/mcp/server.py

echo
echo "===== 8. CLOUDflare CONTRACT ====="

if [[ -f backend/app/api/cloudflare.py ]]; then
  sed -n '1,360p' backend/app/api/cloudflare.py
else
  echo "[WARN] Cloudflare API route does not exist yet"
fi

if [[ -f backend/app/services/cloudflare.py ]]; then
  sed -n '1,420p' backend/app/services/cloudflare.py
else
  echo "[WARN] Cloudflare service does not exist yet"
fi

echo
echo "===== 9. PYTHON CACHE / STALE ARTIFACT AUDIT ====="

echo "Compiled Python artifacts:"
find . \
  -type f \
  \( -name '*.pyc' -o -name '*.pyo' \) \
  -print \
  -not -path './.git/*' \
  -not -path './node_modules/*' \
  | sort || true

echo
echo "Python cache directories:"
find . \
  -type d \
  -name '__pycache__' \
  -print \
  -not -path './.git/*' \
  | sort || true

echo
echo "Backup source files:"
find . \
  -type f \
  \( -name '*.bak' -o -name '*.bak.*' -o -name '*~' \) \
  -print \
  -not -path './.git/*' \
  | sort || true

echo
echo "===== 10. OLD PROVIDER / BRAND CONTRACT AUDIT ====="

if grep -RInE \
  'groq_api_key|groq_model|api\.groq\.com|Workspace AI|workspace-agent-through-Groq|provider.*groq' \
  backend traveler-dev packages/web render.yaml 2>/dev/null \
  --exclude-dir=__pycache__ \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=build \
  --exclude='*.pyc' \
  --exclude='*.bak*'; then
  echo "[WARN] Legacy Groq/Workspace AI references remain in deployable source."
else
  pass "No legacy Groq/Workspace AI references found in deployable source"
fi

echo
echo "===== 11. REQUIRED PRODUCTION FILES ====="

require_file render.yaml
require_file backend/app/config.py
require_file backend/app/api/health.py
require_file backend/app/api/agent.py
require_file backend/app/mcp/server.py
require_file backend/app/providers/registry.py
require_file backend/app/providers/openrouter.py

echo
echo "===== 12. RENDER CONTRACT ====="
sed -n '1,320p' render.yaml

echo
echo "===== 13. ENVIRONMENT REFERENCES ====="

grep -RInE \
  'OPENROUTER_|CLOUDFLARE_|RENDER_|MCP_|DATABASE_URL|PORT' \
  backend render.yaml \
  --exclude-dir=__pycache__ \
  --exclude='*.pyc' \
  | head -n 1000 || true

echo
echo "===== 14. STATIC FRONTEND BUILD CONTRACT ====="

if [[ -f traveler-dev/package.json ]]; then
  (
    cd traveler-dev
    node --version
    npm --version
    npm run build
  )
elif [[ -f packages/web/package.json ]]; then
  (
    cd packages/web
    node --version
    npm --version
    npm run build
  )
else
  fail "No supported frontend package.json found"
fi

echo
echo "===== 15. PYTHON COMPILE CONTRACT ====="

python3 -m compileall -q backend
pass "Python source compilation"

echo
echo "===== 16. DEPLOYABLE ARTIFACT CLEANUP ====="

find backend traveler-dev packages/web \
  -type d \
  -name '__pycache__' \
  -prune \
  -exec rm -rf {} + 2>/dev/null || true

find backend traveler-dev packages/web \
  -type f \
  \( -name '*.pyc' -o -name '*.pyo' \) \
  -delete 2>/dev/null || true

find backend traveler-dev packages/web \
  -type f \
  -name '*.bak*' \
  -delete 2>/dev/null || true

pass "Removed stale Python cache and backup artifacts from deployable source"

echo
echo "===== 17. FINAL SOURCE-ONLY AUDIT ====="

if find backend traveler-dev packages/web \
  -type f \
  \( -name '*.pyc' -o -name '*.pyo' -o -name '*.bak*' \) \
  -print | grep -q .; then
  fail "Stale deployable artifacts remain"
fi

git diff --check

echo
echo "============================================================"
echo "INTERROGATION COMPLETE"
echo "============================================================"
echo
echo "Generated inventories:"
echo "  /tmp/traveler_backend_files.txt"
echo "  /tmp/traveler_workspace_files.txt"
echo "  /tmp/traveler_web_files.txt"
echo
echo "Next production operation:"
echo "  integrate the actual discovered Claude Desktop workspace"
echo "  with MCP + OpenRouter Claude + Cloudflare deployment"
echo
echo "No deployment success is claimed by this script."
