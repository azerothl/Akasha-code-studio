import { describe, expect, it } from "vitest";
import { buildInitialProjectRequest, chatMessageForTerminalTask, isLocalContextWindowPreflightFailure, looksLikeContextWindowFailure } from "./studioUiModel";

describe("initial project request", () => {
  it("distinguishes a verified plan from delivery despite a model success claim", () => {
    const message = chatMessageForTerminalTask("completed", "Tout est terminé", null, { planning_verified: true });
    expect(message).toContain("Planification vérifiée");
    expect(message).toContain("reste à créer et à valider");
    expect(message).not.toContain("Tout est terminé");
  });
  it("sends the summary once and leaves the saved stack to project metadata", () => {
    expect(buildInitialProjectRequest("Todo", "Créer une webapp de todo list."))
      .toBe("Crée le projet « Todo » selon ce résumé :\n\nCréer une webapp de todo list.");
  });

  it("uses a short request when no summary is provided", () => {
    expect(buildInitialProjectRequest("  ", "  ")).toBe("Crée le projet « Nouveau projet ».");
  });
});

describe("Code Studio context-window recovery copy", () => {
  it("does not claim zero model calls when only a fallback failed local context preflight", () => {
    const detail='studio_routes_exhausted: qwen: tool_protocol_error: unadvertised function; fallback: context_window_preflight_rejected';
    expect(isLocalContextWindowPreflightFailure(detail)).toBe(false);
    expect(chatMessageForTerminalTask("failed", undefined, detail)).not.toContain("Aucun appel au modèle");
  });
  it("identifies invalid role tools without diagnosing an external service outage", () => {
    const message=chatMessageForTerminalTask("failed", undefined, 'studio_routes_exhausted: tool_protocol_error: Unadvertised Qwen function "delegate_to_agent"');
    expect(message).toContain("appel d’outil invalide pour cette étape");
    expect(message).toContain("refusé avant exécution");
    expect(message).toContain("delegate_to_agent");
    expect(message).not.toContain("Vérifiez que le service");
  });
  it("explains provider timeout and offers checkpoint recovery without resubmitting a creation request", () => {
    const message=chatMessageForTerminalTask("failed", undefined, "provider_generation_failed: ollama/lfm2:24b: timeout. Reprise depuis checkpoint.");
    expect(message).toContain("ollama/lfm2:24b");
    expect(message).toContain("Reprendre la tâche");
    expect(message).not.toContain("renvoyer la même consigne");
  });
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
    expect(message).toContain("Des opérations peuvent avoir réussi lors des tours précédents");
    expect(message).not.toContain("Aucun appel au modèle ni outil");
    expect(message).toContain("AKASHA_OLLAMA_NUM_CTX");
  });

  it("gives a provider-side workaround without claiming a local preflight", () => {
    const message = chatMessageForTerminalTask("failed", undefined, "Ollama error: maximum context length exceeded");
    expect(message).toContain("fournisseur du modèle a refusé");
    expect(message).toContain("fenêtre plus grande");
    expect(message).not.toContain("avant de contacter le modèle");
  });
});


describe("bounded execution diagnostics", () => {
  it("explains a loop without suggesting a service outage or an unchanged retry", () => {
    const message=chatMessageForTerminalTask("failed",undefined,"studio_no_verified_progress: 24 rounds");
    expect(message).toContain("sans vérification réussie");
    expect(message).toContain("ne relancera pas automatiquement");
    expect(message).not.toContain("service du modèle");
  });
  it("does not claim delivery when checks failed or became stale", () => {
    const message=chatMessageForTerminalTask("failed",undefined,"studio_command_verification_failed: npm run build: stale");
    expect(message).toContain("projet n’est pas validé");
    expect(message).toContain("périmé");
  });
  it("explains the bounded stop and preserves user control over resumption", () => {
    const message=chatMessageForTerminalTask("failed",undefined,"studio_round_budget_exhausted");
    expect(message).toContain("relance automatique est arrêtée");
    expect(message).toContain("reprise explicite");
  });
});
