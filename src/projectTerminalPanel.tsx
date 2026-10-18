import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { Button } from "./components/ui/button";
import * as observation from "./studioObservationApi";

export default function ProjectTerminalPanel({ projectId }: { projectId: string }) {
  const [catalogue, setCatalogue] = useState<observation.TerminalCatalogue | null>(null);
  const [session, setSession] = useState("");
  const [shell, setShell] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    void observation.listProjectTerminals(projectId, controller.signal).then(value => {
      setCatalogue(value);
      setShell(current => value.shells.some(item => item.id === current) ? current : value.shells[0]?.id ?? "");
      setSession(current => value.sessions.some(item => item.session_id === current) ? current : value.sessions[0]?.session_id ?? "");
    }).catch(reason => { if (!controller.signal.aborted) setError(String(reason)); });
    return () => controller.abort();
  }, [projectId, refresh]);

  useEffect(() => {
    if (!session || !host.current) return;
    const controller = new AbortController();
    let disposed = false, failedInput = false, cursor = 0, pendingBytes = 0;
    let polling: ReturnType<typeof setTimeout> | undefined;
    let resizing: ReturnType<typeof setTimeout> | undefined;
    let pendingInput = Promise.resolve();
    setExitCode(null);
    const term = new Terminal({ cursorBlink: true, fontSize: 13, scrollback: 2000, screenReaderMode: true, convertEol: false,
      theme: { background: "#111318", foreground: "#e4e7ec" },
      linkHandler: { activate: (_event, uri) => { if (/^https?:\/\//i.test(uri)) window.open(uri, "_blank", "noopener,noreferrer"); } },
    });
    const fit = new FitAddon();
    term.loadAddon(fit); term.open(host.current);
    const resize = () => {
      clearTimeout(resizing);
      resizing = setTimeout(() => {
        if (disposed) return;
        fit.fit();
        void observation.terminalResize(projectId, session, Math.max(20, Math.min(240, term.cols)), Math.max(5, Math.min(100, term.rows)))
          .catch(reason => { if (!disposed) setError(String(reason)); });
      }, 120);
    };
    const observer = new ResizeObserver(resize); observer.observe(host.current); resize();
    const input = term.onData(text => {
      pendingBytes += text.length;
      if (pendingBytes > 65536) { failedInput = true; setError("Saisie trop volumineuse. Reconnectez la session avant de reprendre."); return; }
      pendingInput = pendingInput.then(async () => {
        if (disposed || failedInput) return;
        try { await observation.terminalInput(projectId, session, text); pendingBytes -= text.length; }
        catch (reason) { failedInput = true; if (!disposed) setError(`Envoi interrompu ; reconnectez la session avant de saisir à nouveau. ${String(reason)}`); }
      });
    });
    const poll = async () => {
      try {
        const output = await observation.terminalOutput(projectId, session, cursor, controller.signal);
        if (disposed) return;
        if (output.truncated) term.writeln("\r\n[Une partie de la sortie antérieure a expiré]\r\n");
        if (output.data_b64) term.write(observation.decodeBytes(output.data_b64));
        cursor = output.next_cursor;
        if (output.exit_code != null) { failedInput = true; setExitCode(output.exit_code); }
        if (output.exit_code == null || output.bytes >= 8192) polling = setTimeout(() => void poll(), output.bytes >= 8192 ? 10 : 350);
      } catch (reason) { if (!disposed) { failedInput = true; setError(String(reason)); } }
    };
    void poll();
    return () => { disposed = true; controller.abort(); clearTimeout(polling); clearTimeout(resizing); observer.disconnect(); input.dispose(); term.dispose(); };
  }, [projectId, session, refresh]);

  const create = async () => {
    const selected = catalogue?.shells.find(item => item.id === shell); if (!selected) return;
    setBusy(true); setError("");
    try { const result = await observation.createProjectTerminal(projectId, selected.argv); setSession(result.session_id); setRefresh(value => value + 1); }
    catch (reason) { setError(String(reason)); } finally { setBusy(false); }
  };
  const close = async () => {
    setBusy(true); setError("");
    try { await observation.closeProjectTerminal(projectId, session); setSession(""); setRefresh(value => value + 1); }
    catch (reason) { setError(String(reason)); } finally { setBusy(false); }
  };
  return <section aria-label="Terminal interactif du projet" className="studio-terminal">
    <p className="hint">Session utilisateur dans le dossier du projet. Expiration après 15 minutes d’inactivité. Le code de sortie concerne le shell, pas chaque commande.</p>
    <div className="studio-observation-actions">
      <label>Shell <select value={shell} onChange={event => setShell(event.target.value)} disabled={busy}>{catalogue?.shells.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <Button size="sm" disabled={busy || !shell || !catalogue?.can_create} onClick={() => void create()}>Nouveau terminal</Button>
      {catalogue?.sessions.length ? <label>Session <select value={session} onChange={event => setSession(event.target.value)}>{catalogue.sessions.map(item => <option key={item.session_id} value={item.session_id}>{item.session_id.slice(0, 12)}</option>)}</select></label> : null}
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => setRefresh(value => value + 1)}>Reconnecter</Button>
      {session ? <Button size="sm" variant="secondary" disabled={busy} onClick={() => void close()}>Fermer la session</Button> : null}
    </div>
    {error ? <p role="alert" className="error">{error}</p> : null}
    {exitCode != null ? <p role="status">Shell terminé : {exitCode}.</p> : null}
    {session ? <div ref={host} className="studio-terminal-host" /> : <p className="hint">Ouvrez un terminal pour exécuter vos commandes. Les terminaux des agents restent attachés à leur tâche.</p>}
  </section>;
}
