# Local n8n WhatsApp to Codex KAM Workflow

This project runs a local workflow that listens for selected WhatsApp group messages, forwards them into n8n, and asks the local authenticated Codex CLI to process them as KAM intelligence.

## Architecture

1. `whatsapp-bridge` uses a local WhatsApp Web session and forwards matching group messages to n8n.
2. `n8n` receives the webhook, builds a structured KAM payload, and calls the host Codex runner.
3. `codex-runner` runs `codex exec` on this Mac and writes outputs to `kam-workspace/results`.

The Codex runner is host-side because `/usr/local/bin/codex` is a macOS binary and cannot execute inside the Linux n8n Docker container.

## Important WhatsApp Note

Official WhatsApp Business Cloud API is intended for business phone-number messaging, not arbitrary consumer WhatsApp group monitoring. This setup uses WhatsApp Web automation through `whatsapp-web.js`; use it only for groups where you have permission to process messages, and keep the workflow local/private.

## Start With Docker

```bash
chmod +x scripts/*.sh
./scripts/start-local.sh
```

Then import and activate the n8n workflow:

```bash
./scripts/import-workflow.sh
```

Open:

- n8n: `http://localhost:5678`
- WhatsApp QR: `http://localhost:3001/qr`
- WhatsApp bridge status: `http://localhost:3001/status`
- Codex runner health: `http://127.0.0.1:4777/health`

## Pick A Group

After scanning the QR:

```bash
curl http://localhost:3001/groups
```

Copy either a group `id` into `WHATSAPP_GROUP_ID_FILTER` or a unique part of the group name into `WHATSAPP_GROUP_NAME_FILTER` in `.env`, then restart:

```bash
./scripts/stop-local.sh
./scripts/start-local.sh
./scripts/import-workflow.sh
```

By default, only messages beginning with `#kam` are forwarded. To forward every message from the filtered group, set `WHATSAPP_COMMAND_PREFIX=` in `.env`.

## Test Without WhatsApp

```bash
./scripts/smoke-test.sh
```

The Codex response will be returned by the webhook and saved in:

```text
kam-workspace/results/
```

## Host Fallback

If Docker cannot pull images because of a local certificate/proxy issue, run the same workflow on the host:

```bash
./scripts/import-workflow-host.sh
./scripts/start-screen-local.sh
```

Stop it with:

```bash
./scripts/stop-screen-local.sh
```

There is also a LaunchAgent starter at `scripts/start-host-local.sh`, but macOS may block it from reading projects inside `~/Documents` unless Terminal/Codex has the right privacy permissions.

## Customize The KAM Prompt

Edit:

```text
codex-runner/prompts/kam-system-prompt.md
```

The n8n workflow payload builder lives in:

```text
n8n/workflows/kam-whatsapp-group-intake.json
```

## Stop

```bash
./scripts/stop-local.sh
```
