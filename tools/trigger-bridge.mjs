// Done App Trigger Bridge - launches OpenClaw agent sessions from the Done web app
// Local only (127.0.0.1), no dependencies, Node >= 18
// Run: node D:\Personal\Tasks\tools\trigger-bridge.mjs
// Endpoints:
//   GET  /health            -> { ok: true }
//   POST /trigger           -> launch agent with task context (async, returns immediately)
//   GET  /log               -> recent launches

import http from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const PORT = 8788;
const HOST = "127.0.0.1";
const TASKS_REPO = "D:\\Personal\\Tasks";
const LOG_FILE = path.join(TASKS_REPO, "tools", "trigger.log");

// Allowed origins that may POST /trigger (CSRF guard). Update if Pages URL changes.
const ALLOWED_ORIGINS = new Set([
  "https://edgeclock.github.io",
  "http://localhost",
  "http://127.0.0.1",
  "null", // file:// pages send Origin: null
]);

// [tag] -> OpenClaw agent id (task name prefix). [edge] = human, route to main.
const AGENT_MAP = {
  monica: "main",
  edge: "main",
  finna: "finna",
  podrick: "podrick",
  bibo: "bibo",
  quill: "quill",
  simmy: "simmy",
  janus: "janus",
  diane: "diane",
  neuro: "neuro",
  vay: "vay",
  js: "js",
  etch: "etch",
  geila: "geila",
};

function log(entry) {
  const line = `[${new Date().toISOString()}] ${entry}`;
  try { fs.appendFileSync(LOG_FILE, line + "\n"); } catch {}
  console.log(line);
}

function parseAgentTag(name) {
  const m = /^\[([a-z0-9-]+)\]/i.exec(String(name || "").trim());
  if (!m) return { tag: null, agentId: "main", note: "no [tag] in name, routed to Monica" };
  const tag = m[1].toLowerCase();
  const agentId = AGENT_MAP[tag];
  if (!agentId) return { tag, agentId: "main", note: `unknown tag [${tag}], routed to Monica` };
  if (tag === "edge") return { tag, agentId: "main", note: "[edge] is a human task, routed to Monica to coordinate" };
  return { tag, agentId, note: null };
}

function buildContext(task, agentId, tagInfo) {
  const lines = [];
  lines.push(`You are being started from the Done task app by Edge (Start Now button).`);
  lines.push(``);
  lines.push(`TASK: ${task.name}`);
  lines.push(`ID: ${task.id} | List: ${task.listId} | Status: ${task.status} | Priority: ${task.priority}`);
  if (task.startDate) lines.push(`Start: ${task.startDate}`);
  if (task.dueDate) lines.push(`Due: ${task.dueDate}`);
  lines.push(`Description: ${task.description || "(none)"}`);
  lines.push(``);
  lines.push(`Assignment: this task is assigned to ${agentId} (from [${tagInfo.tag || "?"}] tag).${tagInfo.note ? " Note: " + tagInfo.note + "." : ""}`);
  lines.push(`Do the work now. When finished:`);
  lines.push(`1. Update this task in ${TASKS_REPO}\\tasks.json:`);
  lines.push(`   - status to the right next status (e.g. done/approved/posted/reviewed, or active/forapproval if blocked)`);
  lines.push(`   - completedAt = now if done/closed status, else null`);
  lines.push(`   - updatedAt = now`);
  lines.push(`   - append a short result note to description if useful`);
  lines.push(`2. Validate: node ${TASKS_REPO}\\scripts\\validate.mjs (must exit 0)`);
  lines.push(`3. Commit + push: git -C "${TASKS_REPO}" (PowerShell push with 2>$null + $LASTEXITCODE, NEVER 2>&1)`);
  lines.push(`4. Reply with a one-line summary of what you did.`);
  lines.push(`Rules: file is source of truth; never delete the task; never edit index.html or config unless asked.`);
  return lines.join("\n");
}

function writeTempContext(task, agentId, tagInfo) {
  const content = buildContext(task, agentId, tagInfo);
  const tmp = path.join(os.tmpdir(), `done-trigger-${task.id}-${Date.now()}.txt`);
  fs.writeFileSync(tmp, content, "utf8");
  return tmp;
}

function cliBase() {
  // Spawn node with the openclaw.mjs entry directly (avoids .cmd/.ps1 wrapper issues)
  const entry = process.platform === "win32"
    ? path.join(process.env.APPDATA || "", "npm", "node_modules", "openclaw", "openclaw.mjs")
    : "openclaw";
  return entry;
}

function launchAgent(task, agentId, tagInfo, reply) {
  const ctxFile = writeTempContext(task, agentId, tagInfo);
  const runId = `done-${task.id}-${Date.now()}`;
  const sessionKey = `agent:${agentId}:done-${task.id}`;

  // 1. Run the agent turn (detached, async).
  const entry = cliBase();
  const args = [
    "agent",
    "--agent", agentId,
    "--session-key", sessionKey,
    "--message-file", ctxFile,
    "--json",
    "--timeout", "900",
  ];
  const child = process.platform === "win32"
    ? spawn(process.execPath, [entry, ...args], { detached: true, stdio: "ignore", windowsHide: true })
    : spawn(entry, args, { detached: true, stdio: "ignore", windowsHide: true });
  child.unref();
  log(`LAUNCH runId=${runId} agent=${agentId} task=${task.id} session=${sessionKey} reply=${reply}`);

  // 2. Deliver the launch notice to the requested channels.
  if (reply === "telegram" || reply === "both") {
    sendMessage("telegram", "5652347837", `▶ Started task ${task.id} "${task.name}" -> agent ${agentId} (session ${sessionKey})`);
  }
  if (reply === "webchat" || reply === "both") {
    sendMessage("webchat", null, `▶ Started task ${task.id} "${task.name}" -> agent ${agentId} (session ${sessionKey})`);
  }
  return { runId, sessionKey, agentId };
}

function sendMessage(channel, target, text) {
  const entry = cliBase();
  const args = ["message", "send", "--channel", channel, "-m", text];
  if (target) args.push("--target", target);
  const child = process.platform === "win32"
    ? spawn(process.execPath, [entry, ...args], { detached: true, stdio: "ignore", windowsHide: true })
    : spawn(entry, args, { detached: true, stdio: "ignore", windowsHide: true });
  child.unref();
  log(`SEND channel=${channel} target=${target || "(default)"} msg="${text}"`);
}

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);

  // CORS preflight
  if (req.method === "OPTIONS") {
    json(res, 204, { ok: true });
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    json(res, 200, { ok: true, port: PORT });
    return;
  }

  if (req.method === "GET" && url.pathname === "/log") {
    let tail = "";
    try { tail = fs.readFileSync(LOG_FILE, "utf8").split("\n").slice(-30).join("\n"); } catch {}
    json(res, 200, { ok: true, log: tail });
    return;
  }

  if (req.method === "POST" && url.pathname === "/trigger") {
    // CSRF guard: only allow known origins
    const origin = req.headers.origin || "null";
    if (!ALLOWED_ORIGINS.has(origin)) {
      log(`REJECT origin=${origin}`);
      json(res, 403, { ok: false, error: `origin not allowed: ${origin}` });
      return;
    }
    let body = "";
    req.on("data", c => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body || "{}");
        const task = payload.task;
        if (!task || !task.id || !task.name) {
          json(res, 400, { ok: false, error: "task.id and task.name required" });
          return;
        }
        const tagInfo = parseAgentTag(task.name);
        const agentId = payload.agentId || tagInfo.agentId;
        const reply = ["telegram", "webchat", "both"].includes(payload.reply) ? payload.reply : "both";
        const result = launchAgent(task, agentId, tagInfo, reply);
        json(res, 200, { ok: true, ...result, agentNote: tagInfo.note });
      } catch (e) {
        log(`ERROR ${e.message}`);
        json(res, 500, { ok: false, error: e.message });
      }
    });
    return;
  }

  json(res, 404, { ok: false, error: "not found" });
});

server.listen(PORT, HOST, () => {
  log(`Done Trigger Bridge listening on http://${HOST}:${PORT}`);
  log(`Agents: ${Object.values(AGENT_MAP).filter((v, i, a) => a.indexOf(v) === i).join(", ")}`);
});
