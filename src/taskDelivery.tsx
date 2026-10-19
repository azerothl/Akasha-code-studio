import { useEffect, useRef, useState } from "react";
import { normalizeHttpError } from "./api";
import { Button } from "./components/ui/button";
import { redactSecrets } from "./sendContext";

type FileRow = { path: string; status: string; version: string | null; unavailable?: string };
type Snapshot = { head: string; branch: string | null; files: FileRow[]; files_truncated: boolean; author_configured: boolean; remote_head: string | null; remote_error?: string; repository: string | null; github: { accessible?: boolean; can_push?: boolean; default_branch?: string; reason?: string }; available_actions: { commit: boolean; push: boolean; create_pr: boolean; read_pr: boolean } };
type DeliveryResult = { success?: boolean; result_unknown?: boolean; state?: string; error?: string; detail?: string; commit?: string; branch?: string; warning?: string; record_warning?: string; pr?: { number: number; url: string; state?: string; isDraft?: boolean; headRefOid?: string; statusCheckRollup?: { name?: string; context?: string; status?: string; conclusion?: string; state?: string }[] }; checks_state?: string; current_head_checks?: string; local_head?: string };
type History = { status: string; execution_active: boolean; unknown_count: number; records: { kind: string; recorded_at: string; result: DeliveryResult }[] };
type Pending = { action: "commit" | "push" | "pr"; operation_id: string; expected_repository: string | null; request: unknown };

async function read<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal });
  if (!response.ok) throw await normalizeHttpError("GET", path, response);
  const result = await response.json() as T & { success?: boolean; error?: string };
  if (result.success === false) throw new Error(result.error ?? "Lecture de livraison indisponible");
  return result;
}
const labels: Record<string, string> = { passed: "Contrôles réussis", not_run: "Aucun contrôle CI remonté", pending: "Contrôles en attente", failed: "Échec des contrôles", passed_with_skipped_or_neutral: "Résultats avec contrôles ignorés ou neutres", unknown: "État inconnu", stale_for_local_head: "Résultats d’un autre commit" };
function githubUrl(value?: string): string | undefined { try { const url = new URL(value ?? ""); return url.protocol === "https:" && url.hostname === "github.com" ? url.toString() : undefined; } catch { return undefined; } }

export function TaskDeliveryPanel({ projectId, taskId }: { projectId: string; taskId: string }) {
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [history, setHistory] = useState<History | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [remoteDraft, setRemoteDraft] = useState("origin");
  const [remote, setRemote] = useState("origin");
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [base, setBase] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [number, setNumber] = useState("");
  const [result, setResult] = useState<DeliveryResult | null>(null);
  const [ci, setCi] = useState<DeliveryResult | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [refresh, setRefresh] = useState(0);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const endpoint = `/api/studio/projects/${encodeURIComponent(projectId)}/delivery`;
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController(); setLoading(true); setError(""); setSnapshot(null); setHistory(null); setSelected([]);
    void Promise.allSettled([
      read<Snapshot>(`${endpoint}/status?remote=${encodeURIComponent(remote)}`, controller.signal),
      read<History>(`/api/tasks/${encodeURIComponent(taskId)}/delivery`, controller.signal),
    ]).then(([status, records]) => {
      if (controller.signal.aborted) return;
      const errors: string[] = [];
      if (status.status === "fulfilled" && Array.isArray(status.value.files)) { setSnapshot(status.value); setBase(current => current || status.value.github.default_branch || ""); } else errors.push(status.status === "rejected" ? String(status.reason) : "Contrat de livraison incompatible");
      if (records.status === "fulfilled" && Array.isArray(records.value.records)) {
        setHistory(records.value);
        const pr = records.value.records.find(record => record.result.pr?.number)?.result.pr;
        if (pr) setNumber(current => current || String(pr.number));
      } else errors.push(records.status === "rejected" ? String(records.reason) : "Historique de livraison incompatible");
      setError(errors.join("\n")); setLoading(false);
    });
    return () => controller.abort();
  }, [open, endpoint, taskId, remote, refresh]);
  const stopped = history && !history.execution_active && !["pending", "queued", "running", "waiting_user_input"].includes(history.status);
  const canMutate = Boolean(stopped && history?.unknown_count === 0 && !loading && !busy && !pending);
  const execute = async (operation: Pending) => {
    setBusy(true); setError(""); setPending(operation);
    try {
      const url = `${endpoint}/${operation.action}`;
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task_id: taskId, operation_id: operation.operation_id, expected_repository: operation.expected_repository, request: operation.request }) });
      if (!response.ok) throw await normalizeHttpError("POST", url, response);
      const payload = await response.json() as { result: DeliveryResult };
      if (!alive.current) return;
      setResult(payload.result);
      if (!payload.result.result_unknown) setPending(null);
      if (payload.result.success === false) setError(payload.result.error ?? payload.result.warning ?? "Action partielle ; consultez le résultat.");
      if (payload.result.pr?.number) setNumber(String(payload.result.pr.number));
      setRefresh(value => value + 1);
    } catch (reason) { if (alive.current) setError(`Résultat de la requête non confirmé. Inspectez les effets avant de réessayer. ${String(reason)}`); }
    finally { if (alive.current) setBusy(false); }
  };
  const start = (action: Pending["action"], request: unknown) => void execute({ action, request, expected_repository: snapshot?.repository ?? null, operation_id: crypto.randomUUID() });
  const inspectCi = async () => {
    setBusy(true); setError(""); setCi(null);
    try {
      const url = `${endpoint}/pr?remote=${encodeURIComponent(remote)}&task_id=${encodeURIComponent(taskId)}${number ? `&number=${encodeURIComponent(number)}` : ""}`;
      const value = await read<DeliveryResult>(url);
      if (alive.current) setCi(value);
      const updated = await read<History>(`/api/tasks/${encodeURIComponent(taskId)}/delivery`);
      if (alive.current) setHistory(updated);
    } catch (reason) { if (alive.current) setError(String(reason)); } finally { if (alive.current) setBusy(false); }
  };
  const commit = () => {
    if (!snapshot) return;
    const versions = Object.fromEntries(snapshot.files.filter(file => selected.includes(file.path) && file.version).map(file => [file.path, file.version]));
    start("commit", { paths: selected, expected_versions: versions, expected_head: snapshot.head, message });
  };
  const link = githubUrl(result?.pr?.url);
  return <details className="task-delivery" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Livraison Git / PR / CI</summary>
    {open ? <>
      <p className="hint">Les actions portent sur le projet actuellement sélectionné. Intégrez d’abord les changements d’un worktree si nécessaire. Chaque étape est déclenchée séparément.</p>
      <div className="studio-observation-actions"><label>Remote <input value={remoteDraft} onChange={event => setRemoteDraft(event.target.value)} maxLength={100} disabled={busy} /></label><Button size="sm" variant="secondary" disabled={busy || loading} onClick={() => { setRemote(remoteDraft); setCi(null); setRefresh(value => value + 1); }}>Actualiser</Button></div>
      {loading ? <p role="status">Lecture du dépôt et des accès…</p> : null}
      {error ? <pre className="build-pre" role="alert">{redactSecrets(error)}</pre> : null}
      {snapshot ? <>
        <p>Branche : <code>{snapshot.branch ?? "détachée"}</code> · Commit : <code>{snapshot.head.slice(0, 12)}</code> · Dépôt : {snapshot.repository ?? "remote GitHub indisponible"}</p>
        <p className="hint">GitHub : {snapshot.github.accessible ? snapshot.github.can_push ? "accès en écriture confirmé" : "accès en lecture" : "accès non confirmé"}{snapshot.github.reason ? ` — ${redactSecrets(snapshot.github.reason)}` : ""}</p>
        {snapshot.remote_error ? <p className="hint">Branche distante non lue : {redactSecrets(snapshot.remote_error)}</p> : null}
        {!stopped ? <p className="hint">La tâche doit être arrêtée avant les actions de livraison.</p> : null}
        {history?.unknown_count ? <p role="status">{history.unknown_count} résultat(s) inconnu(s) : utilisez la section de reprise après inspection.</p> : null}
        <details><summary>1. Commit local — choisir les fichiers</summary>
          {!snapshot.author_configured ? <p className="hint">Configurez l’identité Git avant de créer le commit.</p> : null}
          {snapshot.files_truncated ? <p className="hint">Liste limitée à 256 entrées. Réduisez les changements ou utilisez une sélection plus ciblée.</p> : null}
          <ul className="task-delivery-files">{snapshot.files.map(file => <li key={file.path}><label><input type="checkbox" checked={selected.includes(file.path)} disabled={!canMutate || !file.version} onChange={event => setSelected(previous => event.target.checked ? [...previous, file.path] : previous.filter(path => path !== file.path))} /> <code>{file.status} {file.path}</code></label>{file.unavailable ? <span className="hint"> — {file.unavailable}</span> : null}</li>)}</ul>
          <label>Message du commit <textarea value={message} onChange={event => setMessage(event.target.value)} maxLength={16384} disabled={busy} /></label>
          <Button size="sm" disabled={!canMutate || !snapshot.available_actions.commit || !snapshot.author_configured || !snapshot.branch || !selected.length || selected.length > 128 || !message.trim()} onClick={commit}>Créer le commit local ({selected.length} fichier(s))</Button>
        </details>
        <details><summary>2. Publier cette branche</summary>
          <p className="hint">Commit distant connu : {snapshot.remote_head ?? "non confirmé"}. Le push cible uniquement le commit affiché, sans force.</p>
          <Button size="sm" disabled={!canMutate || !snapshot.available_actions.push || !snapshot.github.can_push || !snapshot.branch || !snapshot.remote_head || snapshot.head === "unborn"} onClick={() => start("push", { remote, branch: snapshot.branch, expected_head: snapshot.head, expected_remote_head: snapshot.remote_head })}>Publier ce commit sur {remote}</Button>
        </details>
        <details><summary>3. Créer une PR brouillon</summary>
          <label>Branche cible <input value={base} onChange={event => setBase(event.target.value)} maxLength={200} disabled={busy} /></label>
          <label>Titre <input value={title} onChange={event => setTitle(event.target.value)} maxLength={256} disabled={busy} /></label>
          <label>Description <textarea value={body} onChange={event => setBody(event.target.value)} maxLength={65536} disabled={busy} /></label>
          <Button size="sm" disabled={!canMutate || !snapshot.available_actions.create_pr || !snapshot.github.can_push || !snapshot.branch || !base || base === snapshot.branch || !title.trim() || snapshot.remote_head !== snapshot.head} onClick={() => start("pr", { remote, head: snapshot.branch, base, expected_head: snapshot.head, title, body, draft: true })}>Créer la PR brouillon</Button>
        </details>
        <details><summary>4. Consulter la PR et ses contrôles</summary>
          <label>Numéro de PR (facultatif) <input type="number" min={1} value={number} onChange={event => setNumber(event.target.value)} disabled={busy} /></label>
          <Button size="sm" variant="secondary" disabled={busy || !snapshot.available_actions.read_pr || !snapshot.github.accessible || Boolean(number && (!Number.isInteger(Number(number)) || Number(number) <= 0))} onClick={() => void inspectCi()}>Lire PR / CI</Button>
          {ci ? <><p>{labels[ci.current_head_checks ?? "unknown"] ?? ci.current_head_checks} · PR #{ci.pr?.number} · commit {ci.pr?.headRefOid?.slice(0, 12)}</p>{githubUrl(ci.pr?.url) ? <a href={githubUrl(ci.pr?.url)} target="_blank" rel="noopener noreferrer">Ouvrir la PR</a> : null}<ul>{ci.pr?.statusCheckRollup?.map((check, index) => <li key={`${check.name ?? check.context}-${index}`}>{check.name ?? check.context} : {check.conclusion || check.status || check.state || "inconnu"}</li>)}</ul></> : null}
        </details>
      </> : null}
      {result ? <p role="status">Résultat : {result.state ?? result.error ?? "enregistré"}{result.commit ? ` · commit ${result.commit.slice(0, 12)}` : ""}{link ? <> · <a href={link} target="_blank" rel="noopener noreferrer">Ouvrir la PR</a></> : null}{result.record_warning ? ` · Suivi partiel : ${redactSecrets(result.record_warning)}` : ""}</p> : null}
      {pending ? <div><p className="hint">Opération {pending.operation_id.slice(0, 8)} : résultat à confirmer.</p><Button size="sm" variant="secondary" disabled={busy || !stopped} onClick={() => void execute(pending)}>Réessayer avec le même identifiant</Button><Button size="sm" variant="ghost" disabled={busy || loading || !stopped || history?.unknown_count !== 0} onClick={() => setPending(null)}>Effets inspectés : préparer une nouvelle action</Button></div> : null}
      {history?.records.length ? <details><summary>Historique lié à cette tâche</summary><ul>{history.records.map((record, index) => <li key={`${record.recorded_at}-${index}`}>{record.result.state ?? record.kind} · {record.result.branch ?? ""} {record.result.commit?.slice(0, 12) ?? ""}{githubUrl(record.result.pr?.url) ? <> · <a href={githubUrl(record.result.pr?.url)} target="_blank" rel="noopener noreferrer">PR #{record.result.pr?.number}</a></> : null}</li>)}</ul></details> : null}
    </> : null}
  </details>;
}
