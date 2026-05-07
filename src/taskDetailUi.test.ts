import { describe, expect, it } from "vitest";
import type { TaskEventEntry } from "./api";
import { buildWorkflowSteps } from "./taskDetailUi";

const rootTaskId = "task-root";

function event(event_type: string, at: string, payload?: unknown): TaskEventEntry {
  return { event_type, at, task_id: rootTaskId, payload };
}

describe("buildWorkflowSteps worktree lifecycle", () => {
  it("keeps the latest integration title and snapshot details", () => {
    const steps = buildWorkflowSteps(
      [
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
      ],
      rootTaskId,
    );

    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({
      id: `worktree:${rootTaskId}`,
      title: "Intégration worktree",
      status: "blocked",
      at: "2020-01-01T00:00:10Z",
      details: [
        "Intégration: conflict",
        "Conflit: manual_resolution_required",
        "Branche: feat/worktree",
        "Chemin: /tmp/worktree",
      ],
    });
  });

  it("ignores unsupported worktree integration event names", () => {
    const steps = buildWorkflowSteps(
      [
        event("studio_worktree_integration_pending", "2020-01-01T00:00:00Z", {
          task_id: rootTaskId,
          integration_status: "pending",
        }),
      ],
      rootTaskId,
    );

    expect(steps).toEqual([]);
  });
});
