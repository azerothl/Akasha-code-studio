import type { useStudioPreview } from "./hooks/useStudioPreview";
import { Button } from "./components/ui/button";
import { Checkbox } from "./components/ui/checkbox";
import { Input } from "./components/ui/input";
import { AsyncState } from "./asyncState";
import { ExternalLink, Play, Square, Monitor } from "lucide-react";

type Props = ReturnType<typeof useStudioPreview> & {
  projectId: string | null;
  onChooseProject: () => void;
};

export function StudioPreviewPane(p: Props) {
  const busy = p.previewBusy || p.depsInstallBusy;
  return (
    <div className="center-body preview-pane studio-preview">
      <header className="preview-heading">
        <div>
          <h2>Aperçu de votre application</h2>
          <p className="hint">
            {p.previewUrl
              ? "Application prête à être inspectée."
              : "Lancez le projet pour voir et vérifier le résultat."}
            {p.previewProfile ? ` · ${p.previewProfile}` : ""}
          </p>
        </div>
        <div className="project-actions-row">
          {p.devPreviewUrl ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void p.onStopPreview()}
            >
              <Square size={15} /> Arrêter le serveur
            </Button>
          ) : (
            <Button
              disabled={!p.projectId || busy}
              onClick={() => void p.onPlayPreview()}
            >
              <Play size={15} />
              {busy ? "Préparation…" : "Lancer la prévisualisation"}
            </Button>
          )}
          {p.previewUrl ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={p.openPreviewInNewWindow}
            >
              <ExternalLink size={15} />
              Nouvelle fenêtre
            </Button>
          ) : null}
        </div>
      </header>
      <details className="preview-settings">
        <summary>Environnement et vérifications</summary>
        <p className="hint">
          Le daemon détecte les manifestes Node.js ou Python et installe les
          dépendances nécessaires. Une installation ou une commande de
          vérification peut exécuter du code du projet.
        </p>
        <div className="preview-options">
          <label>
            <Checkbox
              checked={p.forceInstallBeforePreview}
              onChange={(e) => p.setForceInstallBeforePreview(e.target.checked)}
            />
            Réinstaller les dépendances avant le lancement
          </label>
          <label>
            <Checkbox
              checked={p.strictWebSandbox}
              onChange={(e) => p.setStrictWebSandbox(e.target.checked)}
            />
            Isoler strictement l’aperçu (certaines fonctions peuvent être
            limitées)
          </label>
          <Button
            variant="secondary"
            size="sm"
            disabled={!p.projectId || busy}
            onClick={() => void p.onInstallDepsOnly()}
          >
            Installer les dépendances
          </Button>
        </div>
        <div className="preview-build-controls">
          <label>
            Commande de vérification
            <Input
              aria-label="Commande de vérification"
              value={p.buildCmd}
              onChange={(e) => p.setBuildCmd(e.target.value)}
            />
          </label>
          <Button
            disabled={!p.projectId || p.buildState === "running"}
            onClick={() => void p.onBuild()}
          >
            {p.buildState === "running"
              ? "Build en cours…"
              : "Exécuter le build"}
          </Button>
        </div>
        {p.buildState !== "idle" ? (
          <AsyncState
            kind={p.buildState === "running" ? "loading" : p.buildState}
            title={
              p.buildState === "running"
                ? "Vérification en cours…"
                : p.buildState === "error"
                  ? "La vérification a échoué"
                  : "Vérification terminée"
            }
            detail={p.buildError || p.buildLog}
            action={
              p.buildState === "error"
                ? {
                    label: "Relancer le build",
                    onClick: () => void p.onBuild(),
                  }
                : undefined
            }
          />
        ) : null}
      </details>
      {busy ? (
        <AsyncState
          kind="loading"
          title={
            p.depsInstallBusy
              ? "Installation des dépendances…"
              : "Démarrage de l’aperçu…"
          }
          description="Le daemon prépare le projet. Les fichiers restent accessibles pendant cette opération."
        />
      ) : p.previewError ? (
        <AsyncState
          kind="error"
          title="L’aperçu n’est pas prêt"
          description="Le serveur de développement n’a pas démarré. Consultez le journal ou les détails, puis réessayez."
          detail={p.previewError}
          action={{
            label: "Réessayer",
            onClick: () =>
              void (p.previewAction === "install"
                ? p.onInstallDepsOnly()
                : p.onPlayPreview()),
          }}
        />
      ) : null}
      {p.previewLog || p.devServerLog ? (
        <details className="preview-journal" open={Boolean(p.previewError)}>
          <summary>Journal de préparation et du serveur</summary>
          <pre className="build-pre">
            {[p.previewLog, p.devServerLog].filter(Boolean).join("\n\n")}
          </pre>
        </details>
      ) : null}
      {p.previewUrl ? (
        <iframe
          className="preview-frame"
          title="Aperçu"
          src={p.previewUrl}
          sandbox={
            p.devPreviewUrl && !p.strictWebSandbox
              ? "allow-scripts allow-same-origin allow-forms allow-popups"
              : "allow-scripts"
          }
        />
      ) : !busy && !p.previewError ? (
        <div className="preview-empty">
          <Monitor size={32} aria-hidden="true" />
          <h3>
            {p.projectId
              ? "Votre application apparaîtra ici"
              : "Choisissez un projet"}
          </h3>
          <p>
            Node.js et Python : lancez le serveur avec le bouton ci-dessus. Pour
            du HTML statique, ouvrez un fichier .html depuis les fichiers du
            projet.
          </p>
          {!p.projectId ? (
            <Button onClick={p.onChooseProject}>Choisir un projet</Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
