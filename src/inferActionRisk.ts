/** Heuristique légère pour l’UI (pas un classifieur côté serveur). */
export type ActionRiskLevel = "low" | "medium" | "high";

export function inferActionRisk(text: string): ActionRiskLevel {
  const t = text.toLowerCase();
  const high = [
    "rm ",
    "delete",
    "supprim",
    "format",
    "drop ",
    "credential",
    "secret",
    "password",
    "token",
    "curl ",
    "wget ",
    "chmod 777",
    "registry",
    "npm publish",
    "git push",
    "force",
    "sudo",
  ];
  const medium = [
    "install",
    "npm i",
    "pip install",
    "cargo install",
    "write_file",
    "edit_file",
    "run_command",
    "merge",
    "commit",
    "network",
    "http",
  ];
  if (high.some((k) => t.includes(k))) return "high";
  if (medium.some((k) => t.includes(k))) return "medium";
  return "low";
}

export function riskLabel(level: ActionRiskLevel): string {
  switch (level) {
    case "low":
      return "Risque faible";
    case "medium":
      return "Risque moyen";
    case "high":
      return "Risque élevé";
  }
}
