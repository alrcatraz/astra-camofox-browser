#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SERVER_PID=""
LOG_FILE="/tmp/jo-browser-proxy-test.log"

cleanup() {
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

prompt_var() {
  local name="$1"
  local secret="${2:-0}"
  local default_value="${3:-}"
  if [[ -n "${!name:-}" ]]; then
    return
  fi

  if [[ "$secret" == "1" ]]; then
    read -r -s -p "$name: " value
    echo
  else
    if [[ -n "$default_value" ]]; then
      read -r -p "$name [$default_value]: " value
      value="${value:-$default_value}"
    else
      read -r -p "$name: " value
    fi
  fi

  export "$name=$value"
}

wait_for_health() {
  local retries="${1:-30}"
  local url="${2:-http://127.0.0.1:9377/health}"
  for _ in $(seq 1 "$retries"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

ensure_deps() {
  if [[ ! -d node_modules ]]; then
    echo "==> Installing npm dependencies"
    npm install
  fi

  if ! npx camoufox-js --version >/dev/null 2>&1; then
    echo "==> Fetching Camoufox"
    npx camoufox-js fetch
  fi
}

prompt_var PROXY_HOST 0 gate.decodo.com
prompt_var PROXY_PORT 0 7000
prompt_var PROXY_USERNAME 0
prompt_var PROXY_PASSWORD 1

ensure_deps

echo "==> Testing proxy directly against Decodo"
PROXY_JSON="$(curl --fail --silent --show-error \
  --proxy "http://$PROXY_HOST:$PROXY_PORT" \
  --proxy-user "$PROXY_USERNAME:$PROXY_PASSWORD" \
  https://ip.decodo.com/json)"

export PROXY_JSON
python3 - <<'PY'
import json
import os

payload = json.loads(os.environ["PROXY_JSON"])
print("Proxy IP:", payload.get("proxy", {}).get("ip", "<missing>"))
country = payload.get("country", {}).get("name")
city = payload.get("city", {}).get("name")
state = payload.get("city", {}).get("state")
isp = payload.get("isp", {}).get("organization") or payload.get("isp", {}).get("isp")
if country:
    print("Country:", country)
if state:
    print("State:", state)
if city:
    print("City:", city)
if isp:
    print("ISP:", isp)
PY

echo "==> Starting jo-browser locally on http://127.0.0.1:9377"
: > "$LOG_FILE"
CAMOFOX_PORT=9377 \
PROXY_HOST="$PROXY_HOST" \
PROXY_PORT="$PROXY_PORT" \
PROXY_USERNAME="$PROXY_USERNAME" \
PROXY_PASSWORD="$PROXY_PASSWORD" \
node server.js > "$LOG_FILE" 2>&1 &
SERVER_PID="$!"

if ! wait_for_health 45; then
  echo "Server failed to become healthy. Last logs:"
  tail -50 "$LOG_FILE" || true
  exit 1
fi

echo "==> Health check passed"

echo "==> Stopping local server before live tests"
cleanup
SERVER_PID=""

echo "==> Running live tests with proxy"
RUN_LIVE_TESTS=1 \
PROXY_HOST="$PROXY_HOST" \
PROXY_PORT="$PROXY_PORT" \
PROXY_USERNAME="$PROXY_USERNAME" \
PROXY_PASSWORD="$PROXY_PASSWORD" \
npm run test:live

echo
echo "Done. Check Decodo Residential -> Usage statistics for matching traffic and requests."
echo "Server bootstrap logs were written to $LOG_FILE"
