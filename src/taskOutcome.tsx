import type { TaskOutcome } from "./api";
import { redactSecrets } from "./sendContext";

const REASONS: Record<string, string> = {
  success: "Exécution terminée",
  model_empty: "Réponse du modèle vide",
  tool_loop: "Répétition d’outils détectée",
  tool_error: "Aucune opération d’outil n’a abouti",
  budget_exhausted: "Budget ou quota atteint",
  provider_error: "Erreur du fournisseur de modèle",
  timeout: "Délai dépassé",
  inactivity_timeout: "Aucun signal de progression reçu",
  tool_round_limit: "Limite de tours d’outils atteinte",
  verification_failed: "Vérification en échec",
  context_unavailable: "Règles ou skills du projet indisponibles",
  subtask_failed: "Sous-tâche non aboutie",
  missing_deliverables: "Livrables manquants",
  failed: "Échec enregistré par le daemon",
  cancelled: "Annulée",
  paused: "En pause",
  interrupted: "Interrompue",
  waiting_user_input: "Réponse utilisateur attendue",
};

export function outcomeLabel(outcome: TaskOutcome): string {
  const reason = REASONS[outcome.termination_reason] ?? `Fin : ${outcome.termination_reason}`;
  return outcome.result === "partial" ? `Résultat partiel · ${reason}` : reason;
}

/** Only trust the version whose evidence contract this client understands. */
export function supportedOutcome(outcome: TaskOutcome | null | undefined): TaskOutcome | null {
  return outcome?.schema_version === 1 && typeof outcome.termination_reason === "string"
    && typeof outcome.result === "string" && (outcome.reason == null || typeof outcome.reason === "string")
    && Array.isArray(outcome.verification) ? outcome : null;
}

export function taskFeedbackKind(status: string, raw?: TaskOutcome | null): "partial" | "error" | "success" {
  const outcome = supportedOutcome(raw);
  if (outcome?.result === "partial") return "partial";
  if (status === "failed" || status === "interrupted") return "error";
  return status === "completed" && outcome?.result === "succeeded" && outcome.acceptance_verified === true ? "success" : "partial";
}

export function taskFeedbackTitle(status: string, raw?: TaskOutcome | null): string | null {
  const outcome = supportedOutcome(raw);
  return outcome ? outcomeLabel(outcome) : status === "completed" ? "Exécution terminée · résultat non vérifié" : null;
}

export function TaskOutcomeSummary({ outcome: raw, status }: { outcome?: TaskOutcome | null; status?: string }) {
  const outcome = supportedOutcome(raw);
  if (!outcome) return <p className="hint">{status === "completed" ? "Exécution terminée · " : ""}Résultat structuré indisponible pour cette tâche ; réussite de la demande non confirmée.</p>;
  return <div className="task-outcome">
    <p><strong>{outcomeLabel(outcome)}</strong></p>
    <p className="hint">{outcome.acceptance_verified === true
      ? "Critères configurés vérifiés par le daemon."
      : "Les critères d’acceptation ne sont pas tous vérifiés automatiquement."}
      {typeof outcome.successful_tool_calls === "number" ? ` ${outcome.successful_tool_calls} appel(s) réussi(s), ${outcome.failed_tool_calls ?? 0} en échec.` : ""}
    </p>
    {outcome.result === "partial" ? <p className="hint">Des étapes ont réussi. Consultez les fichiers et le diff avant de relancer la demande.</p> : null}
    {outcome.reason ? <details><summary>Motif de terminaison</summary><pre className="build-pre">{redactSecrets(outcome.reason)}</pre></details> : null}
  </div>;
}
