export type ReviewCheckState = "executed" | "not_run" | "manual" | "failed";

export type ReviewCheck = {
  label: string;
  state: ReviewCheckState;
  detail: string;
};

const VERIFY_LINE = /vérif|verify|command_ok|exit code|exit status|npm run|cargo check/i;
const FAIL_LINE = /fail|erreur|error|non-zero|échou/i;

export function redactReviewDetail(text: string): string {
  return text.replace(/((?:api[_-]?key|secret|token|password|bearer)\s*[:=]\s*)(\S+)/gi, "$1[masqué]").slice(0, 220);
}

export function classifyReviewChecks(input: {
  progress: string[];
  missingManual: string[];
  buildLog: string;
}): ReviewCheck[] {
  const checks: ReviewCheck[] = [];
  for (const line of input.progress) {
    const trimmed = line.trim();
    if (!trimmed || !VERIFY_LINE.test(trimmed)) continue;
    checks.push({
      label: "Vérification de tâche",
      state: FAIL_LINE.test(trimmed) ? "failed" : "executed",
      detail: redactReviewDetail(trimmed),
    });
  }
  const build = input.buildLog.trim();
  if (build && build !== "—") {
    checks.push({
      label: "Build lancé depuis l’interface",
      state: FAIL_LINE.test(build) ? "failed" : "executed",
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
      detail: "Aucune commande de vérification n’a été lancée pour cette tâche.",
    });
  }
  return checks;
}
