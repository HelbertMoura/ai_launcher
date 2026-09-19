import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AgentProfile } from "../../domain/types";
import { showToast } from "../../ui/toastStore";
import {
  addAgentProfile,
  generateAgentProfileId,
  getActiveAgentProfileId,
  loadAgentProfiles,
  normalizeAgentProfile,
  removeAgentProfile,
  setActiveAgentProfileId,
  toggleAgentProfilePin,
  updateAgentProfile,
} from "../agents/agentProfileStore";

/**
 * State + handlers for agent profiles: list, active id, editor
 * (create/edit) and delete confirmation flows. Persisted through
 * `agentProfileStore`; toasts give the legacy user feedback.
 */
export function useAgentProfiles() {
  const { t } = useTranslation();
  const [agentProfiles, setAgentProfiles] = useState<AgentProfile[]>(() => loadAgentProfiles());
  const [activeAgentId, setActiveAgentId] = useState<string | null>(() =>
    getActiveAgentProfileId(),
  );
  const [editingAgent, setEditingAgent] = useState<AgentProfile | null>(null);
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [deleteAgentTarget, setDeleteAgentTarget] = useState<AgentProfile | null>(null);

  const activateAgent = useCallback((id: string) => {
    setActiveAgentProfileId(id);
    setActiveAgentId(id);
  }, []);

  const deactivateAgent = useCallback(() => {
    setActiveAgentProfileId(null);
    setActiveAgentId(null);
  }, []);

  const executeDeleteAgent = useCallback(
    (id: string) => {
      setAgentProfiles((prev) => removeAgentProfile(prev, id));
      if (activeAgentId === id) setActiveAgentId(null);
      showToast(t("workspace.agentToastDeleted"), "success");
    },
    [activeAgentId, t],
  );

  const requestDeleteAgent = useCallback(
    (id: string) => {
      setDeleteAgentTarget(agentProfiles.find((profile) => profile.id === id) ?? null);
    },
    [agentProfiles],
  );

  const confirmDeleteAgent = useCallback(() => {
    if (deleteAgentTarget) executeDeleteAgent(deleteAgentTarget.id);
    setDeleteAgentTarget(null);
  }, [deleteAgentTarget, executeDeleteAgent]);

  const cancelDeleteAgent = useCallback(() => setDeleteAgentTarget(null), []);

  const toggleAgentPin = useCallback((id: string) => {
    setAgentProfiles((prev) => toggleAgentProfilePin(prev, id));
  }, []);

  const saveAgent = useCallback(
    (profile: AgentProfile) => {
      const normalized = normalizeAgentProfile(profile);
      const isNew = !agentProfiles.some((item) => item.id === normalized.id);
      setAgentProfiles((prev) =>
        isNew
          ? addAgentProfile(prev, normalized)
          : updateAgentProfile(prev, normalized.id, normalized),
      );
      setEditingAgent(null);
      setCreatingAgent(false);
      showToast(
        t(isNew ? "workspace.agentToastCreated" : "workspace.agentToastSaved"),
        "success",
      );
    },
    [agentProfiles, t],
  );

  const startNewAgent = useCallback(() => {
    const now = new Date().toISOString();
    setEditingAgent({
      id: generateAgentProfileId(),
      name: "",
      tags: [],
      pinned: false,
      createdAt: now,
      updatedAt: now,
    });
    setCreatingAgent(true);
  }, []);

  const startEditAgent = useCallback((profile: AgentProfile) => {
    setEditingAgent(profile);
    setCreatingAgent(false);
  }, []);

  const cancelEditAgent = useCallback(() => {
    setEditingAgent(null);
    setCreatingAgent(false);
  }, []);

  const activeAgent = activeAgentId
    ? agentProfiles.find((profile) => profile.id === activeAgentId) ?? null
    : null;
  const sortedAgents = [
    ...agentProfiles.filter((p) => p.pinned),
    ...agentProfiles.filter((p) => !p.pinned),
  ];

  return {
    agentProfiles,
    activeAgentId,
    activeAgent,
    sortedAgents,
    editingAgent,
    creatingAgent,
    deleteAgentTarget,
    activateAgent,
    deactivateAgent,
    requestDeleteAgent,
    confirmDeleteAgent,
    cancelDeleteAgent,
    toggleAgentPin,
    saveAgent,
    startNewAgent,
    startEditAgent,
    cancelEditAgent,
  };
}
