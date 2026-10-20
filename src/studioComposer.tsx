import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { STUDIO_ACTIONS } from "./studioActions";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Select } from "./components/ui/select";
import * as api from "./api";

export type ComposerExecution = {
  model: string;
  criterionPath: string;
  criterionKind: "file_exists" | "command_ok";
  verifyArgv: string;
  cycles: number;
  seconds: number;
  tokens: number;
};
export const defaultExecution: ComposerExecution = {
  model: "",
  criterionPath: "",
  criterionKind: "file_exists",
  verifyArgv: '["npm","test"]',
  cycles: 4,
  seconds: 600,
  tokens: 50000,
};

export function StudioComposer({
  text,
  onText,
  options,
  onOptions,
  projectId,
  taskId,
}: {
  text: string;
  onText: (text: string) => void;
  options: ComposerExecution;
  onOptions: Dispatch<SetStateAction<ComposerExecution>>;
  projectId: string | null;
  taskId?: string;
}) {
  const [catalog, setCatalog] = useState<api.StudioExecutionCatalog | null>(
    null,
  );
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [cursor, setCursor] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setCatalog(null);
    setError("");
    void api
      .getStudioExecutionCatalog(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setCatalog(value);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            "Choix du modèle et objectifs indisponibles. Actualisez ou mettez le daemon à jour.",
          );
      });
    return () => controller.abort();
  }, [revision]);
  const actions = /^\/\w*$/.test(text)
    ? STUDIO_ACTIONS.filter((item) => item.name.startsWith(text.slice(1)))
    : [];
  const goal = /^\/goal(?:\s|$)/.test(text);
  const choose = (name: string) => {
    onText(`/${name} `);
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLTextAreaElement>(".chat-form textarea")
        ?.focus(),
    );
  };
  return (
    <div className="studio-composer-options">
      {actions.length ? (
        <div
          className="composer-palette"
          id="studio-action-list"
          aria-activedescendant={`studio-action-${actions[cursor % actions.length]?.name}`}
          role="listbox"
          aria-label="Actions de l’agent"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setCursor(
                (value) =>
                  (value +
                    (event.key === "ArrowDown" ? 1 : actions.length - 1)) %
                  actions.length,
              );
            }
            if (event.key === "Enter") {
              event.preventDefault();
              choose(actions[cursor % actions.length].name);
            }
            if (event.key === "Escape") onText("");
          }}
        >
          {actions.map((item, index) => (
            <button
              key={item.name}
              id={`studio-action-${item.name}`}
              tabIndex={-1}
              type="button"
              role="option"
              aria-selected={index === cursor % actions.length}
              disabled={item.name === "goal" && !catalog?.goals}
              onClick={() => choose(item.name)}
            >
              <strong>
                /{item.name} · {item.label}
              </strong>
              <span>{item.detail}</span>
            </button>
          ))}
        </div>
      ) : null}
      <label className="composer-model">
        Modèle{" "}
        <Select
          aria-label="Modèle de la tâche"
          disabled={!catalog || !projectId}
          value={options.model}
          onChange={(event) =>
            onOptions((previous) => ({
              ...previous,
              model: event.target.value,
            }))
          }
        >
          <option value="">Automatique</option>
          {catalog?.models.map((item) => (
            <option
              key={`${item.provider}/${item.model}`}
              value={JSON.stringify(item)}
            >
              {item.model} · {item.provider}
            </option>
          ))}
        </Select>
      </label>
      {error ? (
        <p className="hint" role="status">
          {error}{" "}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setRevision((value) => value + 1)}
          >
            Actualiser les modèles
          </Button>
        </p>
      ) : null}
      {options.model ? (
        <details className="composer-model-note">
          <summary>À propos du modèle choisi</summary>
          <p className="hint">
          Route demandée : {JSON.parse(options.model).model}. Le daemon signale
          une erreur si elle est indisponible. Le modèle réellement observé
          apparaît dans le contexte.
          </p>
        </details>
      ) : null}
      {goal ? (
        <fieldset className="composer-goal">
          <legend>Critère vérifiable et limites de l’objectif</legend>
          <p className="hint">
            Le daemon poursuit jusqu’à la réussite du critère choisi ou une
            limite. Une commande de vérification exécute du code du projet;
            vérifiez ses arguments avant l’envoi.
          </p>
          <label>
            Vérification
            <Select
              aria-label="Type de vérification de l’objectif"
              value={options.criterionKind}
              onChange={(event) =>
                onOptions((previous) => ({
                  ...previous,
                  criterionKind: event.target
                    .value as ComposerExecution["criterionKind"],
                }))
              }
            >
              <option value="file_exists">Présence d’un fichier</option>
              <option value="command_ok">Commande réussie</option>
            </Select>
          </label>
          {options.criterionKind === "file_exists" ? (
            <label>
              Fichier attendu dans le projet
              <Input
                aria-label="Fichier attendu pour l’objectif"
                placeholder="ex. src/game.ts"
                value={options.criterionPath}
                onChange={(event) =>
                  onOptions((previous) => ({
                    ...previous,
                    criterionPath: event.target.value,
                  }))
                }
              />
            </label>
          ) : (
            <label>
              Arguments de la commande (tableau JSON)
              <Input
                aria-label="Commande de vérification de l’objectif"
                value={options.verifyArgv}
                onChange={(event) =>
                  onOptions((previous) => ({
                    ...previous,
                    verifyArgv: event.target.value,
                  }))
                }
              />
            </label>
          )}
          <div className="goal-limits">
            <label>
              Cycles maximum
              <Input
                type="number"
                min={1}
                max={20}
                value={options.cycles}
                onChange={(event) =>
                  onOptions((previous) => ({
                    ...previous,
                    cycles: Number(event.target.value),
                  }))
                }
              />
            </label>
            <label>
              Durée maximum (secondes)
              <Input
                type="number"
                min={30}
                max={3600}
                value={options.seconds}
                onChange={(event) =>
                  onOptions((previous) => ({
                    ...previous,
                    seconds: Number(event.target.value),
                  }))
                }
              />
            </label>
            <label>
              Budget de tokens
              <Input
                type="number"
                min={1000}
                max={1000000}
                value={options.tokens}
                onChange={(event) =>
                  onOptions((previous) => ({
                    ...previous,
                    tokens: Number(event.target.value),
                  }))
                }
              />
            </label>
          </div>
          {!catalog?.goals ? (
            <p role="alert">
              Ce daemon ne prend pas en charge les objectifs persistants.
            </p>
          ) : null}
        </fieldset>
      ) : null}
      {taskId ? <StudioGoalStatus key={taskId} taskId={taskId} /> : null}
    </div>
  );
}

const GOAL_STATES: Record<string, string> = {
  active: "En cours",
  paused: "En pause",
  interrupted: "Interrompu",
  completed: "Critères vérifiés",
  blocked: "Bloqué",
  cancelled: "Arrêté",
  budget_exhausted: "Limite atteinte",
  waiting_user_input: "Réponse attendue",
};

function StudioGoalStatus({ taskId }: { taskId: string }) {
  const [goal, setGoal] = useState<api.StudioGoalState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      try {
        const value = await api.getStudioGoal(taskId);
        if (stopped) return;
        setGoal(value);
        setError("");
        if (
          value &&
          ["active", "paused", "interrupted", "waiting_user_input"].includes(
            value.state,
          )
        )
          timer = setTimeout(() => void refresh(), 3000);
      } catch {
        if (!stopped) {
          setError("Le suivi de l’objectif est temporairement indisponible.");
          timer = setTimeout(() => void refresh(), 5000);
        }
      }
    };
    void refresh();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [taskId]);
  async function control(action: "pause" | "resume" | "cancel") {
    setBusy(true);
    setError("");
    try {
      if (action === "pause") await api.pauseTask(taskId);
      else if (action === "resume") await api.resumeTask(taskId);
      else await api.cancelTask(taskId);
      setGoal(await api.getStudioGoal(taskId));
    } catch (reason) {
      setError(String(reason));
    } finally {
      setBusy(false);
    }
  }
  if (!goal) return null;
  return (
    <section className="goal-progress" aria-label="Objectif en cours">
      <strong>Objectif : {goal.objective}</strong>
      <p>
        {GOAL_STATES[goal.state] || "État inconnu"} · {goal.cycles}/
        {goal.max_cycles} cycles · {Math.round(goal.elapsed_ms / 1000)}/
        {goal.max_seconds} s · {goal.tokens_used}/{goal.max_tokens} tokens
        (estimés si non fournis)
      </p>
      {goal.detail ? <p className="hint">{goal.detail}</p> : null}
      <div className="project-actions-row">
        {["active", "waiting_user_input"].includes(goal.state) ? (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => void control("pause")}
          >
            Mettre en pause
          </Button>
        ) : ["paused", "interrupted"].includes(goal.state) ? (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => void control("resume")}
          >
            Reprendre l’objectif
          </Button>
        ) : null}
        {["active", "paused", "interrupted", "waiting_user_input"].includes(
          goal.state,
        ) ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => void control("cancel")}
          >
            Arrêter l’objectif
          </Button>
        ) : null}
      </div>
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
