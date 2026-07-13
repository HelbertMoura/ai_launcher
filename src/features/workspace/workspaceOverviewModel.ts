import type { AgentProfile, WorkspaceProfile } from "../../domain/types";
import type { HistoryItem } from "../history/useHistory";

export interface WorkspaceOverview {
  profiles: number;
  pinned: number;
  agents: number;
  activeSessions: number;
}

export function buildWorkspaceOverview(
  profiles: WorkspaceProfile[],
  agents: AgentProfile[],
  activeWorkspace: WorkspaceProfile | null,
  history: HistoryItem[],
): WorkspaceOverview {
  const activeSessions = activeWorkspace
    ? history.filter(
        (item) =>
          item.directory === activeWorkspace.directory &&
          (item.status === "running" || item.status === "starting"),
      ).length
    : 0;
  return {
    profiles: profiles.length,
    pinned: profiles.filter((profile) => profile.pinned).length,
    agents: agents.length,
    activeSessions,
  };
}
