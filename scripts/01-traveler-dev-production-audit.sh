#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

echo "===== TRAVELER DEV PRODUCTION AUDIT ====="
echo "Repository: $(git remote get-url origin 2>/dev/null || printf '%s\n' 'no-origin')"
echo "Branch: $(git branch --show-current)"
echo "Commit: $(git rev-parse HEAD)"
echo

command -v node >/dev/null || { echo "ERROR: Node.js is required"; exit 1; }
command -v npm >/dev/null || { echo "ERROR: npm is required"; exit 1; }

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"

if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "ERROR: Node.js >=22 required. Found $(node -v)"
  exit 1
fi

echo "Node: $(node -v)"
echo "npm:  $(npm -v)"
echo

test -f package.json || { echo "ERROR: root package.json missing"; exit 1; }
test -f packages/web/package.json || {
  echo "ERROR: packages/web/package.json missing"
  exit 1
}

echo "===== REQUIRED WORKSPACE ====="

node <<'NODE'
const fs = require("fs");

const root = JSON.parse(fs.readFileSync("package.json", "utf8"));
const web = JSON.parse(fs.readFileSync("packages/web/package.json", "utf8"));

const requiredRoot = [
  "dev:web",
  "build:electron",
  "typecheck",
  "test"
];

const requiredWeb = [
  "dev",
  "build",
  "typecheck",
  "lint",
  "test"
];

for (const name of requiredRoot) {
  if (!root.scripts?.[name]) {
    console.error(`ERROR: root script missing: ${name}`);
    process.exit(1);
  }
}

for (const name of requiredWeb) {
  if (!web.scripts?.[name]) {
    console.error(`ERROR: web script missing: ${name}`);
    process.exit(1);
  }
}

if (!web.dependencies?.react || !web.dependencies?.["react-dom"]) {
  console.error("ERROR: React runtime dependencies missing");
  process.exit(1);
}

console.log("Workspace contract: PASS");
console.log("Web package contract: PASS");
NODE

echo
echo "===== FORBIDDEN PRODUCTION ARTIFACT SCAN ====="

if grep -RInE \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude='*.lock' \
  'mock|mocked|simulation|simulate|placeholder|fake response|demo response|TODO.*provider|YOUR_API_KEY|sk-[A-Za-z0-9_-]{20,}' \
  packages scripts traveler-dev 2>/dev/null; then
  echo
  echo "ERROR: forbidden/mock/development artifact detected."
  exit 1
fi

echo "Production artifact scan: PASS"

echo
echo "===== ENVIRONMENT CONTRACT ====="

for file in \
  .env \
  .env.local \
  .env.production \
  packages/web/.env \
  packages/web/.env.local \
  packages/web/.env.production
do
  if [ -f "$file" ]; then
    echo "WARNING: local environment file exists: $file"
  fi
done

echo
echo "Audit completed without structural failure."
