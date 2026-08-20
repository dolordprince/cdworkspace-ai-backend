#!/usr/bin/env bash
set -Eeuo pipefail

HOST="cdworkspace-ai-backend.onrender.com"
BASE="https://${HOST}"

echo "===== traveler_dev RENDER HTTPS AUDIT ====="

echo
echo "===== DNS ====="

getent ahosts "$HOST" || true

echo
echo "===== TCP 443 ====="

if command -v nc >/dev/null 2>&1; then
    nc -vz -w 15 "$HOST" 443 || true
else
    timeout 15 bash -c "cat < /dev/null > /dev/tcp/${HOST}/443" \
        && echo "[PASS] TCP 443 reachable" \
        || echo "[FAIL] TCP 443 connection failed"
fi

echo
echo "===== CURL TLS ====="

curl -4 \
    --verbose \
    --connect-timeout 20 \
    --max-time 45 \
    --http1.1 \
    -o /tmp/traveler-render-health.txt \
    -w '\nHTTP_CODE=%{http_code}\nREMOTE_IP=%{remote_ip}\nSSL_VERIFY=%{ssl_verify_result}\nTIME_CONNECT=%{time_connect}\nTIME_TLS=%{time_appconnect}\nTIME_TOTAL=%{time_total}\n' \
    "${BASE}/health" \
    2>&1 || true

echo
echo "===== HEALTH BODY ====="

if [ -s /tmp/traveler-render-health.txt ]; then
    cat /tmp/traveler-render-health.txt
else
    echo "[INFO] No HTTP response body received"
fi

echo
echo "===== ROOT ENDPOINT ====="

curl -4 \
    --connect-timeout 20 \
    --max-time 45 \
    --http1.1 \
    -i \
    "${BASE}/" \
    || true

echo
echo "===== OPTIONS ====="

curl -4 \
    --connect-timeout 20 \
    --max-time 45 \
    --http1.1 \
    -i \
    -X OPTIONS \
    "${BASE}/health" \
    || true

echo
echo "===== TLS CERTIFICATE ====="

if command -v openssl >/dev/null 2>&1; then
    timeout 30 openssl s_client \
        -connect "${HOST}:443" \
        -servername "$HOST" \
        -brief </dev/null 2>&1 || true
fi

echo
echo "===== RESULT ====="
echo
echo "DNS resolution is already confirmed."
echo "If TCP 443 succeeds but HTTPS aborts, inspect the Render service."
echo "If TCP 443 fails, inspect the local network/proot connection."
echo "If /health returns HTTP 404, the service is alive and only the health path is wrong."
echo "If /health returns 5xx, the Render FastAPI application is failing."
echo "If HTTPS succeeds, CDesktop can use the existing Render URL."
