import { useCallback, useEffect, useMemo, useState } from "react";
import * as api from "./api";

type RawSection = { title: string; ok: boolean; payload: unknown; error?: string };

/** Cockpit opérateur : endpoints documentés dans `docs/HERMES_COCKPIT.md` (parité Hermes / daemon). */
export function HermesOpsPanel() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [rawSections, setRawSections] = useState<RawSection[]>([]);
  const [schedules, setSchedules] = useState<api.OpsSchedule[]>([]);
  const [taskRuns, setTaskRuns] = useState<api.OpsTaskRun[]>([]);
  const [processEvents, setProcessEvents] = useState<api.OpsProcessEvent[]>([]);
  const [terminal, setTerminal] = useState<api.OpsTerminalSummary>({
    current: "unknown",
    interactivePty: false,
    ptyApi: [],
    shells: [],
  });
  const [tools, setTools] = useState<api.OpsToolsSummary>({ profile: "default", allow: 0, deny: 0, approval: 0 });
  const [mcp, setMcp] = useState<api.OpsMcpSummary>({
    configPresent: false,
    serverCount: 0,
    runtime: "unknown",
    oauthMode: "unknown",
  });
  const [lifecycle, setLifecycle] = useState<api.OpsLifecycleSummary>({
    present: false,
    timeoutSec: 0,
    sandbox: "none",
    phases: [],
  });
  const [scheduleBusy, setScheduleBusy] = useState<string | null>(null);
  const [scheduleMsg, setScheduleMsg] = useState<string | null>(null);
  const [opsHealth, setOpsHealth] = useState<string>("");

  const fetchSection = useCallback(async (title: string, fn: () => Promise<unknown>) => {
    try {
      const payload = await fn();
      return { title, ok: true, payload } as RawSection;
    } catch (e) {
      return {
        title,
        ok: false,
        payload: null,
        error: e instanceof Error ? e.message : String(e),
      } as RawSection;
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [
        schedulesSection,
        taskRunsSection,
        processSection,
        terminalSection,
        toolsSection,
        memorySection,
        mcpStatusSection,
        mcpRuntimeSection,
        lifecycleSection,
      ] = await Promise.all([
        fetchSection("GET /api/schedules", () => api.fetchSchedulesPayload()),
        fetchSection("GET /api/task_runs", () => api.fetchTaskRunsPayload()),
        fetchSection("GET /api/process/watch/recent", () => api.fetchProcessWatchRecent(30)),
        fetchSection("GET /api/terminal/capabilities", () => api.fetchTerminalCapabilities()),
        fetchSection("GET /api/tools/effective", () => api.fetchToolsEffective()),
        fetchSection("GET /api/memory/recall-metrics", () => api.fetchMemoryRecallMetrics()),
        fetchSection("GET /api/mcp/status", () => api.fetchMcpStatus()),
        fetchSection("GET /api/mcp/runtime", () => api.fetchMcpRuntime()),
        fetchSection("GET /api/lifecycle/hooks", () => api.fetchLifecycleHooks()),
      ]);

      const schedulesPayload = schedulesSection.ok ? schedulesSection.payload : { schedules: [] };
      const taskRunsPayload = taskRunsSection.ok ? taskRunsSection.payload : { task_runs: [] };
      const processPayload = processSection.ok ? processSection.payload : { events: [] };
      const terminalPayload = terminalSection.ok ? terminalSection.payload : {};
      const toolsPayload = toolsSection.ok ? toolsSection.payload : {};
      const mcpStatusPayload = mcpStatusSection.ok ? mcpStatusSection.payload : {};
      const mcpRuntimePayload = mcpRuntimeSection.ok ? mcpRuntimeSection.payload : {};
      const lifecyclePayload = lifecycleSection.ok ? lifecycleSection.payload : {};

      setSchedules(api.parseSchedulesPayload(schedulesPayload));
      setTaskRuns(api.parseTaskRunsPayload(taskRunsPayload));
      setProcessEvents(api.parseProcessWatchPayload(processPayload));
      setTerminal(api.parseTerminalCapabilitiesPayload(terminalPayload));
      setTools(api.parseToolsEffectivePayload(toolsPayload));
      setMcp(api.parseMcpSummary(mcpStatusPayload, mcpRuntimePayload));
      setLifecycle(api.parseLifecycleHooksPayload(lifecyclePayload));

      const out = [
        schedulesSection,
        taskRunsSection,
        processSection,
        terminalSection,
        toolsSection,
        memorySection,
        mcpStatusSection,
        mcpRuntimeSection,
        lifecycleSection,
      ];
      setRawSections(out);
      const okCount = out.filter((x) => x.ok).length;
      setOpsHealth(`${okCount}/${out.length} endpoints OK`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [fetchSection]);

  const loadLight = useCallback(async () => {
    try {
      const [runs, watch] = await Promise.all([api.fetchTaskRunsPayload(), api.fetchProcessWatchRecent(30)]);
      setTaskRuns(api.parseTaskRunsPayload(runs));
      setProcessEvents(api.parseProcessWatchPayload(watch));
    } catch {
      /* keep previous values */
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => {
      void loadLight();
    }, 7_500);
    return () => window.clearInterval(timer);
  }, [autoRefresh, loadLight]);

  const onScheduleAction = async (id: string, action: "pause" | "resume" | "run_now") => {
    setScheduleBusy(`${id}:${action}`);
    setScheduleMsg(null);
    try {
      const j = await api.postScheduleControl(id, action);
      setScheduleMsg(`${action} → OK: ${JSON.stringify(j).slice(0, 400)}`);
      await loadAll();
    } catch (e) {
      setScheduleMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setScheduleBusy(null);
    }
  };

  const processTop = useMemo(() => [...processEvents].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10), [processEvents]);
  const runsTop = useMemo(() => taskRuns.slice(0, 10), [taskRuns]);

  return (
    <div className="hermes-ops-panel">
      <div className="hermes-ops-header">
        <strong>Cockpit daemon (Hermes parity)</strong>
        <div className="hermes-ops-header-actions">
          <label className="field-inline" style={{ fontSize: "0.72rem" }}>
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
            <span>Auto-refresh runs/process</span>
          </label>
          <button type="button" className="btn btn-ghost btn-sm" disabled={loading} onClick={() => void loadAll()}>
          {loading ? "Chargement…" : "Rafraîchir"}
          </button>
        </div>
      </div>
      {err ? <p className="banner banner-error">{err}</p> : null}
      <p className="hint" style={{ marginBottom: "0.75rem" }}>
        Scheduler, runs, process watch, terminal, toolsets, recall, MCP (statut disque), hooks lifecycle. Webhooks signés :{" "}
        <a
          href="https://github.com/azerothl/Akasha/blob/main/docs/automation-webhooks.md"
          target="_blank"
          rel="noopener noreferrer"
        >
          automation-webhooks.md
        </a>
        . Voir aussi{" "}
        <a href="/docs/HERMES_COCKPIT.md" target="_blank" rel="noopener">
          docs/HERMES_COCKPIT.md
        </a>
        .
      </p>
      <p className="hint" style={{ marginBottom: "0.75rem" }}>
        État cockpit: <strong>{opsHealth || "…"}</strong>
      </p>

      <section className="hermes-ops-structured-grid">
        <div className="hermes-ops-card" data-testid="ops-task-runs-card">
          <h4>Task runs</h4>
          {runsTop.length === 0 ? <p className="hint">Aucun run récent.</p> : (
            <ul className="hermes-ops-mini-list">
              {runsTop.map((r) => (
                <li key={r.id}>
                  <strong>{r.id.slice(0, 8)}…</strong> · {r.status} · {r.summary || r.task}
                </li>
              ))}
            </ul>
          )}
          <details>
            <summary>Raw JSON</summary>
            <pre className="hermes-ops-pre">{JSON.stringify(rawSections.find((s) => s.title.includes("/api/task_runs"))?.payload, null, 2)}</pre>
          </details>
        </div>

        <div className="hermes-ops-card" data-testid="ops-process-watch-card">
          <h4>Process watch</h4>
          {processTop.length === 0 ? <p className="hint">Aucun événement.</p> : (
            <ul className="hermes-ops-mini-list">
              {processTop.map((e, idx) => (
                <li key={`${e.at}-${idx}`}>
                  <strong>{e.status}</strong> · {e.command} · {e.detail}
                </li>
              ))}
            </ul>
          )}
          <details>
            <summary>Raw JSON</summary>
            <pre className="hermes-ops-pre">{JSON.stringify(rawSections.find((s) => s.title.includes("/api/process/watch/recent"))?.payload, null, 2)}</pre>
          </details>
        </div>

        <div className="hermes-ops-card" data-testid="ops-terminal-card">
          <h4>Terminal</h4>
          <p className="hint">Mode: <strong>{terminal.current}</strong> · PTY interactif: <strong>{terminal.interactivePty ? "oui" : "non"}</strong></p>
          <p className="hint">API PTY: {terminal.ptyApi.join(", ") || "—"}</p>
          <details><summary>Raw JSON</summary><pre className="hermes-ops-pre">{JSON.stringify(rawSections.find((s) => s.title.includes("/api/terminal/capabilities"))?.payload, null, 2)}</pre></details>
        </div>

        <div className="hermes-ops-card" data-testid="ops-tools-card">
          <h4>Tools effective</h4>
          <p className="hint">Profil: <strong>{tools.profile}</strong></p>
          <p className="hint">Allow: {tools.allow} · Approval: {tools.approval} · Deny: {tools.deny}</p>
          <details><summary>Raw JSON</summary><pre className="hermes-ops-pre">{JSON.stringify(rawSections.find((s) => s.title.includes("/api/tools/effective"))?.payload, null, 2)}</pre></details>
        </div>

        <div className="hermes-ops-card" data-testid="ops-mcp-card">
          <h4>MCP</h4>
          <p className="hint">Config: <strong>{mcp.configPresent ? "présente" : "absente"}</strong> · Servers: <strong>{mcp.serverCount}</strong></p>
          <p className="hint">Runtime: {mcp.runtime} · OAuth: {mcp.oauthMode}</p>
          <details><summary>Raw JSON status/runtime</summary><pre className="hermes-ops-pre">{JSON.stringify({
            status: rawSections.find((s) => s.title.includes("/api/mcp/status"))?.payload,
            runtime: rawSections.find((s) => s.title.includes("/api/mcp/runtime"))?.payload,
          }, null, 2)}</pre></details>
        </div>

        <div className="hermes-ops-card" data-testid="ops-lifecycle-card">
          <h4>Lifecycle hooks</h4>
          <p className="hint">Présent: <strong>{lifecycle.present ? "oui" : "non"}</strong> · Sandbox: <strong>{lifecycle.sandbox}</strong> · Timeout: <strong>{lifecycle.timeoutSec}s</strong></p>
          <p className="hint">Phases: {lifecycle.phases.join(", ") || "—"}</p>
          <details><summary>Raw JSON</summary><pre className="hermes-ops-pre">{JSON.stringify(rawSections.find((s) => s.title.includes("/api/lifecycle/hooks"))?.payload, null, 2)}</pre></details>
        </div>
      </section>

      {schedules.length > 0 ? (
        <div className="hermes-ops-schedules" style={{ marginBottom: "1rem" }}>
          <strong className="hermes-ops-schedules-title">Actions planificateur</strong>
          <table className="hermes-ops-schedule-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>ID</th>
                <th>Actif</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id}>
                  <td>{s.name ?? "—"}</td>
                  <td>
                    <code title={s.id}>{s.id.slice(0, 8)}…</code>
                  </td>
                  <td>{s.enabled === false ? "non" : "oui"}</td>
                  <td className="hermes-ops-schedule-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={scheduleBusy !== null}
                      onClick={() => void onScheduleAction(s.id, "pause")}
                    >
                      {scheduleBusy === `${s.id}:pause` ? "…" : "Pause"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={scheduleBusy !== null}
                      onClick={() => void onScheduleAction(s.id, "resume")}
                    >
                      {scheduleBusy === `${s.id}:resume` ? "…" : "Reprendre"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={scheduleBusy !== null}
                      onClick={() => void onScheduleAction(s.id, "run_now")}
                    >
                      {scheduleBusy === `${s.id}:run_now` ? "…" : "Exécuter maintenant"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {scheduleMsg ? <p className="hint hermes-ops-schedule-msg">{scheduleMsg}</p> : null}
        </div>
      ) : (
        <p className="hint" style={{ marginBottom: "1rem" }}>
          Aucune entrée dans <code>GET /api/schedules</code> — les actions pause / reprise / exécution apparaissent lorsque des
          plannings existent côté daemon.
        </p>
      )}

      <div className="hermes-ops-blocks">
        {rawSections.map((b) => (
          <details key={b.title} open={!b.ok}>
            <summary>
              {b.ok ? "OK" : "Erreur"} — {b.title}
            </summary>
            <pre className="hermes-ops-pre">
              {b.ok ? JSON.stringify(b.payload, null, 2).slice(0, 12_000) : b.error}
            </pre>
          </details>
        ))}
      </div>
    </div>
  );
}
