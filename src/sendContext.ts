const FILE_REF = /@([^\s@][^\s]*)/g;
const SECRET = /((?:api[_-]?key|secret|token|password|bearer)\s*[:=]\s*)(\S+)/gi;

export type FileRefStatus = {
  path: string;
  available: boolean;
};

export function redactSecrets(text: string): string {
  return text.replace(SECRET, "$1[masqué]");
}

export function parseAtFileRefs(message: string): string[] {
  const seen = new Set<string>();
  const refs: string[] = [];
  for (const match of message.matchAll(FILE_REF)) {
    const path = match[1]?.trim();
    if (!path || seen.has(path)) continue;
    seen.add(path);
    refs.push(path);
  }
  return refs;
}

export type SendContextInput = {
  message: string;
  files: string[];
  includeFileRefs: boolean;
  includeCriteria: boolean;
  criteriaRaw: string;
  includeDesign: boolean;
  includePolicy: boolean;
  policyHint: string;
  agent: string;
  codeMode: string;
  modelLabel: string;
  providerLabel: string;
  permissionMode: string | null;
  ragStatus: string | null;
  ragError: string | null;
};

export type SendContextSummary = {
  fileRefs: FileRefStatus[];
  criteriaIncluded: boolean;
  criteriaPreview: string;
  designIncluded: boolean;
  policyIncluded: boolean;
  policyPreview: string;
  agent: string;
  codeMode: string;
  modelLabel: string;
  providerLabel: string;
  permissionMode: string;
  ragLabel: string;
};

export function summarizeSendContext(input: SendContextInput): SendContextSummary {
  const known = new Set(input.files);
  const fileRefs = parseAtFileRefs(input.message).map((path) => ({
    path,
    available: known.has(path),
  }));
  const criteria = input.criteriaRaw.trim();
  const policy = input.policyHint.trim();
  return {
    fileRefs,
    criteriaIncluded: input.includeCriteria && criteria.length > 0,
    criteriaPreview: criteria ? redactSecrets(criteria).slice(0, 280) : "",
    designIncluded: input.includeDesign,
    policyIncluded: input.includePolicy && policy.length > 0,
    policyPreview: policy ? redactSecrets(policy).slice(0, 280) : "",
    agent: input.agent || "agent par défaut",
    codeMode: input.codeMode,
    modelLabel: input.modelLabel.trim(),
    providerLabel: input.providerLabel.trim(),
    permissionMode: input.permissionMode?.trim() || "indisponible",
    ragLabel: input.ragError
      ? "Index indisponible"
      : input.ragStatus === "ready"
        ? "Index prêt"
        : input.ragStatus === "stale"
          ? "Index obsolète"
          : input.ragStatus === "absent"
            ? "Pas d’index"
            : "Index indisponible",
  };
}
