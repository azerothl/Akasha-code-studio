# AIPM -> Akasha Code Studio: concept mapping

This document maps reusable concepts from the `aipm` project to concrete implementation targets in `akasha-code-studio` and Akasha daemon APIs.

## 1) Workspace shell with pluggable panels

- **AIPM reference**
  - `src/app/page.tsx`
- **Code Studio target**
  - `src/App.tsx`
  - `src/sidebar.tsx`
- **Adoption**
  - Add `Kanban` as a first-class center tab.
  - Keep existing central orchestration in `App.tsx` and compose a new focused panel component.

## 2) Ticket-centric workflow (Kanban + lifecycle)

- **AIPM reference**
  - `src/components/Kanban.tsx`
  - `src/app/api/tickets/**/route.ts`
- **Code Studio target**
  - `src/kanbanBoard.tsx` (new)
  - `src/api.ts`
  - `crates/akasha-daemon/src/api_studio/handlers.rs`
- **Adoption**
  - Introduce a daemon-backed `StudioTicket` model and `Kanban` board per studio project.
  - Track assignment, review gate, corrective steps, and task linkage.

## 3) Vertical-slice API pattern

- **AIPM reference**
  - Multiple route files under `src/app/api/...`
- **Code Studio target**
  - `crates/akasha-daemon/src/api_studio/handlers.rs`
  - `crates/akasha-daemon/src/api.rs`
- **Adoption**
  - Add dedicated `/api/studio/projects/:id/tickets*` endpoints.
  - Add `POST /api/message` integration fields (`studio_ticket_id`, enforcement mode).

## 4) Real-time eventing + timeline

- **AIPM reference**
  - `src/lib/ticket-events.ts`
  - `src/app/api/tickets/stream/route.ts`
- **Code Studio target**
  - Existing global stream in `src/api.ts` (`subscribeTaskEventsLive`)
  - New ticket timeline rendering in Kanban ticket details.
- **Adoption**
  - Reuse existing daemon event bus and task events as source of truth.
  - Avoid process-local in-memory event emitters for critical state.

## 5) Plan import -> executable backlog

- **AIPM reference**
  - `src/lib/plan-import.ts`
- **Code Studio target**
  - `src/App.tsx`
  - `src/api.ts`
- **Adoption**
  - Parse plan text in UI and create ticket drafts/actions without auto-running mutation.

## 6) Operator quick-actions

- **AIPM reference**
  - Dashboard actions integrated in main page shell.
- **Code Studio target**
  - `src/projectDashboard.tsx`
- **Adoption**
  - Contextual action cards (preview/build/review/branch follow-up) driven by daemon state.

## Guardrails preserved from Akasha

- Daemon-level transition validation for tickets and review gate.
- `strict` ticket enforcement mode can block runs without an attached ticket.
- `done` requires review approval event and evidence.
