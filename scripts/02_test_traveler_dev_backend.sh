#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL="${1:-https://cdworkspace-ai-backend.onrender.com}"

echo "===== TRAVELER DEV REMOTE CONTRACT TEST ====="
echo "BASE: $BASE_URL"

curl -fsS --connect-timeout 15 --max-time 45 \
  "$BASE_URL/health" | python3 -m json.tool

echo
echo "===== PROVIDER STATUS ====="

curl -fsS --connect-timeout 15 --max-time 45 \
  "$BASE_URL/api/provider/status" | python3 -m json.tool

echo
echo "===== CLOUDFLARE STATUS ====="

curl -fsS --connect-timeout 15 --max-time 45 \
  "$BASE_URL/api/cloudflare/status" | python3 -m json.tool

echo
echo "===== MCP INITIALIZE ====="

curl -fsS --connect-timeout 15 --max-time 45 \
  "$BASE_URL/mcp/initialize" | python3 -m json.tool

echo
echo "===== MCP TOOLS ====="

curl -fsS --connect-timeout 15 --max-time 45 \
  "$BASE_URL/mcp/tools" | python3 -m json.tool

echo
echo "[PASS] Traveler Dev remote contract endpoints responded."
