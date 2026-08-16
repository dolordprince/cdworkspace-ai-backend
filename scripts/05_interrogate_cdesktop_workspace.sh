#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

OUT="/tmp/traveler-cdesktop-interrogation"
rm -rf "$OUT"
mkdir -p "$OUT"

echo "============================================================"
echo "TRAVELER DEV — C-DESKTOP WORKSPACE INTERROGATION"
echo "============================================================"

echo
echo "===== 1. FRONTEND MANIFEST ====="

find packages/web -maxdepth 2 -type f \
  \( -name 'package.json' \
  -o -name 'vite.config.*' \
  -o -name 'tsconfig*.json' \
  -o -name 'index.html' \
  -o -name 'README*' \
  \) \
  -print | sort | tee "$OUT/frontend-manifest.txt"

echo
echo "===== 2. APPLICATION ENTRYPOINTS ====="

find packages/web/src -type f \
  \( -name '*.tsx' -o -name '*.ts' \) \
  -print | sort > "$OUT/source-files.txt"

grep -RIlE \
  'createRoot|ReactDOM|createBrowserRouter|BrowserRouter|RouterProvider|App\(|function App|export default function App|main\.tsx' \
  packages/web/src \
  --include='*.tsx' \
  --include='*.ts' \
  | sort | tee "$OUT/entrypoints.txt"

echo
echo "===== 3. WORKSPACE UI ====="

grep -RInE \
  'Workspace|workspace|Desktop|desktop|sidebar|Sidebar|panel|Panel|composer|prompt|Prompt|chat|Chat|message|Message|editor|Editor|preview|Preview|terminal|Terminal' \
  packages/web/src \
  --include='*.tsx' \
  --include='*.ts' \
  --exclude='*.test.ts' \
  --exclude='*.spec.ts' \
  | tee "$OUT/workspace-ui.txt" | head -n 2000

echo
echo "===== 4. EXISTING AI / AGENT CONTRACT ====="

grep -RInE \
  'agent|Agent|LLM|llm|model|Model|provider|Provider|OpenAI|Anthropic|Claude|OpenRouter|Groq|MCP|mcp' \
  packages/web/src \
  --include='*.tsx' \
  --include='*.ts' \
  --exclude='*.test.ts' \
  --exclude='*.spec.ts' \
  | tee "$OUT/ai-contract.txt" | head -n 3000

echo
echo "===== 5. API CLIENTS ====="

grep -RInE \
  'fetch\(|axios|ky\(|/api/|baseURL|API_URL|VITE_|workspace-client|request|mutation|query' \
  packages/web/src \
  --include='*.tsx' \
  --include='*.ts' \
  --exclude='*.test.ts' \
  --exclude='*.spec.ts' \
  | tee "$OUT/api-contract.txt" | head -n 3000

echo
echo "===== 6. MCP FRONTEND CONTRACT ====="

grep -RInE \
  'MCP|mcp|tools/list|tools/call|initialize|prompts/list|resources/list|workspace_agent_run' \
  packages/web/src \
  --include='*.tsx' \
  --include='*.ts' \
  --exclude='*.test.ts' \
  --exclude='*.spec.ts' \
  | tee "$OUT/mcp-contract.txt" || true

echo
echo "===== 7. DEPLOYMENT CONTRACT ====="

grep -RInE \
  'deploy|Deploy|Cloudflare|cloudflare|Pages|Workers|wrangler|publish|Publish|URL|url' \
  packages/web/src \
  --include='*.tsx' \
  --include='*.ts' \
  --exclude='*.test.ts' \
  --exclude='*.spec.ts' \
  | tee "$OUT/deployment-contract.txt" | head -n 3000

echo
echo "===== 8. PWA / INSTALLABILITY ====="

grep -RInE \
  'manifest|serviceWorker|service-worker|registerSW|workbox|beforeinstallprompt|Install|PWA' \
  packages/web \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude='*.map' \
  | tee "$OUT/pwa-contract.txt" | head -n 2000

echo
echo "===== 9. THEME / BRANDING ====="

grep -RInE \
  'theme|palette|color|blue|navy|slate|white|glass|backdrop|Workspace AI|Traveler|Traveler Dev' \
  packages/web/src \
  --include='*.tsx' \
  --include='*.ts' \
  --include='*.css' \
  --exclude='*.test.ts' \
  --exclude='*.spec.ts' \
  | tee "$OUT/theme-contract.txt" | head -n 3000

echo
echo "===== 10. EXISTING WORKSPACE RUNTIME ====="

find packages/web/src \
  -type f \
  \( -path '*workspace-runtime*' \
  -o -path '*workspace-auth*' \
  -o -path '*workspace-client*' \
  -o -path '*workspace-realtime*' \
  -o -path '*messenger*' \
  \) \
  -print | sort | tee "$OUT/runtime-files.txt"

echo
echo "===== 11. ROOT PACKAGE SCRIPTS ====="

if [[ -f packages/web/package.json ]]; then
  node - <<'NODE'
const fs = require("fs");
const p = JSON.parse(fs.readFileSync("packages/web/package.json", "utf8"));

console.log(JSON.stringify({
  name: p.name,
  version: p.version,
  private: p.private,
  scripts: p.scripts,
  dependencies: p.dependencies,
  devDependencies: p.devDependencies
}, null, 2));
NODE
fi

echo
echo "===== 12. FRONTEND BUILD ====="

cd packages/web

if [[ -f package-lock.json ]]; then
  npm ci
elif [[ -f pnpm-lock.yaml ]]; then
  corepack pnpm install --frozen-lockfile
elif [[ -f yarn.lock ]]; then
  yarn install --frozen-lockfile
else
  npm install
fi

npm run build

cd "$ROOT"

echo
echo "===== 13. BACKEND ↔ FRONTEND CONTRACT CROSS-CHECK ====="

echo "--- Backend routes ---"
grep -RInE \
  '@router\.(get|post|put|delete)|app\.(get|post|put|delete)|include_router' \
  backend/app \
  --include='*.py' \
  --exclude-dir=__pycache__ \
  | tee "$OUT/backend-routes.txt"

echo
echo "--- Frontend API paths ---"
grep -RhoE \
  '["'"'"'`]/[A-Za-z0-9_./:{}?=&-]+' \
  packages/web/src \
  --include='*.ts' \
  --include='*.tsx' \
  | sort -u \
  | tee "$OUT/frontend-api-paths.txt"

echo
echo "===== 14. LEGACY PROVIDER AUDIT ====="

if grep -RInE \
  'groq|api\.groq\.com|groq_api_key|groq_model' \
  packages/web/src backend \
  --include='*.ts' \
  --include='*.tsx' \
  --include='*.py' \
  --exclude-dir=__pycache__; then
  echo "[FAIL] Legacy Groq references remain in active source."
else
  echo "[PASS] No active Groq references."
fi

echo
echo "===== 15. PRODUCTION BRAND AUDIT ====="

if grep -RInE \
  'Workspace AI' \
  packages/web/src \
  backend \
  --include='*.tsx' \
  --include='*.ts' \
  --include='*.py' \
  --exclude-dir=__pycache__; then
  echo "[WARN] Workspace AI branding remains."
else
  echo "[PASS] No active Workspace AI branding."
fi

echo
echo "===== 16. OUTPUT ====="

echo "Interrogation files:"
find "$OUT" -type f -maxdepth 1 -print | sort

echo
echo "============================================================"
echo "C-DESKTOP INTERROGATION COMPLETE"
echo "============================================================"
echo
echo "NO SOURCE WAS MODIFIED."
echo "NO DEPLOYMENT WAS PERFORMED."
