export function formatTaskStatusFr(status: string): string {
  const m: Record<string, string> = {
    pending: "En attente",
    queued: "En file",
    running: "En cours (LLM / outils)",
    completed: "Terminé",
    failed: "Échec",
    paused: "En pause",
    cancelled: "Annulé",
    waiting_user_input: "Attente de votre réponse",
    interrupted: "Interrompu",
  };
  return m[status] ?? status;
}

export function isStubProgressMessage(msg: string): boolean {
  const t = msg.trim();
  if (t.length === 0) return true;
  const stubs = new Set([
    "Terminé.",
    "Done.",
    "Échec.",
    "Annulé.",
    "Failed.",
    "Cancelled.",
    "Sous-tâches en cours.",
  ]);
  if (stubs.has(t)) return true;
  if (t.startsWith("Task delegated to agent")) return true;
  return false;
}

export function looksLikeTimeoutMessage(msg: string): boolean {
  const t = msg.toLowerCase();
  return (
    t.includes("timeout") ||
    t.includes("timed out") ||
    t.includes("délai") ||
    t.includes("delai") ||
    t.includes("deadline") ||
    t.includes("etimedout") ||
    t.includes("504") ||
    t.includes("408")
  );
}

export function looksLikeContextWindowFailure(message: string | null | undefined): boolean {
  const text = message?.toLowerCase() ?? "";
  return text.includes("context_window_exceeded")
    || text.includes("maximum context length")
    || (text.includes("context") && text.includes("too many tokens"));
}

export function looksLikeModelTransportFailure(message: string | null | undefined): boolean {
  return !!message && (message.includes("provider_generation_failed:") || looksLikeTimeoutMessage(message));
}

export function isLocalContextWindowPreflightFailure(message: string | null | undefined): boolean {
  return message?.toLowerCase().includes("context_window_preflight_rejected") ?? false;
}

export function buildInitialProjectRequest(name: string, summary: string): string {
  const projectName = name.trim() || "Nouveau projet";
  const projectSummary = summary.trim();
  return projectSummary
    ? `Crée le projet « ${projectName} » selon ce résumé :\n\n${projectSummary}`
    : `Crée le projet « ${projectName} ».`;
}

export function looksLikeStructuredRefusal(text: string): boolean {
  const t = text.trim();
  if (/^refus\b/i.test(t)) return true;
  if (/^acceptation\b/i.test(t)) return false;
  return (
    t.includes("Refus :") ||
    t.includes("Refus collectif") ||
    t.includes("merci d'arrêter") ||
    t.includes("merci d'arrêter cette action")
  );
}

export function chatMessageForTerminalTask(
  status: string,
  lastProgressMessage: string | undefined,
  failureDetail?: string | null,
): string {
  const last = lastProgressMessage?.trim();
  const detail = failureDetail?.trim();
  if (status === "completed") {
    if (last && !isStubProgressMessage(last)) {
      return last;
    }
    return "La tâche est terminée. Les nouveaux fichiers apparaissent dans l’arborescence (rafraîchissement automatique).";
  }
  if (status === "failed") {
    const body =
      detail && (!last || isStubProgressMessage(last))
        ? detail
        : last && !isStubProgressMessage(last)
          ? last
          : detail || null;
    if (body) {
      if (looksLikeContextWindowFailure(body)) {
        if (isLocalContextWindowPreflightFailure(body)) {
          return "Code Studio a bloqué l’appel avant de contacter le modèle : la demande, les règles, les outils et le contexte récent ne tenaient pas dans la fenêtre configurée. Aucun appel au modèle ni outil n’a été exécuté. Pour continuer, choisissez un modèle avec une fenêtre plus grande ou augmentez le contexte Ollama (`model_options.<modèle>.num_ctx` / `AKASHA_OLLAMA_NUM_CTX`) si la mémoire disponible le permet. Le détail de la tâche indique l’estimation et le budget restants.";
        }
        return "Le fournisseur du modèle a refusé la requête parce que son contexte est trop volumineux. Vérifiez le détail de la tâche, puis choisissez un modèle à fenêtre plus grande, augmentez le contexte configuré si les ressources le permettent, ou réduisez le contexte facultatif avant de relancer.";
      }
      if (body.includes("tool_protocol_error") || body.includes("LFM2 tool generation incomplete")) {
        return `Le modèle a proposé un appel d’outil invalide pour cette étape. Cet appel a été refusé avant exécution. Le détail de la tâche conserve les autres opérations éventuelles.\n\n${body}\n\nVérifiez les outils autorisés pour le rôle et la compatibilité du modèle. Ce diagnostic ne prouve pas une panne réseau ni un manque de mémoire.`;
      }
      if (body.includes("studio_routes_exhausted")) {
        return `Aucune route de modèle compatible n’a permis de poursuivre. Les tentatives automatiques sont arrêtées ; le ticket conserve son état et son checkpoint.\n\n${body}`;
      }
      const hint = looksLikeModelTransportFailure(body)
        ? "\n\nConsultez le modèle et les tentatives dans le détail de la tâche. Vérifiez que le service du modèle répond. Utilisez « Reprendre la tâche » pour conserver le ticket et l’avancement enregistrés."
        : "";
      const diagnostic = body.replace(/^provider_generation_failed:\s*/, "Le fournisseur n’a pas terminé la génération : ");
      return diagnostic.length > 2800 ? `${diagnostic.slice(0, 2800)}…${hint}` : `${diagnostic}${hint}`;
    }
    return "Échec sans détail persisté. Vérifiez l’onglet « Logs serveur », le journal de build, ou renvoyez la consigne pour une nouvelle tentative.";
  }
  if (status === "cancelled") {
    if (detail && (!last || isStubProgressMessage(last))) return detail;
    if (last && !isStubProgressMessage(last)) return last;
    return "La tâche a été annulée.";
  }
  if (status === "waiting_user_input") {
    return "Le daemon attend une validation (approbation d’outil ou question utilisateur).";
  }
  return `État : ${formatTaskStatusFr(status)}`;
}

export function isMarkdownPath(path: string | null): boolean {
  if (!path) return false;
  const p = path.toLowerCase();
  return p.endsWith(".md") || p.endsWith(".markdown") || p.endsWith(".mdx");
}

export function extractTicketDraftsFromPlan(planText: string): { title: string; description: string }[] {
  const lines = planText.split(/\r?\n/);
  const drafts: { title: string; description: string }[] = [];
  let currentSection = "";
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("## ")) {
      currentSection = line.replace(/^##\s+/, "").trim();
      continue;
    }
    // Accept TODO markdown checklists and task bullets.
    if (/^-\s+\[\s?\]\s+/.test(line) || /^-\s+/.test(line)) {
      const title = line
        .replace(/^-\s+\[\s?\]\s+/, "")
        .replace(/^-+\s+/, "")
        .trim();
      if (!title || title.length < 3) continue;
      drafts.push({
        title: title.slice(0, 200),
        description: currentSection ? `Source plan section: ${currentSection}` : "Imported from CODE_STUDIO_PLAN.md",
      });
    }
  }
  // de-duplicate by case-insensitive title
  const seen = new Set<string>();
  return drafts.filter((d) => {
    const k = d.title.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function dedupeProgressForTrace(
  progress: { progress_pct: number; message: string; task_id?: string | null }[],
  taskId: string,
): { progress_pct: number; message: string; task_id?: string | null }[] {
  const deduped = new Map<string, { progress_pct: number; message: string; task_id?: string | null }>();
  for (const p of progress) {
    const raw = (p.message ?? "").trim();
    if (!raw) continue;
    // Streamed progress emits many near-identical updates for the same percentage.
    // Keep only the latest message per (task_id, progress_pct).
    const k = `${p.task_id ?? taskId}\0${p.progress_pct}`;
    deduped.set(k, p);
  }
  return Array.from(deduped.values()).sort((a, b) => a.progress_pct - b.progress_pct);
}
