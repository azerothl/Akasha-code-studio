import { useEffect, useState } from "react";
import { Button } from "./components/ui/button";
import { redactSecrets } from "./sendContext";
import { decodeBytes, listTaskArtifacts, readTaskArtifact, type TaskArtifact } from "./studioObservationApi";

export function TaskArtifactsPanel({ taskId }: { taskId: string }) {
  const [open, setOpen] = useState(false);
  const [records, setRecords] = useState<TaskArtifact[]>([]);
  const [selected, setSelected] = useState("");
  const [content, setContent] = useState<{ mime: string; text?: string; image?: string } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController(); setLoading(true); setError(""); setRecords([]);
    void listTaskArtifacts(taskId, controller.signal).then(value => {
      if (!Array.isArray(value.artifacts)) throw new Error("Réponse de preuves incompatible");
      setRecords(value.artifacts.filter(item => item.task_id === taskId && typeof item.id === "string" && ["image/png", "application/json", "text/plain"].includes(item.mime)));
    }).catch(reason => { if (!controller.signal.aborted) setError(String(reason)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [taskId, open, refresh]);
  useEffect(() => {
    setContent(null); if (!open || !selected) return;
    const controller = new AbortController(); setError("");
    void readTaskArtifact(taskId, selected, controller.signal).then(value => {
      if (value.artifact.task_id !== taskId || value.artifact.id !== selected) throw new Error("Preuve d’une autre tâche refusée");
      if (value.artifact.mime === "image/png") setContent({ mime: "image/png", image: `data:image/png;base64,${value.data_base64}` });
      else if (["application/json", "text/plain"].includes(value.artifact.mime)) setContent({ mime: value.artifact.mime, text: redactSecrets(new TextDecoder().decode(decodeBytes(value.data_base64))) });
    }).catch(reason => { if (!controller.signal.aborted) setError(String(reason)); });
    return () => controller.abort();
  }, [taskId, selected, open]);
  return <details className="task-artifacts" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Preuves de la tâche</summary>
    {open ? <>
      <p className="hint">Captures, journaux navigateur et extraits de terminal enregistrés par les outils. Une capture ne confirme pas à elle seule la réussite d’un scénario.</p>
      <Button size="sm" variant="secondary" onClick={() => { setSelected(""); setRefresh(value => value + 1); }}>Actualiser</Button>
      {loading ? <p role="status">Chargement…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {!loading && !error && !records.length ? <p className="hint">Aucune preuve enregistrée.</p> : null}
      <ul>{records.map(item => <li key={item.id}><Button size="sm" variant="ghost" aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}>{item.kind} · {Math.ceil(item.bytes / 1024)} Ko · {new Date(item.created_at).toLocaleString("fr")}</Button></li>)}</ul>
      {content?.image ? <a href={content.image} download={`preuve-${selected}.png`}><img className="task-artifact-image" src={content.image} alt="Capture enregistrée par l’agent pour cette tâche" /></a> : null}
      {content?.text != null ? <pre className="build-pre">{content.text}</pre> : null}
    </> : null}
  </details>;
}
