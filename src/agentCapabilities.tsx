import type { ReactNode } from "react";

const ROWS: { agent: string; can: string[]; cannot: string[] }[] = [
  {
    agent: "studio_project_manager",
    can: [
      "Orchestrer chaque demande Code Studio (racine)",
      "Créer des plans dans specs/ pour les évolutions",
      "delegate_to_agent vers les agents studio / qa / code",
    ],
    cannot: ["Délégation depuis les sous-tâches (réservé au manager)"],
  },
  {
    agent: "studio_planner",
    can: ["Lire le dépôt", "Mettre à jour CODE_STUDIO_PLAN.md", "git/diagnostic en lecture seule"],
    cannot: ["Modifier le code applicatif", "run_command mutateur", "Installer des paquets"],
  },
  {
    agent: "studio_scaffold",
    can: ["Créer la structure minimale", "Manifestes, README", "Plan par sections"],
    cannot: ["Remplacer tout le dépôt sans accord"],
  },
  {
    agent: "studio_frontend",
    can: ["UI, styles, accessibilité", "Build / lint côté front"],
    cannot: ["Schéma DB sans demande"],
  },
  {
    agent: "studio_backend",
    can: ["API, config, CORS", "Tests ciblés"],
    cannot: ["Frontend sans lien tâche"],
  },
  {
    agent: "studio_fullstack",
    can: ["Coordination FE+BE", "Contrats API"],
    cannot: ["Périmètre hors plan sans validation"],
  },
];

export function AgentCapabilitiesTable(): ReactNode {
  return (
    <div className="agent-capabilities">
      <table className="agent-capabilities-table">
        <thead>
          <tr>
            <th>Agent</th>
            <th>Orientations</th>
            <th>Limites</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.agent}>
              <td>
                <code>{r.agent}</code>
              </td>
              <td>
                <ul>
                  {r.can.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </td>
              <td>
                <ul>
                  {r.cannot.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">
        Source de vérité : prompts spécialistes du daemon. Ce tableau est une aide à la lecture seule.
      </p>
    </div>
  );
}
