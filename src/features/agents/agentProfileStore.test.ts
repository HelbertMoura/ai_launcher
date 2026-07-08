import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentProfile } from "../../domain/types";
import {
  addAgentProfile,
  getActiveAgentProfile,
  loadAgentProfiles,
  normalizeAgentProfile,
  removeAgentProfile,
  setActiveAgentProfileId,
  toggleAgentProfilePin,
  updateAgentProfile,
} from "./agentProfileStore";

function profile(patch: Partial<AgentProfile> = {}): AgentProfile {
  return {
    id: "agent-1",
    name: "Builder",
    cliKey: "claude",
    args: "--dangerously-skip-permissions",
    tags: [],
    pinned: false,
    createdAt: "2026-07-07T00:00:00.000Z",
    updatedAt: "2026-07-07T00:00:00.000Z",
    ...patch,
  };
}

describe("agentProfileStore", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it("adds and loads profiles", () => {
    addAgentProfile([], profile());

    expect(loadAgentProfiles()).toHaveLength(1);
    expect(loadAgentProfiles()[0].name).toBe("Builder");
  });

  it("updates and toggles pinned profiles", () => {
    const list = addAgentProfile([], profile());
    const updated = updateAgentProfile(list, "agent-1", { name: "Reviewer" });
    const pinned = toggleAgentProfilePin(updated, "agent-1");

    expect(pinned[0]).toMatchObject({ name: "Reviewer", pinned: true });
  });

  it("tracks and clears the active profile", () => {
    const list = addAgentProfile([], profile());
    setActiveAgentProfileId("agent-1");

    expect(getActiveAgentProfile(list)?.name).toBe("Builder");
    removeAgentProfile(list, "agent-1");
    expect(getActiveAgentProfile(loadAgentProfiles())).toBeNull();
  });

  it("normalizes optional strings and tags", () => {
    expect(
      normalizeAgentProfile(
        profile({
          name: " Builder ",
          description: " ",
          cliKey: " codex ",
          providerKey: " ",
          args: " --fast ",
          runbookId: "",
          tags: [" review ", ""],
        }),
      ),
    ).toMatchObject({
      name: "Builder",
      description: undefined,
      cliKey: "codex",
      providerKey: undefined,
      args: "--fast",
      runbookId: undefined,
      tags: ["review"],
    });
  });
});
