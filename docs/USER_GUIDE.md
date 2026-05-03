# Akasha Code Studio — User Guide

This guide is for end users of Akasha Code Studio. It explains what Code Studio does, how to use it day-to-day, and which daemon options influence its behavior.

## 1) What Code Studio Is

Akasha Code Studio is a web UI that works with the Akasha daemon.  
You use it to:

- create and manage isolated studio projects,
- ask coding agents to implement changes,
- edit files directly,
- run preview/build workflows,
- manage Git evolution branches,
- monitor task progress and operator-level runtime signals.

Code Studio itself is the interface. The daemon executes the actual operations and orchestrates agents.

## 2) Architecture in Practice

At runtime, you have:

- **Code Studio UI** at `http://127.0.0.1:5178` (default dev),
- **Akasha daemon API** at `http://127.0.0.1:3876` (default),
- **Project workspaces** under the daemon data directory (`studio-projects/<UUID>`).

The UI sends requests to `/api/*` and the daemon performs file, git, task, preview, and build operations.

## 3) Prerequisites

Before using Code Studio:

- Akasha daemon must be running and reachable.
- Node.js 18+ is recommended for frontend development workflows.
- Git should be installed if you use evolutions and merges.
- For project preview/build commands, required toolchains must exist on your machine.

## 4) Start Code Studio

From `akasha-code-studio`:

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5178`.

The daemon status badge in the header should report that the daemon is up.

## 5) Core UI Areas

### Header Menus

- **Project**
  - Create/load a project.
  - Rename display name.
  - Save technical stack and policy/session notes.
- **Evolutions Git**
  - Create/select evolution branches.
- **Import & build**
  - Clone repository into project workspace.
  - Run build command.
  - Merge or abandon selected evolution.
- **Agent / actions**
  - Trigger plan/design regeneration helpers.
  - Show agent capabilities matrix.

### Center Tabs

- **Editor**: file tree + Monaco editor.
- **Preview**: static HTML preview or live dev server preview.
- **Plan**: edit/preview `CODE_STUDIO_PLAN.md`.
- **Design**: edit/preview `DESIGN.md`, diagnostics, exports.
- **Logs serveur**: backend/runtime logs view.
- **Cockpit**: operational panel (scheduler/task runs/process watch/tools/MCP/lifecycle).
- **Documentation**: integrated user guide (this document).

### Chat Area

- Send prompts to coding agents.
- Follow task progress.
- Open task details/events.
- Use suggested action chips.

## 6) Typical Daily Workflow

1. Create or load a project from **Project**.
2. (Optional) Set the project technical stack in **Project**.
3. If needed, clone a repo in **Import & build**.
4. Start an evolution branch in **Evolutions Git**.
5. Send a task in chat (implementation/refactor/fix).
6. Review generated changes in **Editor** and task details.
7. Validate in **Preview**.
8. Run build in **Import & build**.
9. Merge evolution when validated.

## 7) Projects and Files

### Project Creation

When a project is created, the daemon initializes the studio workspace and metadata.  
A local git repository is also initialized with a primary branch (`main`, fallback rules if needed).

### File Editing

- Open files from the tree in **Editor**.
- Save changes with the save action.
- Binary files are not edited as text.
- Paths are enforced by daemon safety checks (no path traversal outside project root).

## 8) Agents, Tasks, and Human Input

### Sending a Task

You write instructions in chat and send them. The daemon returns a `task_id`.

### Task Tracking

You can inspect:

- progress updates,
- grouped task events (sub-agents, tool calls, messages),
- final status and failure details.

### Human-in-the-loop

Some tasks can pause and request user input (`waiting_user_input`).  
When prompted, reply in the dedicated input area to let the task continue.

## 9) Preview and Build

### Preview

In **Preview**:

- You can start a dev server preview (daemon runs `npm run dev` with localhost host/port).
- You can stop the preview server.
- You can inspect preview logs.
- For plain HTML files, static iframe preview is available even without live dev mode.

### Build

In **Import & build**, set command (for example `npm run build`) and execute.  
The daemon runs the command in the project root and returns stdout/stderr and exit status.

## 10) Evolutions and Git

Use **Evolutions Git** to isolate work in dedicated branches.

- Create branch for one feature/fix.
- Send agent tasks while that evolution is selected.
- Merge into main branch when ready.
- Abandon evolution if discarded.

This keeps iterations cleaner and safer.

## 11) Daemon Options and Parameters

This section lists the most useful daemon-side options for Code Studio users and operators.

### 11.1 Daemon Runtime Options

- `AKASHA_PORT`
  - Controls daemon HTTP port (default: `3876`).
  - If changed, Code Studio must target that port.
- `AKASHA_STUDIO_MAX_PARALLEL_OPS`
  - Limits concurrent studio operations.
  - Useful to prevent CPU/disk saturation on busy hosts.
- `AKASHA_STUDIO_CODE_RAG_DISABLED`
  - When set to `1`, `true`, `yes`, or `on`, the daemon **does not** prepend indexed code excerpts to studio LLM prompts.
  - If unset (default) or any other value, Code RAG prefix injection stays **enabled**.

### 11.2 Code Studio Frontend Daemon Target

- `VITE_DAEMON_URL` (Code Studio frontend env)
  - Sets the daemon base URL used by Vite proxy.
  - Default behavior targets `http://127.0.0.1:3876`.

### 11.3 `POST /api/message` Studio Parameters

When Code Studio sends a task, these fields can be passed to influence daemon behavior:

- `studio_project_id` (`string`, UUID)
  - Binds task context to one studio project root.
- `studio_assigned_agent` (`string`)
  - Preferred studio sub-agent role.
- `studio_evolution_branch` (`string`)
  - Explicit git branch context for the task.
- `studio_evolution_id` (`string`)
  - Evolution identifier resolved by daemon metadata.
- `studio_design_hint` (`string`)
  - Compact design guidance.
- `studio_design_doc` (`string`)
  - Full/partial `DESIGN.md` context.

### 11.4 Build Endpoint Parameters

`POST /api/studio/projects/:id/build`

- `argv` (`string[]`) — command and args to execute.
- `timeout_sec` (`number`, optional) — command timeout.

### 11.5 Preview Endpoint Parameters

`POST /api/studio/projects/:id/preview/start`

- `force_install` (`boolean`, optional) — force dependency install before start.
- `port` (`number`, optional) — request preview port.

`POST /api/studio/projects/:id/preview/install`

- `force` (`boolean`, optional) — force install even if dependencies are already present.

### 11.6 Project Metadata Verification Options

Project metadata (read/write via `PATCH /api/studio/projects/:id`) supports:

- `verify_skip` (`boolean`)
  - Disable post-task verification.
- `verify_argv` (`string[] | null`)
  - Custom verification command.
- `verify_timeout_sec` (`number | null`)
  - Timeout for verification command.

These options control automatic post-task validation behavior for Code Studio tasks.

## 12) Troubleshooting

### Daemon appears down

- Check daemon process is running.
- Verify daemon port (`AKASHA_PORT`) and frontend target (`VITE_DAEMON_URL`).
- Confirm local firewall/network rules are not blocking localhost.

### Preview cannot start

- Ensure project has `package.json` if using live preview.
- Check install/start logs in Preview tab.
- Ensure requested preview port is free.

### Build fails

- Read stderr/stdout in build output.
- Verify dependencies/toolchains in your local environment.
- Try command manually in project root to confirm reproducibility.

### Task stuck waiting for user input

- Look for the human input prompt in chat/task area.
- Provide a response to continue execution.

### Merge fails

- Likely branch conflict or git state issue.
- Re-open evolution, inspect git status/worktree indicators, and resolve conflicts before retry.

## 13) Security and Safety Notes

- Studio file operations are constrained to project root by daemon checks.
- Build/preview commands run on host environment (not full container isolation by default).
- Treat dependencies and scripts as untrusted unless reviewed.

## 14) Quick Reference

- Start UI: `npm run dev`
- Default UI URL: `http://127.0.0.1:5178`
- Default daemon URL: `http://127.0.0.1:3876`
- Main task endpoint: `POST /api/message`
- Main project endpoints: `/api/studio/projects/*`

---

If you are onboarding a new teammate, start with sections **5**, **6**, and **11** first.
