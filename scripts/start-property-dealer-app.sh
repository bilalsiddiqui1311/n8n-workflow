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

export PROPERTY_APP_PORT="${PROPERTY_APP_PORT:-4040}"
export PROPERTY_WHATSAPP_SEND_URL="${PROPERTY_WHATSAPP_SEND_URL:-http://127.0.0.1:${WHATSAPP_BRIDGE_PORT:-3001}/send}"
export PROPERTY_WHATSAPP_SEND_TOKEN="${PROPERTY_WHATSAPP_SEND_TOKEN:-${WHATSAPP_SEND_TOKEN:-${KAM_INTAKE_SECRET:-}}}"
export GMAIL_FROM_NAME="${GMAIL_FROM_NAME:-Property Team}"

if [[ ! -d "$ROOT_DIR/property-dealer/node_modules" ]]; then
  "$NODE_BIN" "$NPM_CLI" install --prefix "$ROOT_DIR/property-dealer" --no-audit --no-fund
fi

exec "$NODE_BIN" "$ROOT_DIR/property-dealer/src/server.js"
