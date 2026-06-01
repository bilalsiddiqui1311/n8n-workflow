#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENT_DIR="$HOME/Library/LaunchAgents"
LOG_DIR="$ROOT_DIR/.logs"
mkdir -p "$AGENT_DIR" "$LOG_DIR"

cat >"$AGENT_DIR/com.n8nlocal.kam-codex-runner.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.n8nlocal.kam-codex-runner</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$ROOT_DIR/scripts/start-codex-runner.sh</string>
  </array>
  <key>WorkingDirectory</key><string>$ROOT_DIR</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOG_DIR/codex-runner.log</string>
  <key>StandardErrorPath</key><string>$LOG_DIR/codex-runner.err.log</string>
</dict>
</plist>
PLIST

cat >"$AGENT_DIR/com.n8nlocal.n8n.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.n8nlocal.n8n</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$ROOT_DIR/scripts/start-host-n8n.sh</string>
  </array>
  <key>WorkingDirectory</key><string>$ROOT_DIR</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOG_DIR/n8n.log</string>
  <key>StandardErrorPath</key><string>$LOG_DIR/n8n.err.log</string>
</dict>
</plist>
PLIST

cat >"$AGENT_DIR/com.n8nlocal.whatsapp-bridge.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.n8nlocal.whatsapp-bridge</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$ROOT_DIR/scripts/start-host-whatsapp-bridge.sh</string>
  </array>
  <key>WorkingDirectory</key><string>$ROOT_DIR</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOG_DIR/whatsapp-bridge.log</string>
  <key>StandardErrorPath</key><string>$LOG_DIR/whatsapp-bridge.err.log</string>
</dict>
</plist>
PLIST

for label in com.n8nlocal.kam-codex-runner com.n8nlocal.n8n com.n8nlocal.whatsapp-bridge; do
  launchctl bootout "gui/$(id -u)" "$AGENT_DIR/$label.plist" >/dev/null 2>&1 || true
done

launchctl bootstrap "gui/$(id -u)" "$AGENT_DIR/com.n8nlocal.kam-codex-runner.plist"
launchctl bootstrap "gui/$(id -u)" "$AGENT_DIR/com.n8nlocal.n8n.plist"
launchctl bootstrap "gui/$(id -u)" "$AGENT_DIR/com.n8nlocal.whatsapp-bridge.plist"

echo "Started host services via LaunchAgent."
echo "n8n: http://localhost:${N8N_PORT:-5678}"
echo "WhatsApp QR: http://localhost:${WHATSAPP_BRIDGE_PORT:-3001}/qr"
echo "Logs: $LOG_DIR"
