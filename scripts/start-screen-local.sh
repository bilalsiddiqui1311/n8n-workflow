#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT_DIR/.logs"
mkdir -p "$LOG_DIR"
set -a
source "$ROOT_DIR/.env"
set +a

kill_port() {
  local port="$1"
  local pids
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    kill $pids >/dev/null 2>&1 || true
  fi
}

start_session() {
  local name="$1"
  local script="$2"
  screen -S "$name" -X quit >/dev/null 2>&1 || true
  screen -dmS "$name" /bin/bash -lc "cd '$ROOT_DIR' && '$ROOT_DIR/$script' >>'$LOG_DIR/$name.log' 2>&1"
}

kill_port "${CODEX_RUNNER_PORT:-4777}"
kill_port "${N8N_PORT:-5678}"
kill_port "${WHATSAPP_BRIDGE_PORT:-3001}"
kill_port "${PROPERTY_APP_PORT:-4040}"

start_session kam-codex-runner scripts/start-codex-runner.sh
start_session kam-n8n scripts/start-host-n8n.sh
start_session kam-whatsapp-bridge scripts/start-host-whatsapp-bridge.sh
start_session property-dealer-app scripts/start-property-dealer-app.sh

echo "Started detached screen sessions:"
screen -ls | grep -E 'kam-|property-dealer-app' || true
echo "n8n: http://localhost:${N8N_PORT:-5678}"
echo "WhatsApp QR: http://localhost:${WHATSAPP_BRIDGE_PORT:-3001}/qr"
echo "Property Dealer app: http://localhost:${PROPERTY_APP_PORT:-4040}"
