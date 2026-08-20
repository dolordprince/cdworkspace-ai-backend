#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DIST="$ROOT/packages/local-web/dist"
ARTIFACTS="$ROOT/.traveler-dev/artifacts"
DOWNLOADS="$DIST/downloads"

mkdir -p "$DOWNLOADS"

echo "============================================================"
echo " traveler_dev — DOWNLOAD ARTIFACT PREPARATION"
echo "============================================================"

if [[ ! -d "$DIST" ]]; then
  echo "[FAIL] Production dist does not exist"
  exit 1
fi

rm -rf "$DOWNLOADS"
mkdir -p "$DOWNLOADS"

if [[ -d "$ARTIFACTS" ]]; then
  find "$ARTIFACTS" -maxdepth 1 -type f -exec cp -f {} "$DOWNLOADS/" \;
fi

cat > "$DOWNLOADS/index.json" <<JSON
{
  "project": "traveler_dev",
  "generated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "artifacts": [
JSON

first=1
while IFS= read -r -d '' file; do
  name="$(basename "$file")"

  if [[ "$first" -eq 0 ]]; then
    printf ',\n' >> "$DOWNLOADS/index.json"
  fi

  printf '    "%s"' "$name" >> "$DOWNLOADS/index.json"
  first=0
done < <(find "$DOWNLOADS" -maxdepth 1 -type f \
  ! -name index.json \
  -print0 | sort -z)

cat >> "$DOWNLOADS/index.json" <<'JSON'
  ]
}
JSON

echo "[PASS] Download directory prepared"
echo "[PASS] $DOWNLOADS"

find "$DOWNLOADS" -maxdepth 1 -type f -printf '%f\n' | sort
