#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

OUT="$ROOT/.workspace-interrogation"
rm -rf "$OUT"
mkdir -p "$OUT"

echo "===== TRAVELER DEV / CODE DESKTOP WORKSPACE INTERROGATION ====="
echo "ROOT: $ROOT"
echo "OUTPUT: $OUT"
echo

echo "===== REPOSITORY ====="
git remote -v | tee "$OUT/git-remotes.txt"
git branch --show-current | tee "$OUT/git-branch.txt"
git status --short | tee "$OUT/git-status.txt"
git log -5 --oneline | tee "$OUT/git-log.txt"

echo
echo "===== FRONTEND ROOT ====="
find packages/web \
  -maxdepth 2 \
  -type f \
  \( -name 'package.json' -o -name 'vite.config.*' -o -name 'tsconfig*.json' \
     -o -name 'index.html' -o -name 'README*' \) \
  -print | sort | tee "$OUT/frontend-root.txt"

echo
echo "===== FRONTEND ARCHITECTURE ====="
find packages/web/src \
  -maxdepth 3 \
  -type d \
  -print | sort | tee "$OUT/frontend-directories.txt"

echo
echo "===== FRONTEND APPLICATION ENTRYPOINTS ====="
find packages/web/src \
  -type f \
  \( -name 'main.*' -o -name 'App.*' -o -name 'router.*' \
     -o -name '*routes*.*' -o -name '*layout*.*' \) \
  -print | sort | tee "$OUT/frontend-entrypoints.txt"

echo
echo "===== WORKSPACE SYSTEMS ====="
grep -RIlE \
  'workspace-runtime|workspace-auth|workspace-session|workspace-client|workspace-realtime|workspace-messenger|workspace-cache|workspace-agent' \
  packages/web/src \
  2>/dev/null | sort | tee "$OUT/workspace-systems.txt"

echo
echo "===== MESSENGER SYSTEM ====="
grep -RIlE \
  'MessengerMessage|messenger-cache|messenger-client|messenger-runtime|messenger-request' \
  packages/web/src \
  2>/dev/null | sort | tee "$OUT/messenger-system.txt"

echo
echo "===== THEME SYSTEM ====="
grep -RIlE \
  'theme|palette|workspace-theme|workspace-palette' \
  packages/web/src/entities \
  2>/dev/null | sort | tee "$OUT/theme-system.txt"

echo
echo "===== MCP / AGENT BACKEND ====="
find backend/app \
  -type f \
  -print | sort | tee "$OUT/backend-files.txt"

echo
echo "===== BACKEND IMPORT GRAPH ====="
grep -RIlE \
  'from app\.agents|from app\.mcp|from app\.providers|from app\.services|include_router' \
  backend/app \
  2>/dev/null | sort | tee "$OUT/backend-imports.txt"

echo
echo "===== AGENT IMPLEMENTATION ====="
find backend/app/agents backend/app/providers backend/app/mcp \
  -type f \
  -print 2>/dev/null | sort | tee "$OUT/agent-provider-files.txt"

echo
echo "===== CLOUD DEPLOYMENT IMPLEMENTATION ====="
find backend/app \
  -type f \
  -print 2>/dev/null |
while read -r file; do
  grep -IlE 'cloudflare|pages|workers|deploy|deployment' "$file" 2>/dev/null || true
done | sort -u | tee "$OUT/deployment-files.txt"

echo
echo "===== ROUTES ====="
grep -RInE \
  '@router\.(get|post|put|patch|delete)|include_router' \
  backend/app \
  2>/dev/null | tee "$OUT/backend-routes.txt"

echo
echo "===== PROVIDER REFERENCES ====="
grep -RInE \
  'groq|openrouter|anthropic|claude|openai_compatible' \
  backend/app \
  packages/web/src \
  render.yaml \
  2>/dev/null | tee "$OUT/provider-references.txt"

echo
echo "===== ENVIRONMENT CONTRACT ====="
if [[ -f render.yaml ]]; then
  cat render.yaml | tee "$OUT/render.yaml.txt"
fi

if [[ -f .env.example ]]; then
  cat .env.example | tee "$OUT/env.example.txt"
fi

echo
echo "===== PACKAGE CONTRACT ====="
if [[ -f packages/web/package.json ]]; then
  cat packages/web/package.json | tee "$OUT/web-package.json"
fi

if [[ -f backend/requirements.txt ]]; then
  cat backend/requirements.txt | tee "$OUT/backend-requirements.txt"
fi

echo
echo "===== LARGE FILES ====="
find packages/web/src backend/app \
  -type f \
  \( -name '*.ts' -o -name '*.tsx' -o -name '*.py' \) \
  -printf '%s %p\n' 2>/dev/null |
sort -nr |
head -100 |
tee "$OUT/largest-source-files.txt"

echo
echo "===== PYTHON VALIDATION ====="
python3 -m compileall -q backend/app
echo "Python compilation: PASS"

echo
echo "===== FRONTEND TYPE/BUNDLE CONTRACT ====="
if [[ -f packages/web/package.json ]]; then
  cd packages/web

  if command -v npm >/dev/null 2>&1; then
    npm run 2>/dev/null | tee "$ROOT/$OUT/frontend-npm-scripts.txt" || true
  fi

  cd "$ROOT"
fi

echo
echo "===== SECRET SAFETY CHECK ====="
if grep -RInE \
  'sk-or-v1-|OPENROUTER_API_KEY=|CF_API_TOKEN=|CLOUDFLARE_API_TOKEN=|Bearer [A-Za-z0-9._-]{20,}' \
  backend packages/web render.yaml \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude='*.pyc' \
  2>/dev/null; then
  echo "WARNING: possible credential material found above."
else
  echo "No obvious credential material found."
fi

echo
echo "===== INTERROGATION COMPLETE ====="
echo "Reports:"
find "$OUT" -maxdepth 1 -type f -printf '  %f\n' | sort

echo
echo "IMPORTANT:"
echo "No source files were intentionally modified by this interrogation."
