import { useCallback, useEffect, useState } from "react";
import * as api from "./api";

type Block = { title: string; body: string; ok: boolean };

/** Cockpit opérateur : endpoints documentés dans `docs/HERMES_COCKPIT.md` (parité Hermes / daemon). */
export function HermesOpsPanel() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
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
      const out = await Promise.all([
        run("GET /api/schedules", () => api.fetchSchedulesPayload()),
        run("GET /api/task_runs", () => api.fetchTaskRunsPayload()),
        run("GET /api/process/watch/recent", () => api.fetchProcessWatchRecent(30)),
        run("GET /api/terminal/capabilities", () => api.fetchTerminalCapabilities()),
        run("GET /api/tools/effective", () => api.fetchToolsEffective()),
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
        Données brutes JSON — utile pour vérifier scheduler, runs, process watch, terminal, toolsets. Voir{" "}
        <a href="/docs/HERMES_COCKPIT.md" target="_blank" rel="noopener">
          docs/HERMES_COCKPIT.md
        </a>
        .
      </p>
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
