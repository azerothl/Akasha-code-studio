import { useEffect, useState } from "react";
import { fetchStudioCapabilities, type StudioCapabilities } from "./api";
import { Button } from "./components/ui/button";
import { AsyncState } from "./asyncState";

export function AgentCapabilitiesTable({ projectId, taskId, codeMode }: { projectId?: string | null; taskId?: string | null; codeMode?: string }) {
  const [payload, setPayload] = useState<StudioCapabilities | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    setPayload(null); setError("");
    if (!projectId) { setLoading(false); return; }
    const abort = new AbortController();
    setLoading(true);
    void fetchStudioCapabilities(projectId, taskId, abort.signal, codeMode)
      .then(data => { if (!abort.signal.aborted) setPayload(data); })
      .catch(reason => { if (!abort.signal.aborted) setError(String(reason)); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [projectId, taskId, codeMode, revision]);
  if (!projectId) return <p className="hint">Sélectionnez un projet pour consulter ses capacités effectives.</p>;
  if (loading) return <AsyncState kind="loading" title="Lecture des capacités du daemon…" />;
  if (error) return <AsyncState kind="partial" title="Capacités contextuelles indisponibles" detail={error} action={{ label: "Réessayer", onClick: () => setRevision(value => value + 1) }} />;
  if (!payload) return null;
  const announced = payload.tools.filter(tool => tool.announced);
  const unavailable = payload.tools.filter(tool => !tool.announced);
  const list = (tools: StudioCapabilities["tools"]) => <ul className="task-review-checks">{tools.map(tool => <li key={tool.name}>
    <code>{tool.name}</code> · {tool.runnable ? "prérequis détectés" : tool.allowed ? "prérequis manquants" : "non autorisé pour ce contexte"}
    {tool.requires_user_approval ? " · approbation prévue par la politique" : ""}
    <details><summary>Règles et prérequis</summary>
      <p className="hint">{tool.description}</p>
      <p className="hint">Sources : {(tool.rule_sources ?? []).join(" · ") || "non précisées"}</p>
      <p className="hint">Prérequis : {(tool.prerequisites ?? []).join(" · ") || "contrôles des arguments à l’invocation"}</p>
      {(tool.notes ?? []).length ? <p className="hint">{tool.notes.join(" · ")}</p> : null}
    </details>
  </li>)}</ul>;
  return <div className="agent-capabilities">
    <p className="hint">{payload.preview ? "Prévisualisation du prochain rôle racine" : "Rôle enregistré pour cette tâche"} : <code>{payload.agent}</code> · profil {payload.default_profile ?? "sans filtre de profil"}.</p>
    <p>{announced.length} outil(s) annoncé(s). Disponibilité déclarée après préflight ; leur exécution reste soumise aux arguments, chemins, approbations et budgets.</p>
    <details><summary>Outils annoncés ({announced.length})</summary>{list(announced)}</details>
    <details><summary>Outils exclus ou indisponibles ({unavailable.length})</summary>{list(unavailable)}</details>
    <details><summary>Skills disponibles ({payload.skills?.length ?? 0})</summary>
      <ul>{(payload.skills ?? []).map(skill => <li key={skill.name}>
        <strong>{skill.name}</strong>{skill.version ? ` · v${skill.version}` : ""} — {skill.description}
        <p className="hint" style={{ overflowWrap: "anywhere" }}>Source : {skill.source_root ?? "non précisée"} · SHA-256 : {skill.sha256 ?? "non précisé"}</p>
      </li>)}</ul>
    </details>
    <details><summary>Règles à la racine ({payload.rules?.length ?? 0})</summary>
      <p className="hint">Les AGENTS.md plus spécifiques sont chargés lors de l’accès aux fichiers concernés. Ces instructions ne changent pas les permissions.</p>
      <ul>{(payload.rules ?? []).map(rule => <li key={rule.path} style={{ overflowWrap: "anywhere" }}>{rule.path} · SHA-256 : {rule.sha256}</li>)}</ul>
    </details>
    {payload.active_context ? <details><summary>Contexte activé dans cette tâche</summary>
      {payload.active_context.error ? <p className="hint">Historique d’activation indisponible : {payload.active_context.error}</p> : null}
      <ul>{payload.active_context.rules.map(rule => <li key={`${rule.path}-${rule.sha256}`} style={{ overflowWrap: "anywhere" }}>Règle : {rule.path} · {rule.sha256}</li>)}
      {payload.active_context.skills.map((skill, index) => <li key={`${skill.name}-${index}`} style={{ overflowWrap: "anywhere" }}>Skill : {skill.name}{skill.version ? ` v${skill.version}` : ""}{skill.resource ? ` · ressource ${skill.resource}` : ""} · {skill.source_root} · {skill.resource_sha256 ?? skill.sha256}</li>)}</ul>
      {payload.active_context.rules.length + payload.active_context.skills.length === 0 ? <p className="hint">Aucune activation enregistrée pour cette tâche.</p> : null}
    </details> : null}
    {payload.generated_at ? <p className="hint">Préflight : {new Date(payload.generated_at).toLocaleString("fr-FR")}. Actualisez pour voir les nouvelles activations.</p> : null}
    <Button type="button" size="sm" variant="ghost" onClick={() => setRevision(value => value + 1)}>Actualiser les capacités</Button>
  </div>;
}
