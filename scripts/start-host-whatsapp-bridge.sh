#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
set -a
source "$ROOT_DIR/.env"
set +a
NODE_BIN="${LOCAL_NODE_BIN:-node}"
NPM_CLI="${LOCAL_NPM_CLI:-/usr/local/lib/node_modules/npm/bin/npm-cli.js}"
NODE_DIR="$(dirname "$NODE_BIN")"
export PATH="$NODE_DIR:$PATH"

export BRIDGE_PORT="${WHATSAPP_BRIDGE_PORT:-3001}"
export N8N_WEBHOOK_URL="http://127.0.0.1:${N8N_PORT:-5678}/webhook/whatsapp-group-intake"
export GROUP_ID_FILTER="${WHATSAPP_GROUP_ID_FILTER:-}"
export GROUP_NAME_FILTER="${WHATSAPP_GROUP_NAME_FILTER:-}"
export COMMAND_PREFIX="${WHATSAPP_COMMAND_PREFIX:-#kam}"
export WHATSAPP_AUTH_DATA_PATH="${WHATSAPP_AUTH_DATA_PATH:-$ROOT_DIR/.runtime/whatsapp-bridge-auth}"
export PUPPETEER_EXECUTABLE_PATH="${PUPPETEER_EXECUTABLE_PATH:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

mkdir -p "$WHATSAPP_AUTH_DATA_PATH"

if [[ ! -d "$ROOT_DIR/whatsapp-bridge/node_modules" ]]; then
  PUPPETEER_SKIP_DOWNLOAD=true "$NODE_BIN" "$NPM_CLI" install --prefix "$ROOT_DIR/whatsapp-bridge" --no-audit --no-fund
fi

exec "$NODE_BIN" "$NPM_CLI" --prefix "$ROOT_DIR/whatsapp-bridge" start
