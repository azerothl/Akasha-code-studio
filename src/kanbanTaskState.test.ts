import { describe, expect, it } from "vitest";
import { taskHasActiveProgress, ticketStatusForTask } from "./kanbanTaskState";

describe("Kanban terminal state", () => {
  it.each(["failed", "cancelled", "interrupted"])("shows a stale active ticket as blocked when its task is %s", status => {
    expect(ticketStatusForTask("in_progress", status)).toBe("blocked");
    expect(ticketStatusForTask("review", status)).toBe("blocked");
    expect(taskHasActiveProgress(status)).toBe(false);
  });
  it("preserves reviewed completion and does not mark a completed run as approved", () => {
    expect(ticketStatusForTask("done", "failed")).toBe("done");
    expect(ticketStatusForTask("in_progress", "completed")).toBe("in_progress");
    expect(taskHasActiveProgress("completed")).toBe(false);
  });
});
