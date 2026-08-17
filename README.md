# Done - Task Management

Task management tool for the Edge Possible agent org: Kanban, List, and Calendar views in one static page.

## Live

https://edgeclock.github.io/tasks/

## Files

- `index.html` - the entire app (vanilla HTML/CSS/JS, no dependencies, no build step)
- `tasks.json` - source of truth: config (lists, statuses, priorities) + tasks
- `README.md` - this file

## Data model

Each task: `id`, `listId`, `name`, `description`, `startDate`, `dueDate`, `status`, `priority`, plus auto timestamps (`createdAt`, `updatedAt`, `completedAt`).

- Status is hierarchical: 4 main groups (Not Started, Active, Done, Closed) with sub-statuses under each.
- Status groups/sub-statuses are configurable per list (ClickUp-style) in `tasks.json` -> `config.lists[].statusGroups`.
- Priority uses the Eisenhower 4 quadrants: Important/Urgent, Not Important/Urgent, Important/Not Urgent, Not Important/Not Urgent.
- Assignment convention: prefix task name with `[agent-id]`, e.g. `[finna] Reconcile RCBC`. Monica brokers all assignments.

## How to use

1. Open https://edgeclock.github.io/tasks/ (or open `index.html` locally - works from disk too).
2. Switch views: Kanban / List / Calendar.
3. Click "+ New task" or double-click a calendar day to add.
4. Kanban: drag cards between columns to change status. Columns group under the 4 main status bands.
5. List: sort by clicking headers, filter by list/status group/priority/overdue.
6. Calendar: tasks with start + due render as range bars. Monday week start. Overdue flags.

## Persistence

- The app reads `tasks.json` on load.
- Changes live in the browser until you Export or Copy JSON, then commit `tasks.json` to git.
- Monica is the single writer: she pulls, edits, validates, commits, and pushes (same protocol as the Finances ledger).
- Import lets you restore from a downloaded file.

## Start Now trigger (v0.2)

Each task card / row / modal has a "▶ Start" button. Clicking it launches the task's agent in OpenClaw with full task context (per the [agent] tag in the task name), using a local bridge:

- Bridge: `D:\Personal\Tasks\tools\trigger-bridge.mjs` (Node, localhost:8788, zero deps).
- Auto-start at logon: `tools/start-bridge.ps1` + Startup folder entry (DoneTriggerBridge.vbs).
- The launched agent gets the task details and instructions to do the work, update tasks.json (validate + push), and reply with a summary (delivered to Telegram + webchat).
- Session key per task: `agent:<id>:done-<taskId>` so repeat launches resume the same session.
- Bridge health indicator in the app header; buttons disable when bridge is offline.
- CSRF guard: bridge only accepts POSTs from allowed origins (edgeclock.github.io, localhost).

## Writing protocol (Monica)

1. `git -C "D:\Personal\Tasks" pull --ff-only`
2. Edit `tasks.json` (validate: JSON parses, every task.status exists in its list's statusGroups, no duplicate ids)
3. Commit + push (`git push origin main`, PowerShell gotcha: suppress stderr or use `2>$null` + `$LASTEXITCODE` check)

## Roadmap

- v0.1 (current): 5 fields, 3 views, config-driven status/priority, dark theme.
- v0.2+: custom fields, tags, assignee field, comments, recurring tasks, in-app status editor, light theme toggle.
