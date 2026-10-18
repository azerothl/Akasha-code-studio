import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as api from "../api";
import { clearLastProjectId, getLastProjectId, setLastProjectId } from "../lastProjectStorage";
import type * as React from "react";

type Dependencies = {
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setOpenHeaderMenu: React.Dispatch<React.SetStateAction<"project" | "evolutions" | "ops" | "agent" | null>>;
  setModalLoadOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setStatus: React.Dispatch<React.SetStateAction<string>>;
};

export function useStudioProjects({ setError, setOpenHeaderMenu, setModalLoadOpen, setStatus }: Dependencies) {

  const [projects, setProjects] = useState<api.StudioProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const projectsRequest = useRef(0);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [deleteProjectDialog, setDeleteProjectDialog] = useState<api.StudioProject | null>(null);

  const [deletePrecheck, setDeletePrecheck] = useState<api.StudioDeletePrecheck | null>(null);

  const [deletePrecheckLoading, setDeletePrecheckLoading] = useState(false);

  const [deleteProjectBusy, setDeleteProjectBusy] = useState(false);

  /** Incremented each time openDeleteProjectDialog is called; guards against applying a stale
   *  precheck result to the wrong project when the user quickly opens deletion for another project
   *  before the first precheck request resolves. */
  const deletePrecheckGenRef = useRef(0);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedId) ?? null,
    [projects, selectedId],
  );

  const refreshProjects = useCallback(async () => {
    const request = ++projectsRequest.current;
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      const p = await api.listProjects();
      if (request === projectsRequest.current) setProjects(p);
    } catch (e) {
      if (request === projectsRequest.current) setProjectsError(String(e));
    } finally {
      if (request === projectsRequest.current) setProjectsLoading(false);
    }
  }, []);

  const clearSessionSnapsForProject = useCallback((id: string) => {
    try {
      sessionStorage.removeItem(`akasha-plan-snap-${id}`);
      sessionStorage.removeItem(`akasha-design-snap-${id}`);
    } catch {
      /* private mode / quota */
    }
  }, []);

  const openDeleteProjectDialog = useCallback((p: api.StudioProject) => {
    setOpenHeaderMenu(null);
    setModalLoadOpen(false);
    setDeleteProjectDialog(p);
    setDeletePrecheck(null);
    setDeletePrecheckLoading(true);
    const gen = ++deletePrecheckGenRef.current;
    void api
      .getDeletePrecheck(p.id)
      .then((c) => {
        if (deletePrecheckGenRef.current !== gen) return;
        setDeletePrecheck(c);
      })
      .catch((e) => {
        if (deletePrecheckGenRef.current !== gen) return;
        setError(String(e));
        setDeleteProjectDialog(null);
      })
      .finally(() => {
        if (deletePrecheckGenRef.current !== gen) return;
        setDeletePrecheckLoading(false);
      });
  }, []);

  const onConfirmDeleteProject = useCallback(
    async (force: boolean) => {
      if (!deleteProjectDialog) return;
      setError(null);
      setDeleteProjectBusy(true);
      const id = deleteProjectDialog.id;
      try {
        try {
          await api.stopStudioPreview(id);
        } catch {
          /* déjà arrêté ou indisponible */
        }
        await api.deleteProject(id, force);
        clearSessionSnapsForProject(id);
        if (selectedId === id) {
          setSelectedId(null);
        }
        setDeleteProjectDialog(null);
        setDeletePrecheck(null);
        await refreshProjects();
        setStatus("Projet supprimé");
      } catch (e) {
        setError(String(e));
      } finally {
        setDeleteProjectBusy(false);
      }
    },
    [deleteProjectDialog, selectedId, refreshProjects, clearSessionSnapsForProject],
  );

  useEffect(() => {
    void refreshProjects();
    return () => { projectsRequest.current++; };
  }, [refreshProjects]);

  useEffect(() => {
    if (projects.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (selectedId && projects.some((p) => p.id === selectedId)) {
      return;
    }
    const lastId = getLastProjectId();
    const restoredId = lastId && projects.some((p) => p.id === lastId) ? lastId : projects[0]?.id ?? null;
    setSelectedId(restoredId);
    if (restoredId) setLastProjectId(restoredId);
  }, [projects, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      // Only clear the stored ID once projects have actually been loaded; on the
      // very first render projects is still [] and selectedId is null, so we must
      // not wipe the last-project-id before the restore logic has had a chance to
      // read it.
      if (projects.length > 0) clearLastProjectId();
      return;
    }
    setLastProjectId(selectedId);
  }, [selectedId, projects.length]);
  return {
    projectsLoading,
    projectsError,
    selectedProject,
    selectedId,
    setProjects,
    refreshProjects,
    setSelectedId,
    openDeleteProjectDialog,
    projects,
    deleteProjectDialog,
    deleteProjectBusy,
    setDeleteProjectDialog,
    deletePrecheckLoading,
    deletePrecheck,
    onConfirmDeleteProject
  };
}
