#!/usr/bin/env node
// Validate tasks.json for the Done app (D:\Personal\Tasks)
// Usage: node scripts\validate.mjs
// Exit 0 = valid, 1 = invalid (prints issues)

import fs from "node:fs";
import path from "node:path";

const file = path.join(import.meta.dirname, "..", "tasks.json");
let data;
try {
  data = JSON.parse(fs.readFileSync(file, "utf8"));
} catch (e) {
  console.error("FATAL: tasks.json is not valid JSON - " + e.message);
  process.exit(1);
}

const errors = [];
const warn = [];

// config sanity
if (!data.config || !Array.isArray(data.config.lists) || data.config.lists.length === 0) {
  errors.push("config.lists missing or empty");
}
if (!data.config || !Array.isArray(data.config.priorities) || data.config.priorities.length === 0) {
  errors.push("config.priorities missing or empty");
}
if (!Array.isArray(data.tasks)) errors.push("tasks missing or not an array");

const listIds = new Set((data.config?.lists || []).map(l => l.id));
const prioKeys = new Set((data.config?.priorities || []).map(p => p.key));

// per-list status keys
const statusKeysByList = {};
for (const l of data.config?.lists || []) {
  statusKeysByList[l.id] = new Set();
  for (const g of l.statusGroups || []) {
    if (!["notstarted", "active", "done", "closed"].includes(g.key)) {
      warn.push(`list "${l.id}": group "${g.key}" is not one of notstarted/active/done/closed`);
    }
    for (const s of g.statuses || []) statusKeysByList[l.id].add(s.key);
  }
}

// task sanity
const seenIds = new Set();
for (const [i, t] of (data.tasks || []).entries()) {
  const where = `task[${i}]${t.id ? " (" + t.id + ")" : ""}`;
  if (!t.id || typeof t.id !== "string") errors.push(`${where}: missing id`);
  else {
    if (seenIds.has(t.id)) errors.push(`${where}: duplicate id`);
    seenIds.add(t.id);
    if (!/^T-\d{4,}$/.test(t.id)) warn.push(`${where}: id "${t.id}" does not match T-#### pattern`);
  }
  if (!t.name || !String(t.name).trim()) errors.push(`${where}: missing name`);
  if (t.assignee !== undefined && typeof t.assignee !== "string") errors.push(`${where}: assignee must be a string`);
  if (/^\[[a-z0-9-]+\]/.test(String(t.name || ""))) warn.push(`${where}: name still starts with an [agent] tag - move it to assignee`);
  if (!listIds.has(t.listId)) errors.push(`${where}: listId "${t.listId}" not in config.lists`);
  else if (!statusKeysByList[t.listId]?.has(t.status)) {
    errors.push(`${where}: status "${t.status}" not defined in list "${t.listId}" statusGroups`);
  }
  if (!prioKeys.has(t.priority)) errors.push(`${where}: priority "${t.priority}" not in config.priorities`);
  for (const f of ["startDate", "dueDate"]) {
    if (t[f] && !/^\d{4}-\d{2}-\d{2}$/.test(t[f])) errors.push(`${where}: ${f} "${t[f]}" must be YYYY-MM-DD`);
  }
  if (t.startDate && t.dueDate && t.startDate > t.dueDate) errors.push(`${where}: startDate after dueDate`);
  for (const f of ["createdAt", "updatedAt"]) {
    if (!t[f]) errors.push(`${where}: missing ${f}`);
  }
  if (t.completedAt !== null && t.completedAt !== undefined && typeof t.completedAt !== "string") {
    errors.push(`${where}: completedAt must be a string or null`);
  }
}

for (const w of warn) console.log("WARN: " + w);
if (errors.length > 0) {
  console.error(`INVALID: ${errors.length} error(s)`);
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}
console.log(`OK: ${data.tasks.length} task(s) valid, ${data.config.lists.length} list(s), ${data.config.priorities.length} priority(ies)`);
