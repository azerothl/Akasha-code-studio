import type { StudioTicketStatus } from "./api";

export function ticketStatusForTask(ticketStatus: StudioTicketStatus, taskStatus?: string): StudioTicketStatus {
  if (ticketStatus === "done") return ticketStatus;
  if (["failed", "cancelled", "interrupted"].includes(taskStatus ?? "")) return "blocked";
  return ticketStatus;
}

export function taskHasActiveProgress(status?: string): boolean {
  return ["pending", "queued", "running"].includes(status ?? "");
}
