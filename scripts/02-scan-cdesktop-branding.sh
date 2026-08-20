#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

OLD_NAMES=(
  "Workspace UI"
  "WorkspaceUI"
  "workspace_ui"
  "workspace-ui"
  "cdesktop"
)

OUT=".workspace-interrogation/cdesktop-main/branding-scan.txt"
mkdir -p "$(dirname "$OUT")"

: > "$OUT"

echo "===== CDESKTOP BRANDING SCAN =====" | tee -a "$OUT"
echo "ROOT=$ROOT" | tee -a "$OUT"
echo | tee -a "$OUT"

for NAME in "${OLD_NAMES[@]}"; do
    echo "===== SEARCH: $NAME =====" | tee -a "$OUT"

    grep -RniF \
      --exclude-dir=.git \
      --exclude-dir=node_modules \
      --exclude-dir=dist \
      --exclude-dir=build \
      --exclude-dir=.venv \
      --exclude-dir=__pycache__ \
      "$NAME" \
      . 2>/dev/null \
      | head -n 300 \
      | tee -a "$OUT" || true

    echo | tee -a "$OUT"
done

echo
echo "[PASS] Branding scan completed."
echo "Review:"
echo "$ROOT/$OUT"
