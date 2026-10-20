export const STUDIO_ACTIONS = [
  {
    name: "goal",
    label: "Poursuivre un objectif",
    detail: "Objectif vérifiable, budget, pause et reprise.",
  },
  {
    name: "debug",
    label: "Diagnostiquer un problème",
    detail: "Reproduire, identifier la cause, corriger et vérifier.",
  },
  {
    name: "audit",
    label: "Auditer le projet",
    detail: "Revue en lecture seule et constats avec preuves.",
  },
  {
    name: "test",
    label: "Vérifier le projet",
    detail: "Choisir et lancer les vérifications pertinentes.",
  },
] as const;
export type StudioAction = (typeof STUDIO_ACTIONS)[number]["name"];
export function parseStudioAction(text: string): {
  action: StudioAction | null;
  prompt: string;
} {
  const match = /^\/(\S+)(?:\s+([\s\S]*))?$/.exec(text.trim());
  if (!match) return { action: null, prompt: text };
  if (!STUDIO_ACTIONS.some((item) => item.name === match[1]))
    throw new Error(
      `Commande /${match[1]} inconnue. Utilisez /goal, /debug, /audit ou /test.`,
    );
  if (!match[2]?.trim())
    throw new Error(`Précisez la demande après /${match[1]}.`);
  return { action: match[1] as StudioAction, prompt: match[2].trim() };
}
