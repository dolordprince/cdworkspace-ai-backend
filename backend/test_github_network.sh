#!/usr/bin/env bash
set -Eeuo pipefail

echo "============================================================"
echo "GITHUB NETWORK DIAGNOSTIC"
echo "============================================================"

echo
echo "[1] DNS"
getent ahosts api.github.com || true

echo
echo "[2] Proxy environment"
env | grep -Ei '^(HTTP|HTTPS|ALL|NO)_PROXY=' || echo "No proxy variables configured"

echo
echo "[3] Direct HTTPS connectivity"
curl -4 -v \
  --connect-timeout 10 \
  --max-time 30 \
  -H 'Accept: application/vnd.github+json' \
  -H 'X-GitHub-Api-Version: 2026-03-10' \
  https://api.github.com/ \
  -o /tmp/github-api-root.json \
  2>/tmp/github-curl.log || true

echo
echo "curl exit/result:"
if [ -s /tmp/github-api-root.json ]; then
    head -c 500 /tmp/github-api-root.json
    echo
else
    echo "No response body"
fi

echo
echo "curl transport log:"
tail -40 /tmp/github-curl.log

echo
echo "[4] GitHub CLI connectivity"
if command -v gh >/dev/null 2>&1; then
    GH_HOST=github.com gh api / --jq '.current_user_url // "GitHub API reachable"' || true
else
    echo "gh is not installed"
fi

echo
echo "[5] Python HTTP connectivity"
.venv/bin/python - <<'PY'
import os
import httpx

headers = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2026-03-10",
    "User-Agent": "cdesktop-traveler-dev/1.0",
}

token = os.getenv("GITHUB_TOKEN")
if token:
    headers["Authorization"] = f"Bearer {token}"

try:
    with httpx.Client(
        timeout=httpx.Timeout(
            connect=10.0,
            read=30.0,
            write=10.0,
            pool=10.0,
        ),
        follow_redirects=True,
        trust_env=True,
        http2=False,
    ) as client:
        r = client.get("https://api.github.com/")
        print("HTTP:", r.status_code)
        print("Server:", r.headers.get("server"))
        print("Body:", r.text[:500])

except Exception as exc:
    print(type(exc).__name__ + ":", str(exc))
    raise SystemExit(2)
PY

echo
echo "============================================================"
echo "DIAGNOSTIC COMPLETE"
echo "============================================================"
