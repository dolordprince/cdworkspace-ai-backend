#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(pwd)"

echo "============================================================"
echo " BOLT.DIY → TRAVELER DEV STUDIO"
echo " PRODUCTION TRANSFORMATION INITIALIZATION"
echo "============================================================"
echo "Workspace: $ROOT"
echo

command -v git >/dev/null || { echo "[FAIL] git missing"; exit 1; }
command -v node >/dev/null || { echo "[FAIL] node missing"; exit 1; }
command -v pnpm >/dev/null || { echo "[FAIL] pnpm missing"; exit 1; }

test -f package.json || {
  echo "[FAIL] package.json not found."
  echo "Run this script from the cloned bolt.diy repository."
  exit 1
}

if ! grep -qiE '"name"[[:space:]]*:[[:space:]]*"[^"]*(bolt|stackblitz)' package.json; then
  echo "[WARN] package.json does not obviously identify bolt.diy."
fi

mkdir -p \
  backend/app \
  backend/app/api \
  backend/app/core \
  backend/app/providers \
  backend/app/services \
  backend/app/tools \
  backend/tests \
  backend/scripts \
  public \
  scripts \
  .workspace-interrogation/bolt-production

git status --short \
  > .workspace-interrogation/bolt-production/git-before.txt 2>&1 || true

git branch --show-current \
  > .workspace-interrogation/bolt-production/branch.txt 2>&1 || true

git remote -v \
  > .workspace-interrogation/bolt-production/remotes.txt 2>&1 || true

find . \
  -path './.git' -prune -o \
  -path './node_modules' -prune -o \
  -path './dist' -prune -o \
  -path './backend/.venv' -prune -o \
  -type f -print \
  | sort \
  > .workspace-interrogation/bolt-production/files.txt

echo
echo "===== REPOSITORY ====="
cat .workspace-interrogation/bolt-production/remotes.txt

echo
echo "===== PACKAGE ====="
node -e '
const p=require("./package.json");
console.log(JSON.stringify({
  name:p.name,
  version:p.version,
  scripts:p.scripts,
  dependencies:p.dependencies,
  devDependencies:p.devDependencies
}, null, 2));
'

echo
echo "===== EXISTING SERVER/API STRUCTURE ====="
find . \
  -path './.git' -prune -o \
  -path './node_modules' -prune -o \
  -path './dist' -prune -o \
  -type f \( \
    -iname '*server*' -o \
    -iname '*api*' -o \
    -iname '*route*' -o \
    -iname '*provider*' -o \
    -iname '*mcp*' \
  \) -print \
  | sort \
  | head -n 500

echo
echo "===== EXISTING TOOLS ====="
grep -RniE \
  --exclude-dir=.git \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=build \
  'tool|MCP|mcp|action|agent' \
  app src server 2>/dev/null \
  | head -n 1000 || true

echo
echo "===== PROVIDERS ====="
grep -RniE \
  --exclude-dir=.git \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=build \
  'openrouter|groq|anthropic|cerebras|ollama|chat/completions' \
  app src server 2>/dev/null \
  | head -n 1000 || true

echo
echo "===== BRANDING ====="
grep -RniE \
  --exclude-dir=.git \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=build \
  'bolt\.diy|Bolt|StackBlitz' \
  . 2>/dev/null \
  | head -n 1000 || true

echo
echo "===== BACKUP STATE ====="
git status --short || true

echo
echo "[PASS] bolt.diy production transformation initialized."
echo
echo "Nothing was deleted."
echo "Nothing was globally renamed."
echo "Existing bolt.diy architecture remains intact."
