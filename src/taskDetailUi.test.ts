import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { TaskEventEntry } from "./api";
import { TaskDetailWorkflowView } from "./taskDetailUi";

const rootTaskId = "task-root";

function event(event_type: string, at: string, payload?: unknown): TaskEventEntry {
  return { event_type, at, task_id: rootTaskId, payload };
}

function renderWorkflow(events: TaskEventEntry[]): string {
  return renderToStaticMarkup(createElement(TaskDetailWorkflowView, { events, rootTaskId }));
}

function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("TaskDetailWorkflowView worktree lifecycle", () => {
  it("shows the latest integration title and snapshot details", () => {
    const html = renderWorkflow([
      event("studio_worktree_created", "2020-01-01T00:00:00Z", {
        task_id: rootTaskId,
        worktree_branch: "feat/worktree",
        worktree_path: "/tmp/worktree",
      }),
      event("studio_worktree_integration_conflict", "2020-01-01T00:00:10Z", {
        task_id: rootTaskId,
        integration_status: "conflict",
        conflict_state: "manual_resolution_required",
      }),
    ]);

    expect(html).toContain("Intégration worktree");
    expect(html).toContain("bloqué");
    expect(html).toContain("Intégration: conflict");
    expect(html).toContain("Conflit: manual_resolution_required");
    expect(html).toContain("Branche: feat/worktree");
    expect(html).toContain("Chemin: /tmp/worktree");
    expect(html).not.toContain("Worktree créé</span>");
    expect(occurrences(html, "Branche: feat/worktree")).toBe(1);
  });

  it("ignores unsupported worktree integration event names", () => {
    const html = renderWorkflow([
      event("studio_worktree_integration_pending", "2020-01-01T00:00:00Z", {
        task_id: rootTaskId,
        integration_status: "pending",
      }),
    ]);

    expect(html).toContain("Aucun sous-agent ou plan d’orchestration détecté pour cette tâche.");
    expect(html).not.toContain("pending");
  });
});
