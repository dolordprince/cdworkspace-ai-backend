#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "============================================================"
echo " CDESKTOP — CANONICAL MAIN WORKSPACE AUDIT"
echo "============================================================"
echo "ROOT: $ROOT"
echo

test -d . || { echo "[FAIL] Invalid workspace"; exit 1; }

mkdir -p .workspace-interrogation/cdesktop-main
STAMP="$(date +%Y%m%d-%H%M%S)"

git status --short > ".workspace-interrogation/cdesktop-main/git-status-$STAMP.txt" 2>&1 || true
git branch --show-current > ".workspace-interrogation/cdesktop-main/git-branch-$STAMP.txt" 2>&1 || true
git remote -v > ".workspace-interrogation/cdesktop-main/git-remotes-$STAMP.txt" 2>&1 || true

find . \
  -path './node_modules' -prune -o \
  -path './.git' -prune -o \
  -path './dist' -prune -o \
  -path './build' -prune -o \
  -type f -print \
  | sort > ".workspace-interrogation/cdesktop-main/files-$STAMP.txt"

find . \
  -path './node_modules' -prune -o \
  -path './.git' -prune -o \
  -type f \( \
    -name '*mcp*' -o \
    -name '*tool*' -o \
    -name '*agent*' -o \
    -name '*workspace*' \
  \) -print \
  | sort > ".workspace-interrogation/cdesktop-main/architecture-$STAMP.txt"

echo
echo "===== PROJECT FILES ====="
sed -n '1,250p' ".workspace-interrogation/cdesktop-main/files-$STAMP.txt"

echo
echo "===== MCP / TOOL / AGENT / WORKSPACE FILES ====="
cat ".workspace-interrogation/cdesktop-main/architecture-$STAMP.txt"

echo
echo "===== PACKAGE MANIFESTS ====="
find . \
  -path './node_modules' -prune -o \
  -path './.git' -prune -o \
  -type f \( \
    -name 'package.json' -o \
    -name 'pyproject.toml' -o \
    -name 'requirements.txt' -o \
    -name 'requirements*.txt' \
  \) -print | sort

echo
echo "===== PROVIDER REFERENCES ====="
grep -RniE \
  --exclude-dir=.git \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=build \
  'openrouter|groq|cerebras|anthropic|ollama|provider' \
  . 2>/dev/null \
  | head -n 500 \
  || true

echo
echo "===== MCP REFERENCES ====="
grep -RniE \
  --exclude-dir=.git \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=build \
  'MCP|Model Context Protocol|mcp|tools/list|tools/call|resources/list|prompts/list' \
  . 2>/dev/null \
  | head -n 500 \
  || true

echo
echo "===== GIT STATUS ====="
git status --short || true

echo
echo "[PASS] cdesktop audit completed."
echo "Audit directory:"
echo "$ROOT/.workspace-interrogation/cdesktop-main"
