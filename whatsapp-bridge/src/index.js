import http from "node:http";
import { URL } from "node:url";
import qrcode from "qrcode";
import qrcodeTerminal from "qrcode-terminal";
import pkg from "whatsapp-web.js";

const { Client, LocalAuth } = pkg;

const port = Number(process.env.BRIDGE_PORT || 3000);
const webhookUrl = process.env.N8N_WEBHOOK_URL || "http://n8n:5678/webhook/whatsapp-group-intake";
const intakeSecret = process.env.KAM_INTAKE_SECRET || "";
const groupIdFilter = (process.env.GROUP_ID_FILTER || "").trim();
const groupNameFilter = (process.env.GROUP_NAME_FILTER || "").trim().toLowerCase();
const commandPrefix = process.env.COMMAND_PREFIX ?? "#kam";
const authDataPath = process.env.WHATSAPP_AUTH_DATA_PATH || "/data/.wwebjs_auth";

let currentQr = "";
let ready = false;
let lastError = "";
let lastForwardedAt = "";
let cachedGroups = [];
const seenMessageIds = new Set();
const seenMessageQueue = [];

function rememberMessageId(id) {
  seenMessageIds.add(id);
  seenMessageQueue.push(id);
  while (seenMessageQueue.length > 1000) {
    const old = seenMessageQueue.shift();
    seenMessageIds.delete(old);
  }
}

function matchesGroup(chat) {
  const chatId = chat?.id?._serialized || "";
  const chatName = chat?.name || "";
  if (groupIdFilter && chatId !== groupIdFilter) return false;
  if (groupNameFilter && !chatName.toLowerCase().includes(groupNameFilter)) return false;
  return true;
}

function stripPrefix(text) {
  if (!commandPrefix) return text.trim();
  const trimmed = text.trim();
  if (!trimmed.toLowerCase().startsWith(commandPrefix.toLowerCase())) return "";
  return trimmed.slice(commandPrefix.length).trim();
}

function safeJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

async function refreshGroups(client) {
  const chats = await client.getChats();
  cachedGroups = chats
    .filter((chat) => chat.isGroup)
    .map((chat) => ({
      id: chat.id?._serialized || "",
      name: chat.name || "",
      unreadCount: chat.unreadCount || 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function forwardToN8n(payload) {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-kam-intake-secret": intakeSecret,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`n8n webhook returned ${response.status}: ${text.slice(0, 500)}`);
  }
  return text;
}

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: authDataPath }),
  puppeteer: {
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-extensions",
    ],
  },
});

client.on("qr", (qr) => {
  currentQr = qr;
  ready = false;
  console.log("Scan this WhatsApp QR code, or open http://localhost:3001/qr");
  qrcodeTerminal.generate(qr, { small: true });
});

client.on("ready", async () => {
  currentQr = "";
  ready = true;
  lastError = "";
  console.log("WhatsApp bridge is ready.");
  try {
    await refreshGroups(client);
    console.log(`Detected ${cachedGroups.length} WhatsApp groups. Open http://localhost:3001/groups`);
  } catch (error) {
    lastError = error.message;
    console.error("Could not load groups:", error);
  }
});

client.on("auth_failure", (message) => {
  ready = false;
  lastError = `WhatsApp auth failure: ${message}`;
  console.error(lastError);
});

client.on("disconnected", (reason) => {
  ready = false;
  lastError = `WhatsApp disconnected: ${reason}`;
  console.error(lastError);
});

client.on("message", async (message) => {
  const messageId = message.id?._serialized || "";
  if (!messageId || seenMessageIds.has(messageId)) return;
  rememberMessageId(messageId);

  try {
    const chat = await message.getChat();
    if (!chat.isGroup || !matchesGroup(chat)) return;

    const rawText = message.body || message.caption || "";
    const text = stripPrefix(rawText);
    if (!text) return;

    const contact = await message.getContact();
    const payload = {
      source: "whatsapp-web.js",
      receivedAt: new Date().toISOString(),
      group: {
        id: chat.id?._serialized || "",
        name: chat.name || "",
      },
      sender: {
        id: contact.id?._serialized || message.author || "",
        name: contact.pushname || contact.name || contact.number || "",
        number: contact.number || "",
      },
      message: {
        id: messageId,
        timestamp: message.timestamp,
        type: message.type,
        text,
        rawText,
        hasMedia: Boolean(message.hasMedia),
      },
    };

    await forwardToN8n(payload);
    lastForwardedAt = payload.receivedAt;
    console.log(`Forwarded message ${messageId} from ${chat.name}`);
  } catch (error) {
    lastError = error.message;
    console.error("Message handling failed:", error);
  }
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/health") {
    return safeJson(res, 200, { ok: true, ready, lastError, lastForwardedAt });
  }

  if (url.pathname === "/status") {
    return safeJson(res, 200, {
      ok: true,
      ready,
      lastError,
      lastForwardedAt,
      filters: {
        groupIdFilter,
        groupNameFilter,
        commandPrefix,
      },
      webhookUrl,
    });
  }

  if (url.pathname === "/groups") {
    if (!ready) return safeJson(res, 503, { ok: false, error: "WhatsApp is not ready yet. Scan /qr first." });
    try {
      await refreshGroups(client);
      return safeJson(res, 200, { ok: true, groups: cachedGroups });
    } catch (error) {
      lastError = error.message;
      return safeJson(res, 500, { ok: false, error: error.message });
    }
  }

  if (url.pathname === "/qr") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    if (!currentQr) {
      res.end(`<html><body><h1>WhatsApp bridge</h1><p>${ready ? "Ready" : "Waiting for QR..."}</p></body></html>`);
      return;
    }
    const dataUrl = await qrcode.toDataURL(currentQr, { margin: 1, width: 360 });
    res.end(`
      <html>
        <body style="font-family: system-ui, sans-serif; margin: 2rem;">
          <h1>Scan WhatsApp QR</h1>
          <img src="${dataUrl}" width="360" height="360" />
          <p>WhatsApp > Linked devices > Link a device</p>
        </body>
      </html>
    `);
    return;
  }

  safeJson(res, 404, { ok: false, error: "Not found" });
});

server.listen(port, () => {
  console.log(`WhatsApp bridge status server listening on ${port}`);
  console.log(`Forwarding matching messages to ${webhookUrl}`);
});

client.initialize();
