import { useCallback, useEffect, useState } from "react";
import * as api from "./api";

type Block = { title: string; body: string; ok: boolean };

type ScheduleRow = { id: string; name?: string; enabled?: boolean };

function parseSchedulesPayload(data: unknown): ScheduleRow[] {
  if (!data || typeof data !== "object") return [];
  const o = data as { schedules?: unknown };
  if (!Array.isArray(o.schedules)) return [];
  const out: ScheduleRow[] = [];
  for (const s of o.schedules) {
    if (!s || typeof s !== "object") continue;
    const r = s as { id?: string; name?: string; enabled?: boolean };
    if (!r.id || typeof r.id !== "string") continue;
    out.push({ id: r.id, name: r.name, enabled: r.enabled });
  }
  return out;
}

/** Cockpit opérateur : endpoints documentés dans `docs/HERMES_COCKPIT.md` (parité Hermes / daemon). */
export function HermesOpsPanel() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [scheduleBusy, setScheduleBusy] = useState<string | null>(null);
  const [scheduleMsg, setScheduleMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setScheduleMsg(null);
    try {
      const run = async (title: string, fn: () => Promise<unknown>): Promise<Block> => {
        try {
          const data = await fn();
          return {
            title,
            ok: true,
            body: JSON.stringify(data, null, 2).slice(0, 12_000),
          };
        } catch (e) {
          return {
            title,
            ok: false,
            body: e instanceof Error ? e.message : String(e),
          };
        }
      };
      const schedulesPayload = await api.fetchSchedulesPayload();
      setSchedules(parseSchedulesPayload(schedulesPayload));
      const out = await Promise.all([
        run("GET /api/schedules", async () => schedulesPayload),
        run("GET /api/task_runs", () => api.fetchTaskRunsPayload()),
        run("GET /api/process/watch/recent", () => api.fetchProcessWatchRecent(30)),
        run("GET /api/terminal/capabilities", () => api.fetchTerminalCapabilities()),
        run("GET /api/tools/effective", () => api.fetchToolsEffective()),
        run("GET /api/memory/recall-metrics", () => api.fetchMemoryRecallMetrics()),
        run("GET /api/mcp/status", () => api.fetchMcpStatus()),
        run("GET /api/mcp/runtime", () => api.fetchMcpRuntime()),
        run("GET /api/lifecycle/hooks", () => api.fetchLifecycleHooks()),
      ]);
      setBlocks(out);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onScheduleAction = async (id: string, action: "pause" | "resume" | "run_now") => {
    setScheduleBusy(`${id}:${action}`);
    setScheduleMsg(null);
    try {
      const j = await api.postScheduleControl(id, action);
      setScheduleMsg(`${action} → OK: ${JSON.stringify(j).slice(0, 400)}`);
      await load();
    } catch (e) {
      setScheduleMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setScheduleBusy(null);
    }
  };

  return (
    <div className="hermes-ops-panel">
      <div className="hermes-ops-header">
        <strong>Cockpit daemon (Hermes parity)</strong>
        <button type="button" className="btn btn-ghost btn-sm" disabled={loading} onClick={() => void load()}>
          {loading ? "Chargement…" : "Rafraîchir"}
        </button>
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
        {blocks.map((b) => (
          <details key={b.title} open={!b.ok}>
            <summary>
              {b.ok ? "OK" : "Erreur"} — {b.title}
            </summary>
            <pre className="hermes-ops-pre">{b.body}</pre>
          </details>
        ))}
      </div>
    </div>
  );
}
