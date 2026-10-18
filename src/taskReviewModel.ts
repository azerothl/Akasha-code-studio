import type { TaskOutcome } from "./api";
import { supportedOutcome } from "./taskOutcome";

export type ReviewCheckState = "executed" | "not_run" | "manual" | "failed";

export type ReviewCheck = {
  label: string;
  state: ReviewCheckState;
  detail: string;
};

const VERIFY_LINE = /vérif|verify|command_ok|exit code|exit status|npm run|cargo check/i;
const FAIL_LINE = /fail|erreur|error|non-zero|échou/i;
const EXIT_CODE = /(?:exit (?:code|status)|code(?: de sortie)?)\s*[:=]?\s*(-?\d+)/i;

function executionState(line: string): ReviewCheckState {
  const exit = EXIT_CODE.exec(line);
  if (exit) return Number(exit[1]) === 0 ? "executed" : "failed";
  if (FAIL_LINE.test(line)) return "failed";
  return "not_run";
}

export function redactReviewDetail(text: string): string {
  return text.replace(/((?:api[_-]?key|secret|token|password|bearer)\s*[:=]\s*)(\S+)/gi, "$1[masqué]").slice(0, 220);
}

export function classifyReviewChecks(input: {
  progress: string[];
  missingManual: string[];
  buildLog: string;
  outcome?: TaskOutcome | null;
}): ReviewCheck[] {
  const checks: ReviewCheck[] = [];
  const outcome = supportedOutcome(input.outcome);
  for (const check of outcome?.verification ?? []) {
    if (!check || typeof check.kind !== "string" || typeof check.status !== "string") continue;
    checks.push({
      label: check.kind === "project_build" ? "Build post-tâche" : check.kind === "acceptance" ? "Critère d’acceptation" : check.kind === "requested_file" ? "Fichier demandé" : "Commande de la tâche",
      state: check.status === "passed" ? "executed" : check.status === "failed" ? "failed" : check.status === "manual" ? "manual" : "not_run",
      detail: redactReviewDetail([check.id, check.text, check.tool, check.detail, typeof check.exit_code === "number" ? `Code de sortie : ${check.exit_code}` : ""].filter(Boolean).join(" · ") || "Résultat structuré du daemon"),
    });
  }
  for (const line of outcome ? [] : input.progress) {
    const trimmed = line.trim();
    if (!trimmed || !VERIFY_LINE.test(trimmed)) continue;
    checks.push({
      label: "Vérification de tâche",
      state: "not_run",
      detail: redactReviewDetail(trimmed),
    });
  }
  const build = input.buildLog.trim();
  if (build && build !== "—" && build !== "…") {
    checks.push({
      label: "Build du projet depuis l’interface (indépendant de la tâche)",
      state: executionState(build),
      detail: redactReviewDetail(build),
    });
  }
  for (const missing of input.missingManual) {
    const text = missing.trim();
    if (!text) continue;
    checks.push({
      label: "Critère manuel",
      state: "manual",
      detail: redactReviewDetail(text),
    });
  }
  if (checks.length === 0) {
    checks.push({
      label: "Contrôles",
      state: "not_run",
      detail: "Aucun résultat de commande disponible pour cette tâche.",
    });
  }
  return checks;
}
