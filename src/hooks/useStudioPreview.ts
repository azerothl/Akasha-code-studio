import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import * as api from "../api";
import type { CenterTab } from "../studioNavigation";

type Dependencies = {
  selectedId: string | null;
  centerTab: CenterTab;
  setError: Dispatch<SetStateAction<string | null>>;
  setCenterTab: Dispatch<SetStateAction<CenterTab>>;
  setStatus: Dispatch<SetStateAction<string>>;
};

export function useStudioPreview({ selectedId, centerTab, setError, setCenterTab, setStatus }: Dependencies) {
  const [staticPreviewBlobUrl, setStaticPreviewBlobUrl] = useState<string | null>(null);
  const [devPreviewUrl, setDevPreviewUrl] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewLog, setPreviewLog] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewAction, setPreviewAction] = useState<"start" | "install">("start");
  const [forceInstallBeforePreview, setForceInstallBeforePreview] = useState(false);
  const [strictWebSandbox, setStrictWebSandbox] = useState(false);
  const [previewProfile, setPreviewProfile] = useState<string | null>(null);
  const [devServerLog, setDevServerLog] = useState("");
  const [depsInstallBusy, setDepsInstallBusy] = useState(false);
  const [buildCmd, setBuildCmd] = useState("npm run build");
  const [buildLog, setBuildLog] = useState("");
  const [buildState, setBuildState] = useState<"idle" | "running" | "success" | "error">("idle");
  const [buildError, setBuildError] = useState<string | null>(null);
  const projectRef = useRef(selectedId);
  projectRef.current = selectedId;
  const previewRequest = useRef(0);
  const buildRequest = useRef(0);
  const previewLock = useRef(false);
  const buildLock = useRef(false);

  useEffect(() => {
    previewRequest.current++;
    buildRequest.current++;
    previewLock.current = false;
    buildLock.current = false;
    setDevPreviewUrl(null);
    setStaticPreviewBlobUrl(null);
    setPreviewLog("");
    setPreviewError(null);
    setPreviewProfile(null);
    setDevServerLog("");
    setPreviewBusy(false);
    setDepsInstallBusy(false);
    setBuildLog("");
    setBuildState("idle");
    setBuildError(null);
    return () => {
      previewRequest.current++;
      buildRequest.current++;
      if (selectedId) void api.stopStudioPreview(selectedId).catch(() => {});
    };
  }, [selectedId]);

  useEffect(() => () => {
    if (staticPreviewBlobUrl) URL.revokeObjectURL(staticPreviewBlobUrl);
  }, [staticPreviewBlobUrl]);

  const runPreview = useCallback(async (action: "start" | "install") => {
    if (!selectedId || previewLock.current) return;
    previewLock.current = true;
    const request = ++previewRequest.current;
    const current = () => request === previewRequest.current && projectRef.current === selectedId;
    setPreviewAction(action);
    setPreviewError(null);
    setPreviewBusy(action === "start");
    setDepsInstallBusy(action === "install");
    setPreviewLog("");
    setCenterTab("preview");
    try {
      if (action === "start") {
        const result = await api.startStudioPreview(selectedId, { force_install: forceInstallBeforePreview });
        if (!current()) return;
        setDevPreviewUrl(result.url);
        setPreviewProfile(result.profile ?? null);
        setPreviewLog([result.install?.stdout, result.install?.stderr].filter(Boolean).join("\n"));
        setStatus(`Prévisualisation : ${result.url}`);
      } else {
        const result = await api.installStudioDeps(selectedId, { force: forceInstallBeforePreview });
        if (!current()) return;
        setPreviewProfile(result.profile ?? null);
        setPreviewLog(result.skipped
          ? `Dépendances déjà présentes : ${result.reason ?? ""}`
          : [result.install?.argv?.join(" "), result.install?.stdout, result.install?.stderr].filter(Boolean).join("\n\n"));
        if (!result.ok) throw new Error(`Installation interrompue (code ${result.install?.exit_code ?? "inconnu"}). Consultez le journal.`);
        setStatus("Dépendances installées");
      }
    } catch (error) {
      if (current()) setPreviewError(String(error));
    } finally {
      if (current()) {
        previewLock.current = false;
        setPreviewBusy(false);
        setDepsInstallBusy(false);
      }
    }
  }, [selectedId, forceInstallBeforePreview, setCenterTab, setStatus]);

  const onPlayPreview = useCallback(() => runPreview("start"), [runPreview]);
  const onInstallDepsOnly = useCallback(() => runPreview("install"), [runPreview]);
  const onStopPreview = useCallback(async () => {
    if (!selectedId) return;
    try {
      await api.stopStudioPreview(selectedId);
      if (projectRef.current !== selectedId) return;
      setDevPreviewUrl(null);
      setDevServerLog("");
      setPreviewError(null);
      setStatus("Prévisualisation arrêtée");
    } catch (error) {
      if (projectRef.current === selectedId) setError(String(error));
    }
  }, [selectedId, setError, setStatus]);

  const onBuild = useCallback(async () => {
    if (!selectedId || buildLock.current) return;
    const parts = buildCmd.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return;
    buildLock.current = true;
    const request = ++buildRequest.current;
    const current = () => request === buildRequest.current && projectRef.current === selectedId;
    setBuildState("running");
    setBuildError(null);
    setBuildLog("");
    try {
      const out = await api.runBuild(selectedId, parts, 300);
      if (!current()) return;
      const log = [
        out.execution_mode ? `Exécution : ${out.execution_mode}` : "",
        out.error ? `Erreur : ${out.error}` : `Code de sortie: ${out.exit_code}`,
        out.stdout ? `--- sortie standard ---\n${out.stdout}` : "",
        out.stderr ? `--- erreurs ---\n${out.stderr}` : "",
      ].filter(Boolean).join("\n\n");
      setBuildLog(log);
      const failed = Boolean(out.error) || out.exit_code !== 0;
      setBuildState(failed ? "error" : "success");
      setBuildError(failed ? out.error || `La commande s’est arrêtée avec le code ${out.exit_code ?? "inconnu"}.` : null);
      setStatus(failed ? "Build en échec — consultez le journal" : "Build terminé");
    } catch (error) {
      if (current()) {
        setBuildState("error");
        setBuildError(String(error));
        setBuildLog(String(error));
      }
    } finally {
      if (current()) buildLock.current = false;
    }
  }, [selectedId, buildCmd, setStatus]);

  useEffect(() => {
    if (!selectedId || (centerTab !== "logs" && !(centerTab === "preview" && devPreviewUrl))) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const result = await api.getPreviewLogs(selectedId);
        if (!cancelled) setDevServerLog(result.log ?? "");
      } catch (error) {
        if (!cancelled) setDevServerLog(`Journal indisponible : ${error}`);
      }
      if (!cancelled) timer = setTimeout(() => void tick(), 1500);
    };
    void tick();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [selectedId, centerTab, devPreviewUrl]);

  const previewUrl = devPreviewUrl ?? staticPreviewBlobUrl;
  const openPreviewInNewWindow = useCallback(() => {
    if (previewUrl) window.open(previewUrl, "_blank", "noopener,noreferrer");
  }, [previewUrl]);

  return {
    setStaticPreviewBlobUrl, setDevPreviewUrl, buildCmd, setBuildCmd, onBuild, buildLog, buildState, buildError,
    previewProfile, forceInstallBeforePreview, setForceInstallBeforePreview, strictWebSandbox, setStrictWebSandbox,
    depsInstallBusy, onInstallDepsOnly, previewBusy, onPlayPreview, devPreviewUrl, onStopPreview, previewUrl,
    openPreviewInNewWindow, previewLog, staticPreviewBlobUrl, devServerLog, previewError, previewAction,
  };
}
