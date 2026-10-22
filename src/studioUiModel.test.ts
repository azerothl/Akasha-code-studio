import { describe, expect, it } from "vitest";
import { chatMessageForTerminalTask, isLocalContextWindowPreflightFailure, looksLikeContextWindowFailure } from "./studioUiModel";

describe("Code Studio context-window recovery copy", () => {
  it("recognizes daemon and provider context-limit errors", () => {
    expect(looksLikeContextWindowFailure("context_window_exceeded: request too large")).toBe(true);
    expect(looksLikeContextWindowFailure("This model's maximum context length was exceeded")).toBe(true);
    expect(looksLikeContextWindowFailure("provider unavailable")).toBe(false);
    expect(isLocalContextWindowPreflightFailure("context_window_preflight_rejected: before contacting the model")).toBe(true);
    expect(isLocalContextWindowPreflightFailure("provider rejected context_window_exceeded")).toBe(false);
  });

  it("explains that local preflight stopped before the model call and gives concrete workarounds", () => {
    const message = chatMessageForTerminalTask(
      "failed",
      undefined,
      "context_window_exceeded: context_window_preflight_rejected: estimated input exceeds the configured context",
    );
    expect(message).toContain("avant de contacter le modèle");
    expect(message).toContain("Aucun appel au modèle ni outil n’a été exécuté");
    expect(message).toContain("AKASHA_OLLAMA_NUM_CTX");
  });

  it("gives a provider-side workaround without claiming a local preflight", () => {
    const message = chatMessageForTerminalTask("failed", undefined, "Ollama error: maximum context length exceeded");
    expect(message).toContain("fournisseur du modèle a refusé");
    expect(message).toContain("fenêtre plus grande");
    expect(message).not.toContain("avant de contacter le modèle");
  });
});
