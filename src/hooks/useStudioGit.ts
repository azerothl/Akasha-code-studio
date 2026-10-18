import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as api from "../api";
import type { CenterTab } from "../studioNavigation";

type Dependencies = {
  selectedId: string | null;
  centerTab: CenterTab;
};

export function useStudioGit({ selectedId, centerTab }: Dependencies) {
  const projectRef = useRef(selectedId);
  projectRef.current = selectedId;
  const branchesRequest = useRef(0);
  const conflictsRequest = useRef(0);
  const [gitError, setGitError] = useState<string | null>(null);

  const [gitHeadBranch, setGitHeadBranch] = useState<string | null>(null);

  const [gitWorktreeClean, setGitWorktreeClean] = useState<boolean | null>(null);

  const [gitWorktreeLines, setGitWorktreeLines] = useState<{ status: string; path: string }[]>([]);

  const [gitBranches, setGitBranches] = useState<api.GitBranchEntry[]>([]);

  const [gitBranchesLoading, setGitBranchesLoading] = useState(false);

  const [gitCompareBase, setGitCompareBase] = useState("");

  const [gitCompareTarget, setGitCompareTarget] = useState("");

  const [gitCompareResult, setGitCompareResult] = useState<api.GitComparePayload | null>(null);

  const [gitConflicts, setGitConflicts] = useState<string[]>([]);

  const [gitMergeInProgress, setGitMergeInProgress] = useState(false);

  const [evolutions, setEvolutions] = useState<api.Evolution[]>([]);

  const [evoLabel, setEvoLabel] = useState("");

  const [selectedEvoId, setSelectedEvoId] = useState<string | null>(null);

  const refreshEvolutions = useCallback(async () => {
    if (!selectedId) return;
    try {
      const evo = await api.listEvolutions(selectedId);
      if (projectRef.current !== selectedId) return;
      setEvolutions(evo);
    } catch (error) {
      if (projectRef.current === selectedId) setGitError(String(error));
    }
  }, [selectedId]);

  const refreshGitBranches = useCallback(async () => {
    const request = ++branchesRequest.current;
    if (!selectedId) {
      setGitBranches([]);
      return;
    }
    setGitBranchesLoading(true);
    setGitError(null);
    try {
      const payload = await api.listGitBranches(selectedId);
      if (request !== branchesRequest.current || projectRef.current !== selectedId) return;
      setGitBranches(payload.branches);
      setGitCompareBase(previous => previous || payload.current_branch || "");
      setGitCompareTarget(previous => previous || payload.branches.find(b => !b.current)?.name || "");
    } catch (error) {
      if (request === branchesRequest.current && projectRef.current === selectedId) setGitError(String(error));
    } finally {
      if (request === branchesRequest.current && projectRef.current === selectedId) setGitBranchesLoading(false);
    }
  }, [selectedId]);

  const refreshGitConflicts = useCallback(async () => {
    const request = ++conflictsRequest.current;
    if (!selectedId) {
      setGitConflicts([]);
      setGitMergeInProgress(false);
      return;
    }
    try {
      const payload = await api.getGitConflicts(selectedId);
      if (request !== conflictsRequest.current || projectRef.current !== selectedId) return;
      setGitConflicts(payload.conflict_files);
      setGitMergeInProgress(payload.merge_in_progress);
    } catch (error) {
      if (request === conflictsRequest.current && projectRef.current === selectedId) setGitError(String(error));
    }
  }, [selectedId]);

  useEffect(() => {
    setGitBranches([]); setGitCompareBase(""); setGitCompareTarget(""); setGitCompareResult(null);
    setGitConflicts([]); setGitMergeInProgress(false); setEvolutions([]); setSelectedEvoId(null); setGitError(null);
    void refreshEvolutions();
    return () => { branchesRequest.current++; conflictsRequest.current++; };
  }, [refreshEvolutions]);

  const activeBranch = useMemo(() => {
    if (!selectedEvoId) return null;
    return evolutions.find((e) => e.id === selectedEvoId)?.branch ?? null;
  }, [evolutions, selectedEvoId]);

  useEffect(() => {
    if (!selectedId || centerTab !== "branches") return;
    void refreshGitBranches();
    void refreshGitConflicts();
  }, [selectedId, centerTab, refreshGitBranches, refreshGitConflicts]);
  return {
    gitError,
    gitHeadBranch,
    gitWorktreeClean,
    gitWorktreeLines,
    setGitHeadBranch,
    setGitWorktreeClean,
    setGitWorktreeLines,
    setEvolutions,
    setGitBranches,
    setGitCompareBase,
    setGitCompareTarget,
    setGitCompareResult,
    setGitConflicts,
    setGitMergeInProgress,
    refreshGitBranches,
    refreshGitConflicts,
    gitCompareBase,
    gitCompareTarget,
    evoLabel,
    setSelectedEvoId,
    setEvoLabel,
    selectedEvoId,
    activeBranch,
    evolutions,
    gitBranchesLoading,
    gitBranches,
    refreshEvolutions,
    gitCompareResult,
    gitMergeInProgress,
    gitConflicts
  };
}
