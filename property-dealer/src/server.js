import express from "express";
import multer from "multer";
import nodemailer from "nodemailer";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const uploadDir = path.join(appRoot, "uploads");
const publicDir = path.join(appRoot, "public");

const port = Number(process.env.PROPERTY_APP_PORT || 4040);
const whatsappSendUrl = process.env.PROPERTY_WHATSAPP_SEND_URL || "http://127.0.0.1:3001/send";
const whatsappSendToken = process.env.PROPERTY_WHATSAPP_SEND_TOKEN || process.env.WHATSAPP_SEND_TOKEN || process.env.KAM_INTAKE_SECRET || "";
const gmailUser = process.env.GMAIL_USER || "";
const gmailAppPassword = process.env.GMAIL_APP_PASSWORD || "";
const gmailFromName = process.env.GMAIL_FROM_NAME || "Property Team";

await fs.mkdir(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

const app = express();
app.use(express.static(publicDir));

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeKey(key) {
  return String(key || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function pick(row, keys) {
  for (const key of keys) {
    const value = row[normalizeKey(key)];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

function normalizePhone(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

function normalizeRow(row, index) {
  const normalized = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[normalizeKey(key)] = value;
  }

  const name = pick(normalized, ["name", "client_name", "full_name", "contact_name"]);
  const firstName = name.split(/\s+/).filter(Boolean)[0] || "there";
  const phoneRaw = pick(normalized, ["phone", "mobile", "number", "contact_number", "whatsapp", "whatsapp_number"]);
  const email = pick(normalized, ["email", "email_address", "gmail"]);

  return {
    ...normalized,
    rowNumber: index + 2,
    name,
    firstName,
    first_name: firstName,
    firstname: firstName,
    phoneRaw,
    phone_raw: phoneRaw,
    phone: normalizePhone(phoneRaw),
    email,
  };
}

function readContacts(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: false, raw: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
  return rows.map(normalizeRow).filter((contact) => contact.phone || contact.email);
}

function renderTemplate(template, contact) {
  return String(template || "").replace(/\{\{\s*([a-zA-Z0-9_ -]+)\s*\}\}/g, (_match, key) => {
    const normalizedKey = normalizeKey(key);
    const value = contact[normalizedKey] ?? contact[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

function hasHtml(value) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function toHtml(value) {
  const text = String(value || "");
  if (hasHtml(text)) return text;
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

function getMailer() {
  if (!gmailUser || !gmailAppPassword) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: gmailUser,
      pass: gmailAppPassword,
    },
  });
}

async function sendWhatsApp(contact, message) {
  if (!whatsappSendToken) {
    throw new Error("PROPERTY_WHATSAPP_SEND_TOKEN is not configured");
  }

  const response = await fetch(whatsappSendUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${whatsappSendToken}`,
    },
    body: JSON.stringify({
      phone: contact.phone,
      message,
      contactName: contact.name,
    }),
  });

  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }

  if (!response.ok) {
    throw new Error(body.error || `WhatsApp bridge returned ${response.status}`);
  }

  return body;
}

async function sendEmail(mailer, contact, subject, html) {
  if (!mailer) {
    throw new Error("GMAIL_USER and GMAIL_APP_PASSWORD are not configured");
  }

  return mailer.sendMail({
    from: `"${gmailFromName}" <${gmailUser}>`,
    to: contact.email,
    subject,
    html,
  });
}

function parseBoolean(value) {
  return ["true", "1", "yes", "on"].includes(String(value || "").toLowerCase());
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    whatsapp: {
      configured: Boolean(whatsappSendUrl && whatsappSendToken),
      url: whatsappSendUrl,
    },
    gmail: {
      configured: Boolean(gmailUser && gmailAppPassword),
      user: gmailUser,
    },
  });
});

app.post("/api/campaign", upload.single("contacts"), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ ok: false, error: "Upload an Excel or CSV contact file" });
  }

  const sendWhatsapp = parseBoolean(req.body.sendWhatsapp);
  const sendEmailChannel = parseBoolean(req.body.sendEmail);
  const dryRun = parseBoolean(req.body.dryRun);
  const delayMs = Math.max(0, Math.min(Number(req.body.delayMs || 500), 10000));
  const whatsappTemplate = String(req.body.whatsappMessage || "").trim();
  const emailSubjectTemplate = String(req.body.emailSubject || "").trim();
  const emailBodyTemplate = String(req.body.emailBody || "").trim();

  try {
    if (!sendWhatsapp && !sendEmailChannel) {
      return res.status(400).json({ ok: false, error: "Choose WhatsApp, email, or both" });
    }

    if (sendWhatsapp && !whatsappTemplate) {
      return res.status(400).json({ ok: false, error: "Enter a WhatsApp message" });
    }

    if (sendEmailChannel && (!emailSubjectTemplate || !emailBodyTemplate)) {
      return res.status(400).json({ ok: false, error: "Enter an email subject and body" });
    }

    const contacts = readContacts(file.path);
    const mailer = sendEmailChannel && !dryRun ? getMailer() : null;
    const results = [];

    for (const contact of contacts) {
      const result = {
        rowNumber: contact.rowNumber,
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
        whatsapp: "skipped",
        emailStatus: "skipped",
        errors: [],
      };

      if (sendWhatsapp && contact.phone) {
        const message = renderTemplate(whatsappTemplate, contact);
        result.whatsappMessage = message;
        if (dryRun) {
          result.whatsapp = "dry-run";
        } else {
          try {
            await sendWhatsApp(contact, message);
            result.whatsapp = "sent";
          } catch (error) {
            result.whatsapp = "failed";
            result.errors.push(`WhatsApp: ${error.message}`);
          }
        }
      }

      if (sendEmailChannel && contact.email) {
        const subject = renderTemplate(emailSubjectTemplate, contact);
        const html = toHtml(renderTemplate(emailBodyTemplate, contact));
        result.emailSubject = subject;
        if (dryRun) {
          result.emailStatus = "dry-run";
        } else {
          try {
            await sendEmail(mailer, contact, subject, html);
            result.emailStatus = "sent";
          } catch (error) {
            result.emailStatus = "failed";
            result.errors.push(`Email: ${error.message}`);
          }
        }
      }

      if (sendWhatsapp && !contact.phone) result.errors.push("Missing phone");
      if (sendEmailChannel && !contact.email) result.errors.push("Missing email");

      results.push(result);
      if (!dryRun && delayMs > 0) await sleep(delayMs);
    }

    res.json({
      ok: true,
      dryRun,
      totalContacts: contacts.length,
      counts: {
        whatsappSent: results.filter((item) => item.whatsapp === "sent").length,
        emailSent: results.filter((item) => item.emailStatus === "sent").length,
        failed: results.filter((item) => item.errors.length > 0).length,
      },
      results,
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  } finally {
    await fs.rm(file.path, { force: true }).catch(() => {});
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Property Dealer app listening on http://127.0.0.1:${port}`);
});
