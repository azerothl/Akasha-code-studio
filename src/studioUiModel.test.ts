import { describe, expect, it } from "vitest";
import { chatMessageForTerminalTask, looksLikeContextWindowFailure } from "./studioUiModel";

describe("Code Studio context-window recovery copy", () => {
  it("recognizes daemon and provider context-limit errors", () => {
    expect(looksLikeContextWindowFailure("context_window_exceeded: request too large")).toBe(true);
    expect(looksLikeContextWindowFailure("This model's maximum context length was exceeded")).toBe(true);
    expect(looksLikeContextWindowFailure("provider unavailable")).toBe(false);
  });

  it("explains the failure and same-task recovery without implying tools ran", () => {
    const message = chatMessageForTerminalTask(
      "failed",
      undefined,
      "context_window_exceeded: protected instructions and recent execution cannot fit",
    );
    expect(message).toContain("dépasse sa fenêtre");
    expect(message).toContain("reprendre cette même tâche");
    expect(message).toContain("si des outils avaient déjà été exécutés");
  });
});
