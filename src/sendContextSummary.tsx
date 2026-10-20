import { Button } from "./components/ui/button";
import { useState } from "react";
import { AgentCapabilitiesTable } from "./agentCapabilities";
import type { SendContextSummary } from "./sendContext";

type Props = {
  projectId?: string | null;
  summary: SendContextSummary;
  includeFileRefs: boolean;
  includeCriteria: boolean;
  includeDesign: boolean;
  includePolicy: boolean;
  onIncludeFileRefs: (value: boolean) => void;
  onIncludeCriteria: (value: boolean) => void;
  onIncludeDesign: (value: boolean) => void;
  onIncludePolicy: (value: boolean) => void;
};

export function SendContextSummaryPanel({
  projectId,
  summary,
  includeFileRefs,
  includeCriteria,
  includeDesign,
  includePolicy,
  onIncludeFileRefs,
  onIncludeCriteria,
  onIncludeDesign,
  onIncludePolicy,
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <details className="send-context" aria-label="Contexte envoyé avec le message" onToggle={event => setOpen(event.currentTarget.open)}>
      <summary className="send-context-title">Contexte{summary.fileRefs.length ? ` · ${summary.fileRefs.length} fichier(s)` : " et permissions"}</summary>
      <ul className="send-context-list">
        <li>Agent demandé : {summary.agent}</li>
        <li>Mode : {summary.codeMode}</li>
        <li>
          Modèle du dernier tour : {summary.modelLabel || "indisponible avant le premier tour"}
          {summary.providerLabel ? ` · ${summary.providerLabel}` : ""}
        </li>
        <li>Modèle demandé pour la prochaine tâche : {summary.requestedModelLabel || "Automatique"}. Le choix automatique utilise le routage du daemon.</li>
        <li>Permissions : {summary.permissionMode}</li>
        <li>Index code : {summary.ragLabel}</li>
        <li>Design : {summary.designIncluded ? "inclus" : "non inclus"}</li>
        <li>Critères : {summary.criteriaIncluded ? "inclus" : "non inclus"}</li>
        <li>Références @fichier : {includeFileRefs ? "incluses" : "retirées"}</li>
      </ul>
      {open ? <AgentCapabilitiesTable projectId={projectId} codeMode={summary.codeMode} /> : null}
      <div className="send-context-refs">
        {summary.fileRefs.length === 0 ? (
          <p className="hint">Aucune référence @fichier dans le message.</p>
        ) : (
          summary.fileRefs.map((ref) => (
            <p key={ref.path} className="hint">
              @{ref.path} — {ref.available ? "résolu dans le projet" : "introuvable dans l’index de fichiers"}
            </p>
          ))
        )}
      </div>
      {summary.criteriaPreview ? <p className="hint">Critères : {summary.criteriaPreview}</p> : null}
      {summary.policyPreview ? <p className="hint">Consigne : {summary.policyPreview}</p> : null}
      <div className="send-context-toggles">
        <Button type="button" size="sm" variant={includeFileRefs ? "default" : "secondary"} onClick={() => onIncludeFileRefs(!includeFileRefs)}>
          {includeFileRefs ? "Retirer @fichiers" : "Inclure @fichiers"}
        </Button>
        <Button type="button" size="sm" variant={includeCriteria ? "default" : "secondary"} onClick={() => onIncludeCriteria(!includeCriteria)}>
          {includeCriteria ? "Retirer critères" : "Inclure critères"}
        </Button>
        <Button type="button" size="sm" variant={includeDesign ? "default" : "secondary"} onClick={() => onIncludeDesign(!includeDesign)}>
          {includeDesign ? "Retirer design" : "Inclure design"}
        </Button>
        <Button type="button" size="sm" variant={includePolicy ? "default" : "secondary"} onClick={() => onIncludePolicy(!includePolicy)}>
          {includePolicy ? "Retirer consigne" : "Inclure consigne"}
        </Button>
      </div>
    </details>
  );
}
