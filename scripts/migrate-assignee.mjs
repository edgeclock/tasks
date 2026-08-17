#!/usr/bin/env node
// One-time migration: extract [agent] prefix from task names into an `assignee` field
import fs from "node:fs";

const path = "D:/Personal/Tasks/tasks.json";
const data = JSON.parse(fs.readFileSync(path, "utf8"));

let changed = 0;
for (const t of data.tasks) {
  const m = /^\[([a-zA-Z0-9-]+)\]\s*(.*)$/.exec(String(t.name || ""));
  if (m && !t.assignee) {
    t.assignee = m[1].toLowerCase();
    t.name = m[2] || "(untitled)";
    changed++;
  }
  if (!t.assignee) t.assignee = "";
}

fs.writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf8");
console.log(`migrated ${changed} tasks`);
for (const t of data.tasks.slice(0, 5)) {
  console.log(`${t.id} | assignee=${t.assignee || "(none)"} | ${t.name}`);
}
