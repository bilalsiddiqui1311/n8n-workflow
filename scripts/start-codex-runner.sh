#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
set -a
source "$ROOT_DIR/.env"
set +a
NODE_BIN="${LOCAL_NODE_BIN:-node}"

mkdir -p "$ROOT_DIR/kam-workspace/inbox" "$ROOT_DIR/kam-workspace/results"

cd "$ROOT_DIR"
exec "$NODE_BIN" "$ROOT_DIR/codex-runner/src/server.js"
