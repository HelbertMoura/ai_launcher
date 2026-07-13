import { describe, expect, it } from "vitest";
import { buildWorkspaceOverview } from "./workspaceOverviewModel";

describe("buildWorkspaceOverview", () => {
  it("scopes active sessions to the selected workspace", () => {
    const workspace = { id: "ws", name: "Deck", directory: "C:/deck", cliKeys: [], envVars: {}, tags: [], pinned: true, createdAt: "now", updatedAt: "now" };
    const history = [
      { cli: "Codex", cliKey: "codex", directory: "C:/deck", args: "", timestamp: "now", startedAt: "now", status: "running" as const },
      { cli: "Codex", cliKey: "codex", directory: "C:/other", args: "", timestamp: "now", startedAt: "now", status: "running" as const },
    ];
    expect(buildWorkspaceOverview([workspace], [], workspace, history)).toEqual({
      profiles: 1, pinned: 1, agents: 0, activeSessions: 1,
    });
  });
});
