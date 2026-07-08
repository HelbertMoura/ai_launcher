import type { TabId } from "../../app/layout/TabId";
import type { WorkspaceProfile, Runbook } from "../../domain/types";
import type { CheckResult, CliInfo } from "../launcher/useClis";
import type { HistoryItem, SessionStatus } from "../history/useHistory";

export type ReadinessTone = "ok" | "warn" | "neutral";

export interface CommandCenterAction {
  id: "launch" | "setup" | "ide" | "workspace" | "doctor" | "mcp" | "history";
  labelKey: string;
  descriptionKey: string;
  targetTab: TabId;
  primary?: boolean;
  disabled?: boolean;
}

export interface ReadinessCard {
  id: "workspace" | "clis" | "doctor" | "mcp" | "runbooks" | "sessions" | "profile";
  labelKey: string;
  value: string;
  detailKey: string;
  detailParams?: Record<string, string | number>;
  tone: ReadinessTone;
  targetTab: TabId;
}

export interface SessionSummary {
  id: string;
  source: "active" | "history";
  sessionId?: string;
  cliKey: string;
  cli: string;
  directory: string;
  status: SessionStatus;
  when: string;
  killable: boolean;
  historyIndex?: number;
}

export interface ActiveSessionInput {
  session_id: string;
  cli_key: string;
  directory: string;
  started_at: string;
  kind: string;
  pid: number | null;
}

export interface CommandCenterModel {
  workspaceName: string;
  workspaceDirectory: string;
  workspaceCount: number;
  hasWorkspace: boolean;
  defaultCliName: string;
  providerLabel: string;
  actions: CommandCenterAction[];
  readiness: ReadinessCard[];
  recentSessions: SessionSummary[];
}

export interface CommandCenterInput {
  activeWorkspace: WorkspaceProfile | null;
  workspaces: WorkspaceProfile[];
  clis: CliInfo[];
  checks: Record<string, CheckResult>;
  runbooks: Runbook[];
  history: HistoryItem[];
  activeSessions?: ActiveSessionInput[];
  providerName?: string;
  doctor?: {
    loading: boolean;
    error: string | null;
    total: number;
    missing: number;
    critical: number;
  };
  mcp?: {
    loading: boolean;
    error: string | null;
    total: number;
    enabled: number;
  };
  projectProfile?: {
    loading: boolean;
    present: boolean;
    error: string | null;
  };
  tools?: {
    loading: boolean;
    error: string | null;
    total: number;
    installed: number;
  };
}

const ACTIVE_STATUSES = new Set<SessionStatus>(["starting", "running"]);

function basename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

function cliLabel(cliKey: string | undefined, clis: CliInfo[]): string {
  if (!cliKey) return "No CLI";
  return clis.find((cli) => cli.key === cliKey)?.name ?? cliKey;
}

function installedCount(checks: Record<string, CheckResult>): number {
  return Object.values(checks).filter((check) => check.installed).length;
}

function formatWhen(item: HistoryItem): string {
  const iso = item.startedAt || item.timestamp;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const diff = Math.max(0, Date.now() - then);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

function relativeAge(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const diff = Math.max(0, Date.now() - then);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

function summarizeSessions(
  history: HistoryItem[],
  activeSessions: ActiveSessionInput[] = [],
  clis: CliInfo[],
): SessionSummary[] {
  const active = activeSessions.map((item) => ({
    id: `active-${item.session_id}`,
    source: "active" as const,
    sessionId: item.session_id,
    cliKey: item.cli_key,
    cli: cliLabel(item.cli_key, clis),
    directory: item.directory ? basename(item.directory) : "",
    status: "running" as SessionStatus,
    when: relativeAge(item.started_at),
    killable: item.kind === "tracked" && item.pid != null,
  }));
  const activeIds = new Set(activeSessions.map((item) => item.session_id));
  const recent = history
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !item.sessionId || !activeIds.has(item.sessionId))
    .slice(0, Math.max(0, 5 - active.length))
    .map(({ item, index }) => ({
    id: item.sessionId ?? `${item.cliKey}-${item.timestamp}-${index}`,
    source: "history" as const,
    sessionId: item.sessionId,
    cliKey: item.cliKey,
    cli: item.cli || item.cliKey || "session",
    directory: item.directory ? basename(item.directory) : "",
    status: item.status,
    when: formatWhen(item),
    killable: false,
    historyIndex: index,
  }));
  return [...active, ...recent].slice(0, 5);
}

export function buildCommandCenterModel(input: CommandCenterInput): CommandCenterModel {
  const { activeWorkspace, workspaces, clis, checks, runbooks, history } = input;
  const hasWorkspace = Boolean(activeWorkspace);
  const totalChecks = Object.keys(checks).length || clis.length;
  const installed = installedCount(checks);
  const activeSessionCount =
    input.activeSessions?.length ?? history.filter((item) => ACTIVE_STATUSES.has(item.status)).length;
  const defaultCliName = cliLabel(activeWorkspace?.cliKeys[0], clis);
  const providerLabel = input.providerName ?? activeWorkspace?.providerKey ?? "Default";
  const profileReady = Boolean(activeWorkspace?.directory && activeWorkspace.cliKeys.length > 0);
  const doctor = input.doctor;
  const mcp = input.mcp;
  const projectProfile = input.projectProfile;
  const tools = input.tools;
  const installedTools = tools?.installed ?? 0;
  const toolsLoading = tools?.loading ?? false;

  const actions: CommandCenterAction[] = [
    {
      id: "launch",
      labelKey: "commandCenter.actionLaunch",
      descriptionKey: "commandCenter.actionLaunchDesc",
      targetTab: "launcher",
      primary: true,
      disabled: !profileReady,
    },
    {
      id: "setup",
      labelKey: "commandCenter.actionSetup",
      descriptionKey: "commandCenter.actionSetupDesc",
      targetTab: "workspace",
    },
    {
      id: "ide",
      labelKey: "commandCenter.actionIde",
      descriptionKey: "commandCenter.actionIdeDesc",
      targetTab: "tools",
      disabled: !hasWorkspace || toolsLoading || installedTools === 0,
    },
    {
      id: "doctor",
      labelKey: "commandCenter.actionDoctor",
      descriptionKey: "commandCenter.actionDoctorDesc",
      targetTab: "doctor",
    },
    {
      id: "mcp",
      labelKey: "commandCenter.actionMcp",
      descriptionKey: "commandCenter.actionMcpDesc",
      targetTab: "mcp",
    },
    {
      id: "history",
      labelKey: "commandCenter.actionHistory",
      descriptionKey: "commandCenter.actionHistoryDesc",
      targetTab: "history",
      disabled: history.length === 0,
    },
    {
      id: "workspace",
      labelKey: "commandCenter.actionWorkspace",
      descriptionKey: "commandCenter.actionWorkspaceDesc",
      targetTab: "workspace",
    },
  ];

  const readiness: ReadinessCard[] = [
    {
      id: "workspace",
      labelKey: "commandCenter.cardWorkspace",
      value: hasWorkspace ? activeWorkspace?.name ?? "" : "None",
      detailKey: hasWorkspace ? "commandCenter.cardWorkspacePath" : "commandCenter.cardSavedWorkspaces",
      detailParams: hasWorkspace
        ? { path: activeWorkspace?.directory ?? "" }
        : { count: workspaces.length },
      tone: hasWorkspace ? "ok" : "warn",
      targetTab: "workspace",
    },
    {
      id: "clis",
      labelKey: "commandCenter.cardClis",
      value: `${installed}/${totalChecks}`,
      detailKey: "commandCenter.cardInstalled",
      tone: installed > 0 ? "ok" : "warn",
      targetTab: "launcher",
    },
    {
      id: "doctor",
      labelKey: "commandCenter.cardDoctor",
      value: doctor?.loading
        ? "..."
        : doctor?.error
          ? "Error"
          : doctor
            ? String(doctor.missing)
            : "—",
      detailKey: doctor?.error
        ? "commandCenter.cardDoctorError"
        : doctor?.loading
          ? "commandCenter.cardScanning"
          : doctor && doctor.missing === 0
            ? "commandCenter.cardDoctorOk"
            : "commandCenter.cardDoctorMissing",
      detailParams: doctor ? { total: doctor.total, missing: doctor.missing, critical: doctor.critical } : undefined,
      tone: doctor?.error || (doctor && doctor.critical > 0) ? "warn" : doctor && doctor.missing === 0 ? "ok" : "neutral",
      targetTab: "doctor",
    },
    {
      id: "mcp",
      labelKey: "commandCenter.cardMcp",
      value: mcp?.loading ? "..." : mcp?.error ? "Error" : mcp ? String(mcp.enabled) : "—",
      detailKey: mcp?.error
        ? "commandCenter.cardMcpError"
        : mcp?.loading
          ? "commandCenter.cardLoading"
          : mcp && mcp.total > 0
            ? "commandCenter.cardMcpConfigured"
            : "commandCenter.cardMcpEmpty",
      detailParams: mcp ? { total: mcp.total, enabled: mcp.enabled } : undefined,
      tone: mcp?.error ? "warn" : mcp && mcp.enabled > 0 ? "ok" : "neutral",
      targetTab: "mcp",
    },
    {
      id: "runbooks",
      labelKey: "commandCenter.cardRunbooks",
      value: String(runbooks.length),
      detailKey: "commandCenter.cardSaved",
      tone: runbooks.length > 0 ? "ok" : "neutral",
      targetTab: "workspace",
    },
    {
      id: "sessions",
      labelKey: "commandCenter.cardSessions",
      value: String(activeSessionCount),
      detailKey: "commandCenter.cardRecentSessions",
      detailParams: { count: history.length },
      tone: activeSessionCount > 0 ? "ok" : "neutral",
      targetTab: "history",
    },
    {
      id: "profile",
      labelKey: "commandCenter.cardProfile",
      value: projectProfile?.loading
        ? "..."
        : projectProfile?.error
          ? "Error"
          : projectProfile?.present
            ? "Ready"
            : profileReady
              ? "Draft"
              : "None",
      detailKey: projectProfile?.error
        ? "commandCenter.cardProfileError"
        : projectProfile?.loading
          ? "commandCenter.cardLoading"
          : projectProfile?.present
            ? "commandCenter.cardProjectProfileFound"
            : profileReady
              ? "commandCenter.cardProfileDraft"
              : "commandCenter.cardProfileMissing",
      detailParams: { cli: defaultCliName },
      tone: projectProfile?.error ? "warn" : projectProfile?.present ? "ok" : profileReady ? "neutral" : "warn",
      targetTab: "workspace",
    },
  ];

  return {
    workspaceName: activeWorkspace?.name ?? "No active workspace",
    workspaceDirectory: activeWorkspace?.directory ?? "Pick or create a workspace to start",
    workspaceCount: workspaces.length,
    hasWorkspace,
    defaultCliName,
    providerLabel,
    actions,
    readiness,
    recentSessions: summarizeSessions(history, input.activeSessions, clis),
  };
}
