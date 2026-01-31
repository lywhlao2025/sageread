#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="${SAGEREAD_SERVER_DIR:-$ROOT_DIR/../sageReadServer}"
SERVER_PORT="${SAGEREAD_SERVER_PORT:-8080}"
SERVER_URL="${SAGEREAD_SERVER_URL:-http://127.0.0.1:$SERVER_PORT}"

wait_for_port() {
  local port="$1"
  local retries=60
  local wait=1
  for _ in $(seq 1 $retries); do
    if lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
      return 0
    fi
    sleep "$wait"
  done
  return 1
}

start_server_if_needed() {
  if lsof -iTCP:"$SERVER_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "[integration] backend already running on $SERVER_PORT"
    return 0
  fi

  echo "[integration] starting backend in $SERVER_DIR"
  (
    cd "$SERVER_DIR"
    ./mvnw -q spring-boot:run -Dspring-boot.run.profiles=dev >/tmp/sageread-integration-server.log 2>&1 &
    echo $! > /tmp/sageread-integration-server.pid
  )

  if ! wait_for_port "$SERVER_PORT"; then
    echo "[integration] backend failed to start on port $SERVER_PORT"
    if [ -f /tmp/sageread-integration-server.log ]; then
      echo "[integration] backend log tail:"
      tail -n 120 /tmp/sageread-integration-server.log
    fi
    exit 1
  fi
  echo "[integration] backend is up"
}

stop_server_if_started() {
  if [ -f /tmp/sageread-integration-server.pid ]; then
    local pid
    pid=$(cat /tmp/sageread-integration-server.pid)
    if ps -p "$pid" >/dev/null 2>&1; then
      echo "[integration] stopping backend pid=$pid"
      kill "$pid" || true
    fi
    rm -f /tmp/sageread-integration-server.pid
  fi
}

run_backend_smoke() {
  echo "[integration] backend smoke: public highlights list"
  curl -sS "$SERVER_URL/api/public-highlights/list?bookKey=integration-smoke&limit=1&offset=0" >/tmp/sageread-integration-public-highlights.json
  echo "[integration] backend smoke: response saved"

  if [ -n "${SAGEREAD_SIMPLE_MODE_TOKEN:-}" ]; then
    echo "[integration] backend smoke: simple-mode stream (token provided)"
    curl -sS -N \
      -H "Authorization: Bearer $SAGEREAD_SIMPLE_MODE_TOKEN" \
      -H "Content-Type: application/json" \
      -H "Accept: text/event-stream" \
      -d '{"taskType":"chat","requestId":"integration-smoke","messages":[{"role":"user","content":"hello"}]}' \
      "$SERVER_URL/api/simple-mode/llm" 2>/tmp/sageread-integration-simple-mode.err \
      | head -n 20 >/tmp/sageread-integration-simple-mode.txt || true
    echo "[integration] simple-mode stream saved"
  else
    echo "[integration] skip simple-mode stream (SAGEREAD_SIMPLE_MODE_TOKEN not set)"
  fi
}

main() {
  trap stop_server_if_started EXIT
  start_server_if_needed
  run_backend_smoke
  echo "[integration] done"
}

main "$@"
