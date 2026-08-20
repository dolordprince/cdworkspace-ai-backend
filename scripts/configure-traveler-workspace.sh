#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "===== CDesktop Production Workspace Configuration ====="
echo "ROOT: $ROOT"

command -v node >/dev/null || { echo "[FAIL] node is required"; exit 1; }
command -v pnpm >/dev/null || { echo "[FAIL] pnpm is required"; exit 1; }

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "[FAIL] Node >= 20 required; found $(node -v)"
  exit 1
fi

[ -f package.json ] || { echo "[FAIL] package.json not found"; exit 1; }
[ -f pnpm-workspace.yaml ] || { echo "[FAIL] pnpm-workspace.yaml not found"; exit 1; }
[ -d packages/local-web ] || {
  echo "[FAIL] packages/local-web not found"
  exit 1
}

mkdir -p config

cat > config/traveler-workspace.json <<'JSON'
{
  "name": "CDesktop",
  "workspace": "traveler-dev",
  "backend": {
    "protocol": "http",
    "baseUrl": "http://127.0.0.1:7860",
    "healthPath": "/health"
  },
  "ai": {
    "primary": {
      "provider": "groq",
      "model": "openai/gpt-oss-120b"
    },
    "secondary": {
      "provider": "cerebras",
      "model": "zai-glm-4.7"
    }
  },
  "capabilities": {
    "mcp": true,
    "github": true,
    "androidDeveloperDocs": true,
    "workspaceFiles": true,
    "monaco": true,
    "preview": true,
    "build": true,
    "test": true,
    "websiteGeneration": true,
    "applicationGeneration": true
  }
}
JSON

WEB_DIR="packages/local-web"

cat > "$WEB_DIR/.env.local.example" <<'ENV'
NEXT_PUBLIC_WORKSPACE_API_URL=http://127.0.0.1:7860
NEXT_PUBLIC_WORKSPACE_NAME=CDesktop
NEXT_PUBLIC_WORKSPACE_PROJECT=traveler-dev
ENV

if [ -f "$WEB_DIR/.env.local" ]; then
  cp "$WEB_DIR/.env.local" "$WEB_DIR/.env.local.bak.$(date +%Y%m%d%H%M%S)"
fi

cat > "$WEB_DIR/.env.local" <<'ENV'
NEXT_PUBLIC_WORKSPACE_API_URL=http://127.0.0.1:7860
NEXT_PUBLIC_WORKSPACE_NAME=CDesktop
NEXT_PUBLIC_WORKSPACE_PROJECT=traveler-dev
ENV

echo "===== Dependency Installation ====="
pnpm install --frozen-lockfile

echo "===== TypeScript / Package Validation ====="
pnpm --filter local-web exec tsc --noEmit

echo "===== CDesktop Configuration Complete ====="
echo "Workspace: CDesktop"
echo "Backend: http://127.0.0.1:7860"
echo "Primary: Groq"
echo "Secondary: Cerebras"
echo "MCP: enabled"
echo "GitHub: enabled"
echo "Android documentation: enabled"
echo "Build/test/preview: enabled"
