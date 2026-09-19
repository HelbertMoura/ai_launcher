import { useCallback, useState } from "react";
import type { ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import type { WorkspaceProfile } from "../../domain/types";
import type { HistoryItem } from "../history/useHistory";
import { showToast } from "../../ui/toastStore";
import {
  addWorkspace,
  exportWorkspaces,
  generateWorkspaceId,
  getActiveWorkspace,
  getActiveWorkspaceId,
  importWorkspaces,
  loadWorkspaces,
  removeWorkspace,
  setActiveWorkspaceId,
  togglePin as toggleWorkspacePin,
  updateWorkspace,
} from "./workspaceStore";

/**
 * State + handlers for workspace profiles: list, active id, editor
 * (create/edit), delete confirmation and import/export flows. Persisted
 * through `workspaceStore`; toasts give the legacy user feedback.
 */
export function useWorkspaceProfiles() {
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState<WorkspaceProfile[]>(() => loadWorkspaces());
  const [activeId, setActiveId] = useState<string | null>(() => getActiveWorkspaceId());
  const [editing, setEditing] = useState<WorkspaceProfile | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WorkspaceProfile | null>(null);

  const activate = useCallback((id: string) => {
    setActiveWorkspaceId(id);
    setActiveId(id);
  }, []);

  const deactivate = useCallback(() => {
    setActiveWorkspaceId(null);
    setActiveId(null);
  }, []);

  const executeDelete = useCallback(
    (id: string) => {
      setProfiles((prev) => removeWorkspace(prev, id));
      if (activeId === id) setActiveId(null);
      showToast(t("workspace.toastDeleted"), "success");
    },
    [activeId, t],
  );

  const requestDelete = useCallback(
    (id: string) => {
      setDeleteTarget(profiles.find((p) => p.id === id) ?? null);
    },
    [profiles],
  );

  const confirmDelete = useCallback(() => {
    if (deleteTarget) executeDelete(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, executeDelete]);

  const cancelDelete = useCallback(() => setDeleteTarget(null), []);

  const togglePin = useCallback((id: string) => {
    setProfiles((prev) => toggleWorkspacePin(prev, id));
  }, []);

  const save = useCallback((profile: WorkspaceProfile) => {
    const isNew = !profiles.some((p) => p.id === profile.id);
    setProfiles((prev) => {
      const exists = prev.some((p) => p.id === profile.id);
      return exists ? updateWorkspace(prev, profile.id, profile) : addWorkspace(prev, profile);
    });
    setEditing(null);
    setCreating(false);
    showToast(t(isNew ? "workspace.toastCreated" : "workspace.toastSaved"), "success");
  }, [profiles, t]);

  const createFromHistory = useCallback((item: HistoryItem) => {
    const now = new Date().toISOString();
    const profile: WorkspaceProfile = {
      id: generateWorkspaceId(),
      name: `${item.cli} - ${item.directory.split(/[/\\]/).pop() ?? "workspace"}`,
      description: item.description,
      directory: item.directory,
      cliKeys: item.cliKey ? [item.cliKey] : [],
      providerKey: item.providerId,
      envVars: {},
      tags: [],
      pinned: false,
      createdAt: now,
      updatedAt: now,
    };
    setProfiles((prev) => addWorkspace(prev, profile));
    showToast(t("workspace.toastCreated"), "success");
  }, [t]);

  const startNew = useCallback(() => {
    const now = new Date().toISOString();
    setEditing({
      id: generateWorkspaceId(),
      name: "",
      directory: "",
      cliKeys: [],
      envVars: {},
      tags: [],
      pinned: false,
      createdAt: now,
      updatedAt: now,
    });
    setCreating(true);
  }, []);

  const startEdit = useCallback((profile: WorkspaceProfile) => {
    setEditing(profile);
    setCreating(false);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditing(null);
    setCreating(false);
  }, []);

  const exportToFile = useCallback(() => {
    const json = exportWorkspaces(profiles);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ai-launcher-workspaces.json";
    a.click();
    URL.revokeObjectURL(url);
    showToast(t("workspace.toastExported"), "success");
  }, [profiles, t]);

  const importFromFile = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        const merged = importWorkspaces(profiles, text);
        if (merged) {
          setProfiles(merged);
          showToast(t("workspace.toastImported"), "success");
        } else {
          showToast(t("workspace.toastImportFailed"), "error");
        }
      };
      reader.onerror = () => showToast(t("workspace.toastImportFailed"), "error");
      void reader.readAsText(file);
      e.target.value = "";
    },
    [profiles, t],
  );

  const activeProfile = getActiveWorkspace(profiles);
  const pinned = profiles.filter((p) => p.pinned);
  const unpinned = profiles.filter((p) => !p.pinned);
  const sortedProfiles = [...pinned, ...unpinned];

  return {
    profiles,
    activeId,
    activeProfile,
    sortedProfiles,
    pinnedCount: pinned.length,
    editing,
    creating,
    deleteTarget,
    activate,
    deactivate,
    requestDelete,
    confirmDelete,
    cancelDelete,
    togglePin,
    save,
    startNew,
    startEdit,
    cancelEdit,
    createFromHistory,
    exportToFile,
    importFromFile,
  };
}
