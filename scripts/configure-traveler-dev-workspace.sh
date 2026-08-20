#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RENDER_API="https://cdworkspace-ai-backend.onrender.com"
ENV_FILE="packages/local-web/.env.local"
CONFIG_FILE="config/traveler-workspace.json"
API_FILE="packages/local-web/src/lib/workspace-api.ts"

echo "===== traveler_dev CDesktop PRODUCTION CONFIGURATION ====="

mkdir -p \
  "$(dirname "$ENV_FILE")" \
  "$(dirname "$CONFIG_FILE")" \
  "$(dirname "$API_FILE")"

cat > "$ENV_FILE" <<EOF
VITE_WORKSPACE_API_URL=${RENDER_API}
VITE_WORKSPACE_NAME=traveler_dev
VITE_WORKSPACE_PROJECT=traveler_dev
NEXT_PUBLIC_WORKSPACE_API_URL=${RENDER_API}
NEXT_PUBLIC_WORKSPACE_NAME=traveler_dev
NEXT_PUBLIC_WORKSPACE_PROJECT=traveler_dev
EOF

cat > "$CONFIG_FILE" <<'JSON'
{
  "name": "traveler_dev",
  "displayName": "traveler_dev",
  "project": "traveler_dev",
  "backend": {
    "baseUrl": "https://cdworkspace-ai-backend.onrender.com",
    "transport": "https"
  },
  "ai": {
    "primary": {
      "provider": "groq"
    },
    "secondary": {
      "provider": "cerebras"
    }
  },
  "capabilities": {
    "mcp": true,
    "github": true,
    "androidDeveloperDocs": true,
    "workspaceBuild": true,
    "workspaceTest": true
  }
}
JSON

cat > "$API_FILE" <<'TS'
const API_BASE =
  import.meta.env.VITE_WORKSPACE_API_URL ||
  import.meta.env.NEXT_PUBLIC_WORKSPACE_API_URL ||
  "https://cdworkspace-ai-backend.onrender.com";

function joinUrl(path: string): string {
  const base = API_BASE.replace(/\/+$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

async function request<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(joinUrl(path), {
    ...init,
    headers,
  });

  const contentType = response.headers.get("content-type") || "";
  const raw = await response.text();

  let data: unknown = null;

  if (raw) {
    if (contentType.includes("application/json")) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = raw;
      }
    } else {
      data = raw;
    }
  }

  if (!response.ok) {
    const detail =
      typeof data === "object" &&
      data !== null &&
      "detail" in data
        ? String((data as { detail: unknown }).detail)
        : typeof data === "string"
          ? data
          : `HTTP ${response.status}`;

    throw new Error(
      `traveler_dev workspace API ${response.status}: ${detail}`,
    );
  }

  return data as T;
}

export async function health(): Promise<unknown> {
  return request("/health");
}

export async function getWorkspaceCapabilities(): Promise<unknown> {
  return request("/api/workspace/capabilities");
}

export async function searchGithub(
  query: string,
): Promise<unknown> {
  return request("/api/github/search", {
    method: "POST",
    body: JSON.stringify({ query }),
  });
}

export async function searchAndroidDocs(
  query: string,
): Promise<unknown> {
  return request("/api/android/docs/search", {
    method: "POST",
    body: JSON.stringify({ query }),
  });
}

export async function buildWorkspace(
  payload: Record<string, unknown>,
): Promise<unknown> {
  return request("/api/workspace/build", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function testWorkspace(
  payload: Record<string, unknown>,
): Promise<unknown> {
  return request("/api/workspace/test", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function runAgent(
  payload: Record<string, unknown>,
): Promise<unknown> {
  return request("/api/agent/run", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export { API_BASE };
TS

echo
echo "===== REPLACING CDesktop IDENTITY ====="

# Rename user-facing identity only. Do not blindly alter package names,
# import namespaces, or source-directory names.
find packages/local-web/src config -type f \
  \( -name '*.ts' -o -name '*.tsx' -o -name '*.json' -o -name '*.css' \) \
  -print0 |
while IFS= read -r -d '' file; do
  sed -i \
    -e 's/CDesktop/traveler_dev/g' \
    -e 's/traveler-dev/traveler_dev/g' \
    "$file"
done

echo
echo "===== CONFIGURATION VERIFICATION ====="

node <<'NODE'
const fs = require("fs");

const env = fs.readFileSync(
  "packages/local-web/.env.local",
  "utf8",
);

const config = JSON.parse(
  fs.readFileSync(
    "config/traveler-workspace.json",
    "utf8",
  ),
);

function requireLine(value, name) {
  if (!value) {
    throw new Error(`${name} missing`);
  }
}

if (
  !env.includes(
    "VITE_WORKSPACE_API_URL=https://cdworkspace-ai-backend.onrender.com",
  )
) {
  throw new Error("Vite Render API URL is incorrect");
}

if (!env.includes("VITE_WORKSPACE_NAME=traveler_dev")) {
  throw new Error("Vite workspace name is incorrect");
}

if (config.name !== "traveler_dev") {
  throw new Error("workspace configuration name is incorrect");
}

if (config.ai.primary.provider !== "groq") {
  throw new Error("Groq is not configured as primary provider");
}

if (config.ai.secondary.provider !== "cerebras") {
  throw new Error("Cerebras is not configured as secondary provider");
}

if (!config.capabilities.mcp) {
  throw new Error("MCP capability disabled");
}

if (!config.capabilities.github) {
  throw new Error("GitHub capability disabled");
}

if (!config.capabilities.androidDeveloperDocs) {
  throw new Error("Android developer docs capability disabled");
}

if (!config.capabilities.workspaceBuild) {
  throw new Error("Workspace build capability disabled");
}

if (!config.capabilities.workspaceTest) {
  throw new Error("Workspace test capability disabled");
}

console.log("[PASS] traveler_dev identity");
console.log("[PASS] Render FastAPI production target");
console.log("[PASS] Groq primary");
console.log("[PASS] Cerebras secondary");
console.log("[PASS] MCP enabled");
console.log("[PASS] GitHub enabled");
console.log("[PASS] Android docs enabled");
console.log("[PASS] workspace build enabled");
console.log("[PASS] workspace test enabled");
NODE

echo
echo "===== TYPESCRIPT VALIDATION ====="

pnpm --filter local-web exec tsc --noEmit

echo
echo "===== PRODUCTION BUILD ====="

pnpm --filter local-web build

echo
echo "===== traveler_dev CONFIGURATION COMPLETE ====="
