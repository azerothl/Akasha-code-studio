import { useEffect, useState } from "react";
import { normalizeHttpError } from "./api";
import { Button } from "./components/ui/button";
import { redactSecrets } from "./sendContext";

type Recovery = {
  execution_active: boolean;
  checkpoint: { phase: string; round: number; waiting?: unknown; session_id: string } | null;
  ledger: { unknown_count: number; operations: { operation_id: string; tool: string; state: string; result?: unknown }[] };
  children: { task_id: string; status: string; agent: string }[];
};
export function TaskRecoveryPanel({ taskId }: { taskId: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Recovery | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [operation, setOperation] = useState("");
  const [decision, setDecision] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const path = `/api/tasks/${encodeURIComponent(taskId)}/recovery`;
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController(); setData(null); setError("");
    void fetch(path, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw await normalizeHttpError("GET", path, response);
      const value = await response.json() as Recovery;
      if (!Array.isArray(value.ledger?.operations) || !Array.isArray(value.children)) throw new Error("Contrat de reprise indisponible");
      if (!controller.signal.aborted) setData(value);
    }).catch(reason => { if (!controller.signal.aborted) setError(String(reason)); });
    return () => controller.abort();
  }, [open, path, refresh]);
  const resolve = async () => {
    setBusy(true); setError("");
    try {
      const url = `${path}/operations/${encodeURIComponent(operation)}/resolve`;
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, note }) });
      if (!response.ok) throw await normalizeHttpError("POST", url, response);
      setOperation(""); setDecision(""); setNote(""); setRefresh(value => value + 1);
    } catch (reason) { setError(String(reason)); } finally { setBusy(false); }
  };
  return <details onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Reprise et opérations interrompues</summary>
    {open ? <>
      <p className="hint">La reprise est explicite. Une opération sans résultat enregistré doit être inspectée avant de débloquer les mutations.</p>
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => setRefresh(value => value + 1)}>Actualiser</Button>
      {error ? <p role="alert">{error}</p> : null}
      {data ? <>
        <p>{data.checkpoint ? `Checkpoint : ${data.checkpoint.phase} · tour ${data.checkpoint.round}` : "Aucun checkpoint durable."}{data.execution_active ? " · Exécution encore active." : ""}</p>
        {data.checkpoint?.waiting ? <pre className="build-pre">{redactSecrets(JSON.stringify(data.checkpoint.waiting, null, 2))}</pre> : null}
        {data.children.length ? <p className="hint">Sous-tâches : {data.children.map(child => `${child.agent} (${child.task_id.slice(0, 8)}) : ${child.status}`).join(" ; ")}</p> : null}
        <p>{data.ledger.unknown_count} opération(s) au résultat inconnu.</p>
        <ul>{data.ledger.operations.map(item => <li key={item.operation_id}>
          <code>{item.operation_id.slice(0, 8)}</code> · {item.tool} · {item.state}
          {item.state === "started" ? <Button size="sm" variant="secondary" disabled={busy || data.execution_active} onClick={() => { setOperation(item.operation_id); setDecision(""); setNote(""); }}>Consigner mon inspection</Button> : null}
        </li>)}</ul>
        {operation ? <form onSubmit={event => { event.preventDefault(); void resolve(); }}>
          <p className="hint">Mettez la tâche en pause et vérifiez ses effets. Cette décision est enregistrée ; elle ne relance aucune commande.</p>
          <label>Résultat observé <select required value={decision} onChange={event => setDecision(event.target.value)}><option value="">Choisir après inspection</option><option value="applied">Effets appliqués</option><option value="not_applied">Effets non appliqués</option></select></label>
          <label>Constat <textarea required minLength={8} maxLength={2000} value={note} onChange={event => setNote(event.target.value)} /></label>
          <Button type="submit" size="sm" disabled={busy || data.execution_active || !decision || note.trim().length < 8}>Enregistrer la décision</Button>
        </form> : null}
      </> : !error ? <p role="status">Chargement…</p> : null}
    </> : null}
  </details>;
}
