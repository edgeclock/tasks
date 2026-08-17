#!/usr/bin/env node
// Capacity-aware date fixes for Done (2026-08-17, per Monica x Edge)
import fs from "node:fs";

const path = "D:/Personal/Tasks/tasks.json";
const data = JSON.parse(fs.readFileSync(path, "utf8"));
const now = new Date().toISOString();
const byId = Object.fromEntries(data.tasks.map(t => [t.id, t]));

const changes = [];

function set(id, patch, reason) {
  const t = byId[id];
  if (!t) { console.log(`SKIP ${id}: not found`); return; }
  for (const [k, v] of Object.entries(patch)) {
    if (t[k] !== v) { t[k] = v; changes.push(`${id}.${k}: ${JSON.stringify(t[k])} -> ${JSON.stringify(v)} (${reason})`); }
  }
  t.updatedAt = now;
}

// 1. T-0001 poll closed at noon today -> complete
set("T-0001", { status: "complete", completedAt: now }, "poll closed noon today");

// 2. Podcast editing is scheduled TONIGHT (calendar 19:00-21:00) -> due today
set("T-0006", { dueDate: "2026-08-17" }, "Podcast Editing calendar block is tonight 19:00-21:00");

// 3. ChatGPT Plus payment is calendar'd TOMORROW 09:00 -> due Aug 18
set("T-0007", { dueDate: "2026-08-18" }, "Pay ChatGPT Plus calendar event is Tue 09:00");

// 4. Spread Edge's Aug 18 load (calendar: 5 commitments that day)
set("T-0015", { dueDate: "2026-08-19" }, "Edge has 5 calendar commitments Aug 18; MMI LP moves to Wed");

// 5. Website Setup (built today 13:00-19:00) -> give it a finish date
set("T-0013", { startDate: "2026-08-17", dueDate: "2026-08-18" }, "Website build block is today; finish tomorrow");

// 6. AI Coaching LP -> after MMI LP, spread
set("T-0016", { startDate: "2026-08-19", dueDate: "2026-08-20" }, "Coaching LP after MMI LP; avoid Aug 18 pileup");

// 7. Spread Edge's Aug 22 triple-book
set("T-0018", { dueDate: "2026-08-25" }, "Virtual Mastermind moves to Tue Aug 25 (call with Jenny, flexible)");
set("T-0020", { dueDate: "2026-08-28" }, "Agent System Restructure is internal infra; lands Fri Aug 28");

fs.writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf8");
console.log(changes.length + " change(s) applied:");
changes.forEach(c => console.log("  " + c));
