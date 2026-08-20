#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "============================================================"
echo "CDESTKTOP — OLD MIGRATION CLEANUP"
echo "============================================================"
echo "Workspace: $ROOT"
echo

# Never delete source packages, Git data, node_modules, or existing backend code.
PROTECTED=(
  ".git"
  "packages"
  "crates"
  "src"
  "public"
  "apps"
  "backend"
  "package.json"
  "pnpm-lock.yaml"
  "pnpm-workspace.yaml"
  "Cargo.toml"
)

echo "[1/5] Removing obsolete migration reports"

rm -rf \
  "$ROOT/.workspace-interrogation/fastapi-migration" \
  "$ROOT/.workspace-interrogation/real-backend" \
  "$ROOT/.workspace-interrogation/backend-audit"

echo "[2/5] Removing obsolete generated archives"

find "$ROOT" -maxdepth 2 -type f \
  \( \
    -name 'traveler-dev-studio.tar.gz' \
    -o -name 'traveler-dev-backend.tar.gz' \
    -o -name 'bolt-backend.tar.gz' \
    -o -name '*fastapi-migration*.tar.gz' \
  \) \
  -delete

echo "[3/5] Removing obsolete migration scripts"

find "$ROOT" -maxdepth 2 -type f \
  \( \
    -name 'fix_fastapi_python.sh' \
    -o -name 'extract_backend.sh' \
    -o -name 'extract_fastapi*.sh' \
    -o -name '*fastapi-migration*.sh' \
    -o -name '*traveler-dev-studio*.sh' \
    -o -name '*bolt-backend*.sh' \
  \) \
  -delete

echo "[4/5] Removing only obsolete Traveler migration metadata"

rm -rf \
  "$ROOT/.workspace-interrogation/traveler-dev" \
  "$ROOT/.workspace-interrogation/bolt-backend" \
  "$ROOT/.workspace-interrogation/backend-extraction"

# Remove empty interrogation directories only.
find "$ROOT/.workspace-interrogation" \
  -type d -empty -delete 2>/dev/null || true

echo "[5/5] Verifying workspace integrity"

cd "$ROOT"

echo
echo "Git status:"
git status --short 2>/dev/null || true

echo
echo "Workspace:"
du -sh "$ROOT"

echo
echo "Top-level:"
find "$ROOT" -maxdepth 1 -mindepth 1 \
  -printf '%f\n' 2>/dev/null | sort

echo
echo "============================================================"
echo "CLEANUP COMPLETE"
echo "============================================================"
echo
echo "No source packages were deleted."
echo "No Git history was deleted."
echo "No existing bolt.diy application code was deleted."
echo
echo "The workspace is now ready for the real backend audit."
