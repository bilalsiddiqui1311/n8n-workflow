import http from "node:http";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const promptPath = path.resolve(__dirname, "..", "prompts", "kam-system-prompt.md");
const port = Number(process.env.CODEX_RUNNER_PORT || 4777);
const runnerToken = process.env.KAM_RUNNER_TOKEN || "";
const codexBin = process.env.CODEX_BIN || "/usr/local/bin/codex";
const codexCwd = process.env.KAM_CODEX_CWD || path.join(repoRoot, "kam-workspace");
const codexModel = process.env.KAM_CODEX_MODEL || "";
const timeoutMs = Number(process.env.KAM_CODEX_TIMEOUT_MS || 300000);

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

function readBody(req, limitBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > limitBytes) {
        reject(new Error("Request body is too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function authorized(req) {
  if (!runnerToken) return true;
  const auth = req.headers.authorization || "";
  const headerToken = req.headers["x-kam-runner-token"] || "";
  return auth === `Bearer ${runnerToken}` || headerToken === runnerToken;
}

function safeName(value) {
  return String(value || "message").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80);
}

async function runCodex(event) {
  const systemPrompt = await readFile(promptPath, "utf8");
  await mkdir(path.join(codexCwd, "inbox"), { recursive: true });
  await mkdir(path.join(codexCwd, "results"), { recursive: true });

  const messageId = safeName(event?.message?.id || Date.now());
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const inboxFile = path.join(codexCwd, "inbox", `${stamp}-${messageId}.json`);
  const resultFile = path.join(codexCwd, "results", `${stamp}-${messageId}.md`);
  const lastMessageFile = path.join(os.tmpdir(), `kam-codex-${stamp}-${messageId}.txt`);
  const stdoutFile = path.join(os.tmpdir(), `kam-codex-${stamp}-${messageId}.stdout.log`);
  const stderrFile = path.join(os.tmpdir(), `kam-codex-${stamp}-${messageId}.stderr.log`);

  await writeFile(inboxFile, JSON.stringify(event, null, 2));

  const prompt = [
    systemPrompt.trim(),
    "",
    "Process this incoming WhatsApp group event for KAM intelligence.",
    "",
    "Incoming event JSON:",
    "```json",
    JSON.stringify(event, null, 2),
    "```",
  ].join("\n");

  const args = [
    "exec",
    "--cd",
    codexCwd,
    "--sandbox",
    "workspace-write",
    "--output-last-message",
    lastMessageFile,
    "--ephemeral",
  ];

  if (codexModel) {
    args.push("--model", codexModel);
  }

  args.push("-");

  const child = spawn(codexBin, args, {
    cwd: codexCwd,
    env: process.env,
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  child.stdin.end(prompt);

  const runState = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({ timedOut: true, code: null, signal: "SIGTERM" });
    }, timeoutMs);

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("exit", (code, signal) => {
      clearTimeout(timer);
      resolve({ timedOut: false, code, signal });
    });
  });

  await writeFile(stdoutFile, stdout);
  await writeFile(stderrFile, stderr);

  let output = "";
  try {
    output = await readFile(lastMessageFile, "utf8");
  } catch {
    output = stderr || "Codex did not produce a final message.";
  }

  await writeFile(resultFile, output);

  return {
    ok: !runState.timedOut && runState.code === 0,
    timedOut: runState.timedOut,
    exitCode: runState.code,
    signal: runState.signal,
    inboxFile,
    resultFile,
    stdoutFile,
    stderrFile,
    output,
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    return sendJson(res, 200, {
      ok: true,
      codexBin,
      codexCwd,
      hasRunnerToken: Boolean(runnerToken),
    });
  }

  if (req.method !== "POST" || req.url !== "/run") {
    return sendJson(res, 404, { ok: false, error: "Not found" });
  }

  if (!authorized(req)) {
    return sendJson(res, 401, { ok: false, error: "Unauthorized" });
  }

  try {
    const rawBody = await readBody(req);
    const event = rawBody ? JSON.parse(rawBody) : {};
    const result = await runCodex(event);
    sendJson(res, result.ok ? 200 : 504, result);
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`KAM Codex runner listening on http://127.0.0.1:${port}`);
  console.log(`Codex workspace: ${codexCwd}`);
});
