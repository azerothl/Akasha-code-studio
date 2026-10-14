export type DeliveryStepId = "ask" | "follow" | "review" | "verify" | "merge";

export const DELIVERY_STEPS: { id: DeliveryStepId; label: string }[] = [
  { id: "ask", label: "Demander" },
  { id: "follow", label: "Suivre" },
  { id: "review", label: "Examiner" },
  { id: "verify", label: "Vérifier" },
  { id: "merge", label: "Fusionner" },
];

export type DeliveryFocus = {
  current: DeliveryStepId;
  next: string;
  target: "chat" | "preview" | "branches" | "dashboard";
};

export function resolveDeliveryFocus(input: {
  hasProject: boolean;
  taskRunning: boolean;
  taskFinished: boolean;
  dirty: boolean;
  hasEvolution: boolean;
  verifyRan: boolean;
}): DeliveryFocus {
  if (!input.hasProject) {
    return {
      current: "ask",
      next: "Créer ou charger un projet, puis envoyer une demande.",
      target: "dashboard",
    };
  }
  if (input.taskRunning) {
    return {
      current: "follow",
      next: "Suivre la tâche active dans le chat.",
      target: "chat",
    };
  }
  if (input.taskFinished || input.dirty) {
    if (!input.verifyRan) {
      return {
        current: "review",
        next: "Examiner le diff, puis lancer l’aperçu ou le build.",
        target: "chat",
      };
    }
    if (input.hasEvolution) {
      return {
        current: "merge",
        next: "Fusionner l’évolution après la revue.",
        target: "branches",
      };
    }
    return {
      current: "verify",
      next: "La vérification a tourné. Préparez une évolution ou relancez le contrôle.",
      target: "preview",
    };
  }
  return {
    current: "ask",
    next: "Envoyer une demande à l’agent.",
    target: "chat",
  };
}
