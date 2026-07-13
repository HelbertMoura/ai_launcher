import { describe, expect, it } from "vitest";
import type { WorkspaceProfile, Runbook } from "../../domain/types";
import type { CheckResult, CliInfo } from "../launcher/useClis";
import type { HistoryItem } from "../history/useHistory";
import { buildCommandCenterModel } from "./commandCenterModel";

function workspace(patch: Partial<WorkspaceProfile> = {}): WorkspaceProfile {
  return {
    id: "ws1",
    name: "AI Launcher",
    directory: "C:\\dev\\ai-launcher",
    cliKeys: ["claude"],
    envVars: {},
    tags: [],
    pinned: true,
    createdAt: "2026-07-07T00:00:00.000Z",
    updatedAt: "2026-07-07T00:00:00.000Z",
    ...patch,
  };
}

const clis: CliInfo[] = [
  {
    key: "claude",
    name: "Claude Code",
    command: "claude",
    flag: null,
    install_cmd: "",
    version_cmd: "",
    npm_pkg: null,
    pip_pkg: null,
    install_method: "manual",
    install_url: null,
    extra_paths: [],
    update_manifest_url: null,
  },
];

const checks: Record<string, CheckResult> = {
  claude: {
    name: "claude",
    installed: true,
    version: "1.0.0",
    install_command: null,
  },
};

function runbook(patch: Partial<Runbook> = {}): Runbook {
  return {
    id: "rb1",
    name: "Setup",
    steps: [],
    tags: [],
    createdAt: "2026-07-07T00:00:00.000Z",
    updatedAt: "2026-07-07T00:00:00.000Z",
    ...patch,
  };
}

function history(patch: Partial<HistoryItem> = {}): HistoryItem {
  return {
    cli: "Claude Code",
    cliKey: "claude",
    directory: "C:\\dev\\ai-launcher",
    args: "",
    timestamp: new Date().toISOString(),
    status: "running",
    startedAt: new Date().toISOString(),
    ...patch,
  };
}

describe("buildCommandCenterModel", () => {
  it("summarizes an active workspace and enables launch", () => {
    const model = buildCommandCenterModel({
      activeWorkspace: workspace(),
      workspaces: [workspace()],
      clis,
      checks,
      runbooks: [runbook()],
      history: [history()],
      providerName: "Anthropic",
    });

    expect(model.workspaceName).toBe("AI Launcher");
    expect(model.defaultCliName).toBe("Claude Code");
    expect(model.providerLabel).toBe("Anthropic");
    expect(model.actions.find((a) => a.id === "launch")?.disabled).toBe(false);
    expect(model.actions.find((a) => a.id === "ide")?.disabled).toBe(true);
    expect(model.readiness.find((c) => c.id === "sessions")?.value).toBe("1");
    expect(model.state).toBe("running");
  });

  it("enables IDE action when a workspace and installed tool exist", () => {
    const model = buildCommandCenterModel({
      activeWorkspace: workspace(),
      workspaces: [workspace()],
      clis,
      checks,
      runbooks: [],
      history: [],
      tools: {
        loading: false,
        error: null,
        total: 1,
        installed: 1,
      },
    });

    expect(model.actions.find((a) => a.id === "ide")?.disabled).toBe(false);
  });

  it("warns when no workspace is active", () => {
    const model = buildCommandCenterModel({
      activeWorkspace: null,
      workspaces: [],
      clis,
      checks: {},
      runbooks: [],
      history: [],
    });

    expect(model.hasWorkspace).toBe(false);
    expect(model.state).toBe("empty");
    expect(model.actions.find((a) => a.id === "launch")?.disabled).toBe(true);
    expect(model.readiness.find((c) => c.id === "workspace")?.tone).toBe("warn");
  });

  it("exposes loading and degraded states explicitly", () => {
    const loading = buildCommandCenterModel({
      activeWorkspace: workspace(), workspaces: [workspace()], clis, checks,
      runbooks: [], history: [], doctor: { loading: true, error: null, total: 0, missing: 0, critical: 0 },
    });
    const degraded = buildCommandCenterModel({
      activeWorkspace: workspace(), workspaces: [workspace()], clis, checks,
      runbooks: [], history: [], doctor: { loading: false, error: null, total: 3, missing: 1, critical: 1 },
    });
    expect(loading.state).toBe("loading");
    expect(degraded.state).toBe("degraded");
  });

  it("keeps recent sessions compact", () => {
    const model = buildCommandCenterModel({
      activeWorkspace: workspace(),
      workspaces: [workspace()],
      clis,
      checks,
      runbooks: [],
      history: Array.from({ length: 7 }, (_, i) =>
        history({ sessionId: `s${i}`, directory: `C:\\dev\\project-${i}` }),
      ),
    });

    expect(model.recentSessions).toHaveLength(5);
    expect(model.recentSessions[0].directory).toBe("project-0");
  });

  it("prioritizes active sessions and marks tracked sessions as killable", () => {
    const model = buildCommandCenterModel({
      activeWorkspace: workspace(),
      workspaces: [workspace()],
      clis,
      checks,
      runbooks: [],
      activeSessions: [
        {
          session_id: "active-1",
          cli_key: "claude",
          directory: "C:\\dev\\active",
          started_at: new Date().toISOString(),
          kind: "tracked",
          pid: 123,
        },
      ],
      history: [history({ sessionId: "old-1", status: "completed" })],
    });

    expect(model.readiness.find((card) => card.id === "sessions")?.value).toBe("1");
    expect(model.recentSessions[0]).toMatchObject({
      source: "active",
      sessionId: "active-1",
      killable: true,
    });
  });
});
