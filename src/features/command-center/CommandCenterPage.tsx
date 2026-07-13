import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import type { TabId } from "../../app/layout/TabId";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { EmptyState, ART_TERMINAL } from "../../ui/EmptyState";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import { showToast } from "../../ui/toastStore";
import { loadProviders } from "../../providers/storage";
import { invokeOrFallback } from "../../lib/tauri";
import {
  formatProjectProfile,
  parseProjectProfile,
  readProjectProfile,
  writeProjectProfile,
  type ProjectProfile,
} from "../../lib/projectProfile";
import { useHistory } from "../history/useHistory";
import { useClis } from "../launcher/useClis";
import { launchCliSession, recordFailedLaunch } from "../launcher/launchSession";
import { useTools } from "../tools/useTools";
import type { PrereqCheck } from "../prereqs/usePrerequisites";
import { useMcp } from "../mcp/useMcp";
import {
  mcpServerKey,
  resolveProjectMcpServers,
  serverToHealthInput,
  summarizeProjectMcpHealth,
  type ProjectMcpHealthSummary,
  type ProjectMcpResolution,
} from "../mcp/projectMcp";
import type { McpHealth } from "../mcp/types";
import { getActiveAgentProfile, loadAgentProfiles } from "../agents/agentProfileStore";
import { getActiveWorkspace, loadWorkspaces } from "../workspace/workspaceStore";
import { getRunbooks } from "../workspace/runbookStore";
import { RunbooksPanel } from "../workspace/RunbooksPanel";
import {
  detectProjectStacks,
  type ProjectFileSnapshot,
  type ProjectStackScan,
} from "../project-intelligence/stackDetector";
import {
  buildCommandCenterModel,
  type ActiveSessionInput,
  type CommandCenterAction,
  type ReadinessCard,
  type SessionSummary,
} from "./commandCenterModel";
import "./CommandCenterPage.css";
import { approvalFor, getExecutionMode } from "../../domain/executionMode";
import { appendAuditEvent } from "../../lib/auditLog";

interface CommandCenterPageProps {
  onNavigate: (tab: TabId) => void;
}

export function CommandCenterPage({ onNavigate }: CommandCenterPageProps) {
  const { t } = useTranslation();
  const clis = useClis();
  const tools = useTools();
  const mcp = useMcp();
  const history = useHistory();
  const [launching, setLaunching] = useState(false);
  const [showRunbooks, setShowRunbooks] = useState(false);
  const [runbooksVersion, setRunbooksVersion] = useState(0);
  const [profileDraftOpen, setProfileDraftOpen] = useState(false);
  const [profileDraftText, setProfileDraftText] = useState("");
  const [profileDraftError, setProfileDraftError] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [launchingIde, setLaunchingIde] = useState(false);
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [killTarget, setKillTarget] = useState<SessionSummary | null>(null);
  const [approvalTarget, setApprovalTarget] = useState<"launch" | "ide" | null>(null);
  const [activeSessions, setActiveSessions] = useState<ActiveSessionInput[]>([]);
  const [doctorSummary, setDoctorSummary] = useState({
    loading: true,
    error: null as string | null,
    total: 0,
    missing: 0,
    critical: 0,
  });
  const [profileSummary, setProfileSummary] = useState({
    loading: false,
    present: false,
    error: null as string | null,
    profile: null as ProjectProfile | null,
  });
  const [projectMcpHealth, setProjectMcpHealth] = useState<{
    loading: boolean;
    error: string | null;
    health: Record<string, McpHealth>;
  }>({
    loading: false,
    error: null,
    health: {},
  });
  const [projectStack, setProjectStack] = useState<{
    loading: boolean;
    error: string | null;
    scan: ProjectStackScan | null;
  }>({
    loading: false,
    error: null,
    scan: null,
  });

  const workspaces = useMemo(() => loadWorkspaces(), []);
  const activeWorkspace = useMemo(() => getActiveWorkspace(workspaces), [workspaces]);
  const agentProfiles = useMemo(() => loadAgentProfiles(), []);
  const activeAgent = useMemo(
    () => getActiveAgentProfile(agentProfiles),
    [agentProfiles],
  );
  const runbooks = useMemo(() => getRunbooks(), [runbooksVersion]);
  const providerName = useMemo(() => {
    const providerKey = activeAgent?.providerKey ?? activeWorkspace?.providerKey;
    if (!providerKey) return undefined;
    try {
      const providers = loadProviders();
      return providers.profiles.find((p) => p.id === providerKey)?.name;
    } catch {
      return undefined;
    }
  }, [activeAgent?.providerKey, activeWorkspace?.providerKey]);

  const refreshActiveSessions = useCallback(async () => {
    const sessions = await invokeOrFallback<ActiveSessionInput[]>(
      "list_active_sessions",
      undefined,
      [],
    );
    setActiveSessions(Array.isArray(sessions) ? sessions : []);
  }, []);

  useEffect(() => {
    void refreshActiveSessions();
  }, [refreshActiveSessions, history.items]);

  useEffect(() => {
    let cancelled = false;
    setDoctorSummary((prev) => ({ ...prev, loading: true, error: null }));
    (async () => {
      try {
        const results = await invokeOrFallback<PrereqCheck[]>(
          "check_environment",
          undefined,
          [],
        );
        if (cancelled) return;
        const safeResults = Array.isArray(results) ? results : [];
        const missing = safeResults.filter((item) => !item.installed);
        const critical = missing.filter((item) => item.key === "node" || item.key === "git");
        setDoctorSummary({
          loading: false,
          error: null,
          total: safeResults.length,
          missing: missing.length,
          critical: critical.length,
        });
      } catch (e) {
        if (!cancelled) {
          setDoctorSummary({
            loading: false,
            error: e instanceof Error ? e.message : String(e),
            total: 0,
            missing: 0,
            critical: 0,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const directory = activeWorkspace?.directory?.trim();
    if (!directory) {
      setProfileSummary({ loading: false, present: false, error: null, profile: null });
      return;
    }
    setProfileSummary({ loading: true, present: false, error: null, profile: null });
    (async () => {
      try {
        const profile = await readProjectProfile(directory);
        if (!cancelled) {
          setProfileSummary({
            loading: false,
            present: Boolean(profile),
            error: null,
            profile,
          });
        }
      } catch (e) {
        if (!cancelled) {
          setProfileSummary({
            loading: false,
            present: false,
            error: e instanceof Error ? e.message : String(e),
            profile: null,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeWorkspace?.directory]);

  const projectMcpResolution = useMemo(
    () => resolveProjectMcpServers(mcp.servers, profileSummary.profile),
    [mcp.servers, profileSummary.profile],
  );

  useEffect(() => {
    let cancelled = false;
    const matches = projectMcpResolution.matched;
    if (projectMcpResolution.expectedIds.length === 0 || matches.length === 0) {
      setProjectMcpHealth({ loading: false, error: null, health: {} });
      return;
    }
    setProjectMcpHealth((prev) => ({ ...prev, loading: true, error: null }));
    (async () => {
      const next: Record<string, McpHealth> = {};
      try {
        for (const { server } of matches) {
          const health = await mcp.healthCheck(serverToHealthInput(server));
          if (cancelled) return;
          next[mcpServerKey(server)] = health;
        }
        if (!cancelled) {
          setProjectMcpHealth({ loading: false, error: null, health: next });
        }
      } catch (e) {
        if (!cancelled) {
          setProjectMcpHealth({
            loading: false,
            error: e instanceof Error ? e.message : String(e),
            health: next,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mcp.healthCheck, projectMcpResolution]);

  const projectMcpSummary = useMemo(
    () => summarizeProjectMcpHealth(projectMcpResolution, projectMcpHealth.health),
    [projectMcpHealth.health, projectMcpResolution],
  );

  useEffect(() => {
    let cancelled = false;
    const directory = activeWorkspace?.directory?.trim();
    if (!directory) {
      setProjectStack({ loading: false, error: null, scan: null });
      return;
    }
    setProjectStack({ loading: true, error: null, scan: null });
    (async () => {
      try {
        const snapshot = await invokeOrFallback<ProjectFileSnapshot>(
          "scan_project_stack",
          { directory },
          { files: [], manifests: {} },
        );
        if (!cancelled) {
          setProjectStack({
            loading: false,
            error: null,
            scan: detectProjectStacks(snapshot),
          });
        }
      } catch (e) {
        if (!cancelled) {
          setProjectStack({
            loading: false,
            error: e instanceof Error ? e.message : String(e),
            scan: null,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeWorkspace?.directory]);

  const model = useMemo(
    () =>
      buildCommandCenterModel({
        activeWorkspace,
        workspaces,
        clis: clis.clis,
        checks: clis.checks,
        runbooks,
        history: history.items,
        activeSessions,
        providerName,
        doctor: doctorSummary,
        mcp: {
          loading: mcp.loading,
          error: mcp.error,
          total: mcp.servers.length,
          enabled: mcp.servers.filter((server) => server.enabled).length,
        },
        projectProfile: profileSummary,
        tools: {
          loading: tools.loading,
          error: tools.error,
          total: tools.tools.length + tools.customIdes.length,
          installed:
            tools.tools.filter((tool) => tools.checks[tool.name]?.installed).length +
            tools.customIdes.length,
        },
      }),
    [
      activeWorkspace,
      activeSessions,
      clis.checks,
      clis.clis,
      doctorSummary,
      history.items,
      mcp.error,
      mcp.loading,
      mcp.servers,
      profileSummary,
      providerName,
      runbooks,
      tools.checks,
      tools.customIdes.length,
      tools.error,
      tools.loading,
      tools.tools,
      workspaces,
    ],
  );

  const projectProfileDraft = useMemo<ProjectProfile | null>(() => {
    if (!activeWorkspace?.directory?.trim()) return null;
    const cli =
      projectStack.scan?.profileHints.cli ?? activeAgent?.cliKey ?? activeWorkspace.cliKeys[0];
    if (!cli) return null;
    const runbook = projectStack.scan?.profileHints.runbook;
    return {
      version: 1,
      cli,
      directory: ".",
      ...(activeWorkspace.providerKey ? { provider: activeWorkspace.providerKey } : {}),
      ...(runbook ? { runbook } : {}),
    };
  }, [
    activeWorkspace?.cliKeys,
    activeWorkspace?.directory,
    activeWorkspace?.providerKey,
    activeAgent?.cliKey,
    projectStack.scan,
  ]);
  const projectProfilePreview = useMemo(
    () => (projectProfileDraft ? formatProjectProfile(projectProfileDraft) : ""),
    [projectProfileDraft],
  );
  const suggestedRunbookIds = useMemo(
    () => projectStack.scan?.stacks.flatMap((stack) => stack.recommendedRunbooks) ?? [],
    [projectStack.scan],
  );

  const handleLaunchWorkspace = useCallback(async () => {
    const cliKey = activeAgent?.cliKey ?? activeWorkspace?.cliKeys[0];
    const directory = activeWorkspace?.directory?.trim();
    if (!cliKey || !directory) {
      onNavigate("workspace");
      return;
    }
    const providerId = activeAgent?.providerKey ?? activeWorkspace?.providerKey;
    const cli = clis.clis.find((item) => item.key === cliKey) ?? {
      key: cliKey,
      name: cliKey,
    };

    setLaunching(true);
    try {
      const result = await launchCliSession({
        cli,
        directory,
        args: activeAgent?.args ?? "",
        providerId,
      });
      showToast(
        activeAgent
          ? t("commandCenter.launchStartedWithAgent", { cli: cli.name, agent: activeAgent.name })
          : t("commandCenter.launchStarted", { cli: cli.name }),
        "success",
      );
      if (result.projectProfileError) {
        showToast(result.projectProfileError, "warning");
      }
      history.refresh();
      appendAuditEvent({ action: "workspace.launch", outcome: "allowed", mode: getExecutionMode(), workspaceId: activeWorkspace?.id, detail: cli.key });
      void refreshActiveSessions();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      recordFailedLaunch(
        cli,
        directory,
        activeAgent?.args ?? "",
        message,
        providerId,
      );
      showToast(t("commandCenter.launchFailed"), "error");
      appendAuditEvent({ action: "workspace.launch", outcome: "failed", mode: getExecutionMode(), workspaceId: activeWorkspace?.id, detail: cli.key });
      history.refresh();
    } finally {
      setLaunching(false);
    }
  }, [
    activeAgent,
    activeWorkspace,
    clis.clis,
    history,
    onNavigate,
    refreshActiveSessions,
    t,
  ]);

  const handleReplaySession = useCallback(
    async (session: SessionSummary) => {
      if (session.historyIndex == null) {
        onNavigate("history");
        return;
      }
      const item = history.items[session.historyIndex];
      if (!item?.directory || !item.cliKey) {
        onNavigate("history");
        return;
      }
      const cli = clis.clis.find((entry) => entry.key === item.cliKey) ?? {
        key: item.cliKey,
        name: item.cli || item.cliKey,
      };
      setReplayingId(session.id);
      try {
        await launchCliSession({
          cli,
          directory: item.directory,
          args: item.args,
          historyArgs: item.args,
          providerId: item.providerId,
        });
        showToast(t("commandCenter.replayStarted", { cli: cli.name }), "success");
        history.refresh();
        void refreshActiveSessions();
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        recordFailedLaunch(cli, item.directory, item.args, message, item.providerId);
        showToast(t("commandCenter.replayFailed"), "error");
        history.refresh();
      } finally {
        setReplayingId(null);
      }
    },
    [clis.clis, history, onNavigate, refreshActiveSessions, t],
  );

  const confirmKillSession = useCallback(async () => {
    if (!killTarget?.sessionId) return;
    const target = killTarget;
    setKillTarget(null);
    try {
      await invoke("kill_session", { sessionId: target.sessionId });
      showToast(t("commandCenter.killSuccess", { cli: target.cli }), "success");
      await refreshActiveSessions();
      history.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    }
  }, [history, killTarget, refreshActiveSessions, t]);

  const confirmSaveProjectProfile = useCallback(async () => {
    const directory = activeWorkspace?.directory?.trim();
    if (!directory) return;
    const parsed = parseProjectProfile(profileDraftText);
    if (!parsed.ok) {
      setProfileDraftError(parsed.error);
      return;
    }
    setProfileSaving(true);
    setProfileDraftError(null);
    try {
      await writeProjectProfile(directory, parsed.profile);
      setProfileSummary({
        loading: false,
        present: true,
        error: null,
        profile: parsed.profile,
      });
      showToast(t("commandCenter.profileSaved"), "success");
      setProfileDraftOpen(false);
      appendAuditEvent({ action: "project.profile.write", outcome: "confirmed", mode: getExecutionMode(), workspaceId: activeWorkspace?.id, detail: ".ailauncher.json" });
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
      appendAuditEvent({ action: "project.profile.write", outcome: "failed", mode: getExecutionMode(), workspaceId: activeWorkspace?.id, detail: ".ailauncher.json" });
    } finally {
      setProfileSaving(false);
    }
  }, [activeWorkspace?.directory, profileDraftText, t]);

  const openProfileDraft = useCallback(() => {
    setProfileDraftText(projectProfilePreview);
    setProfileDraftError(null);
    setProfileDraftOpen(true);
  }, [projectProfilePreview]);

  const handleOpenIde = useCallback(async () => {
    const directory = activeWorkspace?.directory?.trim();
    if (!directory) {
      onNavigate("workspace");
      return;
    }
    const installedTool = tools.tools.find((tool) => tools.checks[tool.name]?.installed);
    const customIde = tools.customIdes[0];
    if (!installedTool && !customIde) {
      onNavigate("tools");
      return;
    }
    setLaunchingIde(true);
    try {
      if (installedTool) {
        await invoke<string>("launch_tool", { toolKey: installedTool.key, directory });
        showToast(t("commandCenter.ideStarted", { ide: installedTool.name }), "success");
      } else if (customIde) {
        await invoke<string>("launch_custom_ide", {
          launchCmd: customIde.launchCmd,
          directory,
        });
        showToast(t("commandCenter.ideStarted", { ide: customIde.name }), "success");
      }
      appendAuditEvent({ action: "workspace.ide.open", outcome: "allowed", mode: getExecutionMode(), workspaceId: activeWorkspace?.id, detail: installedTool?.key ?? customIde?.key });
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
      appendAuditEvent({ action: "workspace.ide.open", outcome: "failed", mode: getExecutionMode(), workspaceId: activeWorkspace?.id });
    } finally {
      setLaunchingIde(false);
    }
  }, [
    activeWorkspace?.directory,
    onNavigate,
    t,
    tools.checks,
    tools.customIdes,
    tools.tools,
  ]);

  const requestExecution = useCallback((target: "launch" | "ide") => {
    const mode = getExecutionMode();
    const decision = approvalFor(mode, "execute");
    if (decision === "block") {
      appendAuditEvent({ action: target === "launch" ? "workspace.launch" : "workspace.ide.open", outcome: "blocked", mode, workspaceId: activeWorkspace?.id });
      showToast(t("commandCenter.executionBlocked"), "warning");
      return;
    }
    if (decision === "confirm") {
      setApprovalTarget(target);
      return;
    }
    if (target === "launch") void handleLaunchWorkspace();
    else void handleOpenIde();
  }, [activeWorkspace?.id, handleLaunchWorkspace, handleOpenIde, t]);

  const confirmExecution = useCallback(() => {
    const target = approvalTarget;
    if (!target) return;
    setApprovalTarget(null);
    appendAuditEvent({ action: target === "launch" ? "workspace.launch.approval" : "workspace.ide.open.approval", outcome: "confirmed", mode: getExecutionMode(), workspaceId: activeWorkspace?.id });
    if (target === "launch") void handleLaunchWorkspace();
    else void handleOpenIde();
  }, [activeWorkspace?.id, approvalTarget, handleLaunchWorkspace, handleOpenIde]);

  const handleAction = useCallback(
    (action: CommandCenterAction) => {
      if (action.disabled) return;
      if (action.id === "launch") {
        requestExecution("launch");
        return;
      }
      if (action.id === "setup") {
        if (runbooks.length > 0 || suggestedRunbookIds.length > 0) {
          setShowRunbooks(true);
          return;
        }
        onNavigate("workspace");
        return;
      }
      if (action.id === "ide") {
        requestExecution("ide");
        return;
      }
      onNavigate(action.targetTab);
    },
    [onNavigate, requestExecution, runbooks.length, suggestedRunbookIds.length],
  );

  return (
    <section className={`cd-page cd-command cd-command--${model.state}`} data-state={model.state}>
      <div className="cd-page__head cd-command__head">
        <div className="cd-page__heading">
          <p className="cd-command__eyebrow">{t("commandCenter.eyebrow")}</p>
          <h1 className="cd-page__title">{t("commandCenter.title")}</h1>
          <p className="cd-page__sub">{t("commandCenter.subtitle")}</p>
        </div>
        <div className="cd-command__head-actions">
          <span className={`cd-command__state cd-command__state--${model.state}`}>
            <span aria-hidden />{t(`commandCenter.states.${model.state}`)}
          </span>
          <Button variant="ghost" onClick={() => clis.refresh()}>{t("common.rescan")}</Button>
        </div>
      </div>

      {model.hasWorkspace && <section className="cd-command__hero" aria-label={t("commandCenter.workspacePanel")}>
        <div className="cd-command__workspace">
          <span className="cd-command__label">{t("commandCenter.activeWorkspace")}</span>
          <h2>
            {model.hasWorkspace ? model.workspaceName : t("commandCenter.noActiveWorkspace")}
          </h2>
          <p>
            {model.hasWorkspace ? model.workspaceDirectory : t("commandCenter.pickWorkspace")}
          </p>
        </div>
        <div className="cd-command__hero-side">
          <div className="cd-command__meta">
          <Meta
            label={t("commandCenter.defaultCli")}
            value={model.defaultCliName === "No CLI" ? t("commandCenter.noCli") : model.defaultCliName}
          />
          <Meta
            label={t("commandCenter.provider")}
            value={model.providerLabel === "Default" ? t("commandCenter.defaultProvider") : model.providerLabel}
          />
          <Meta
            label={t("commandCenter.agentProfile")}
            value={activeAgent?.name ?? t("commandCenter.defaultAgent")}
          />
          <Meta
            label={t("commandCenter.workspaces")}
            value={t("commandCenter.workspaceCount", { count: model.workspaceCount })}
          />
          </div>
          <Button size="lg" loading={launching} onClick={() => requestExecution("launch")}>
            {launching ? t("commandCenter.actionLaunching") : t("commandCenter.actionLaunch")}
          </Button>
        </div>
      </section>}

      {!model.hasWorkspace && (
        <div className="cd-command__onboarding">
          <EmptyState art={ART_TERMINAL} title={t("commandCenter.emptyTitle")}
            description={t("commandCenter.emptyDesc")}
            actions={[
              { label: t("commandCenter.actionWorkspace"), onClick: () => onNavigate("workspace") },
              { label: t("commandCenter.actionDoctor"), onClick: () => onNavigate("doctor") },
            ]} />
          <ol className="cd-command__steps" aria-label={t("commandCenter.onboardingSteps")}>
            <li><span>01</span><strong>{t("commandCenter.stepChoose")}</strong></li>
            <li><span>02</span><strong>{t("commandCenter.stepReview")}</strong></li>
            <li><span>03</span><strong>{t("commandCenter.stepLaunch")}</strong></li>
          </ol>
        </div>
      )}

      {showRunbooks && (
        <div className="cd-command__runbooks">
          <RunbooksPanel
            cwd={activeWorkspace?.directory}
            workspaceId={activeWorkspace?.id}
            onNavigate={onNavigate}
            suggestedPresetIds={suggestedRunbookIds}
            onRunbooksChanged={() => setRunbooksVersion((value) => value + 1)}
            onClose={() => setShowRunbooks(false)}
          />
        </div>
      )}

      {model.hasWorkspace && <div className="cd-command__grid">
        <section className="cd-command__panel cd-command__panel--actions">
          <div className="cd-command__section-head">
            <h2>{t("commandCenter.nextActions")}</h2>
            <p>{t("commandCenter.nextActionsHint")}</p>
          </div>
          <div className="cd-command__actions">
            {model.actions.filter((action) => action.id !== "launch").map((action) => (
              <button
                key={action.id}
                type="button"
                className={`cd-command__action${action.primary ? " cd-command__action--primary" : ""}`}
                disabled={
                  action.disabled ||
                  (launching && action.id === "launch") ||
                  (launchingIde && action.id === "ide")
                }
                onClick={() => handleAction(action)}
              >
                <span>
                  {launching && action.id === "launch"
                    ? t("commandCenter.actionLaunching")
                    : launchingIde && action.id === "ide"
                      ? t("commandCenter.actionIdeLaunching")
                    : t(action.labelKey)}
                </span>
                <small>{t(action.descriptionKey)}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="cd-command__panel">
          <div className="cd-command__section-head">
            <h2>{t("commandCenter.readiness")}</h2>
            <p>{t("commandCenter.readinessHint")}</p>
          </div>
          <div className="cd-command__readiness">
            {model.readiness.filter((card) => card.id !== "workspace").map((card) => (
              <Readiness key={card.id} card={card} onNavigate={onNavigate} />
            ))}
          </div>
        </section>

        <section className="cd-command__panel cd-command__panel--intelligence">
          <div className="cd-command__section-head">
            <h2>{t("commandCenter.projectIntel")}</h2>
            <p>{t("commandCenter.projectIntelHint")}</p>
          </div>
          <ProjectIntelligence
            stack={projectStack}
            projectMcp={{
              loading: projectMcpHealth.loading,
              error: projectMcpHealth.error,
              resolution: projectMcpResolution,
              summary: projectMcpSummary,
            }}
            canCreateProfile={Boolean(projectProfileDraft)}
            profileExists={profileSummary.present}
            onCreateProfile={openProfileDraft}
          />
        </section>

        <section className="cd-command__panel cd-command__panel--sessions">
          <div className="cd-command__section-head">
            <h2>{t("commandCenter.sessions")}</h2>
            <p>{t("commandCenter.sessionsHint")}</p>
          </div>
          {model.recentSessions.length === 0 ? (
            <p className="cd-command__muted">{t("commandCenter.noSessions")}</p>
          ) : (
            <ul className="cd-command__sessions">
              {model.recentSessions.map((session) => (
                <li key={session.id}>
                  <span className={`cd-command__dot cd-command__dot--${session.status}`} />
                  <span className="cd-command__session-main">
                    <strong>{session.cli}</strong>
                    <small>{session.directory || t("commandCenter.noDirectory")}</small>
                  </span>
                  <span className="cd-command__session-time">{session.when}</span>
                  <span className="cd-command__session-actions">
                    {session.killable ? (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setKillTarget(session)}
                      >
                        {t("commandCenter.kill")}
                      </Button>
                    ) : session.source === "history" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={replayingId === session.id}
                        onClick={() => void handleReplaySession(session)}
                      >
                        {t("commandCenter.replay")}
                      </Button>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Button variant="ghost" size="sm" onClick={() => onNavigate("history")}>
            {t("commandCenter.openHistory")}
          </Button>
        </section>
      </div>}

      {killTarget && (
        <ConfirmDialog
          open={Boolean(killTarget)}
          title={t("commandCenter.killTitle")}
          message={t("commandCenter.killMessage", { cli: killTarget.cli })}
          confirmLabel={t("commandCenter.kill")}
          variant="danger"
          onConfirm={confirmKillSession}
          onCancel={() => setKillTarget(null)}
        />
      )}

      {approvalTarget && (
        <ConfirmDialog
          open
          title={t("commandCenter.executionApprovalTitle")}
          message={t(approvalTarget === "launch" ? "commandCenter.executionApprovalLaunch" : "commandCenter.executionApprovalIde")}
          confirmLabel={t("common.confirm")}
          onConfirm={confirmExecution}
          onCancel={() => setApprovalTarget(null)}
        />
      )}

      {profileDraftOpen && projectProfileDraft && (
        <ConfirmDialog
          open={profileDraftOpen}
          title={t(
            profileSummary.present
              ? "commandCenter.profileUpdateTitle"
              : "commandCenter.profileCreateTitle",
          )}
          message={t("commandCenter.profileCreateMessage")}
          confirmLabel={
            profileSaving
              ? t("common.loading")
              : t(profileSummary.present ? "common.save" : "commandCenter.profileCreate")
          }
          onConfirm={() => void confirmSaveProjectProfile()}
          onCancel={() => {
            if (!profileSaving) setProfileDraftOpen(false);
          }}
        >
          <div className="cd-command__affected-file">
            <span>{t("commandCenter.affectedFile")}</span>
            <code>.ailauncher.json</code>
          </div>
          <textarea
            className="cd-command__profile-editor"
            value={profileDraftText}
            onChange={(event) => {
              setProfileDraftText(event.target.value);
              setProfileDraftError(null);
            }}
            aria-label={t("commandCenter.profileEditorLabel")}
            spellCheck={false}
          />
          {profileDraftError && <p className="cd-command__profile-error" role="alert">{profileDraftError}</p>}
        </ConfirmDialog>
      )}
    </section>
  );
}

function ProjectIntelligence({
  stack,
  projectMcp,
  canCreateProfile,
  profileExists,
  onCreateProfile,
}: {
  stack: { loading: boolean; error: string | null; scan: ProjectStackScan | null };
  projectMcp: {
    loading: boolean;
    error: string | null;
    resolution: ProjectMcpResolution;
    summary: ProjectMcpHealthSummary;
  };
  canCreateProfile: boolean;
  profileExists: boolean;
  onCreateProfile: () => void;
}) {
  const { t } = useTranslation();
  const primary = stack.scan?.primary;
  if (stack.loading) {
    return <p className="cd-command__muted">{t("commandCenter.projectIntelScanning")}</p>;
  }
  if (stack.error) {
    return <p className="cd-command__muted">{t("commandCenter.projectIntelError")}</p>;
  }
  if (!primary) {
    return (
      <div className="cd-command__intel">
        <p className="cd-command__muted">{t("commandCenter.projectIntelEmpty")}</p>
        <ProjectMcpStatus projectMcp={projectMcp} />
        {canCreateProfile && (
          <Button size="sm" variant="primary" onClick={onCreateProfile}>
            {t(profileExists ? "commandCenter.profileUpdate" : "commandCenter.profileCreate")}
          </Button>
        )}
      </div>
    );
  }
  return (
    <div className="cd-command__intel">
      <div className="cd-command__intel-main">
        <span>{t("commandCenter.projectIntelPrimary")}</span>
        <strong>{primary.label}</strong>
        <small>{t(`commandCenter.stackConfidence.${primary.confidence}`)}</small>
      </div>
      <div className="cd-command__chips" aria-label={t("commandCenter.projectIntelEvidence")}>
        {primary.evidence.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
      <dl className="cd-command__intel-hints">
        <div>
          <dt>{t("commandCenter.projectIntelCli")}</dt>
          <dd>{stack.scan?.profileHints.cli ?? t("commandCenter.none")}</dd>
        </div>
        <div>
          <dt>{t("commandCenter.projectIntelRunbook")}</dt>
          <dd>{stack.scan?.profileHints.runbook ?? t("commandCenter.none")}</dd>
        </div>
      </dl>
      <div className="cd-command__chips cd-command__chips--muted">
        {stack.scan?.profileHints.tags.slice(0, 5).map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <ProjectMcpStatus projectMcp={projectMcp} />
      {canCreateProfile && (
        <Button size="sm" variant="primary" onClick={onCreateProfile}>
          {t(profileExists ? "commandCenter.profileUpdate" : "commandCenter.profileCreate")}
        </Button>
      )}
    </div>
  );
}

function ProjectMcpStatus({
  projectMcp,
}: {
  projectMcp: {
    loading: boolean;
    error: string | null;
    resolution: ProjectMcpResolution;
    summary: ProjectMcpHealthSummary;
  };
}) {
  const { t } = useTranslation();
  const { resolution, summary } = projectMcp;
  if (summary.expected === 0) {
    return <p className="cd-command__muted">{t("commandCenter.projectMcpNone")}</p>;
  }

  const detailKey = projectMcp.error
    ? "commandCenter.projectMcpError"
    : projectMcp.loading
      ? "commandCenter.projectMcpLoading"
      : summary.status === "ok"
        ? "commandCenter.projectMcpOk"
        : summary.status === "unknown"
          ? "commandCenter.projectMcpUnknown"
          : "commandCenter.projectMcpWarn";

  return (
    <div className={`cd-command__project-mcp cd-command__project-mcp--${summary.status}`}>
      <div className="cd-command__project-mcp-main">
        <span>{t("commandCenter.projectMcpTitle")}</span>
        <strong>
          {summary.matched}/{summary.expected}
        </strong>
        <small>
          {t(detailKey, {
            enabled: summary.enabled,
            expected: summary.expected,
            healthy: summary.healthy,
            matched: summary.matched,
            missing: summary.missing,
            unhealthy: summary.unhealthy,
            unknown: summary.unknown,
          })}
        </small>
      </div>
      <div className="cd-command__chips cd-command__chips--muted">
        {resolution.expectedIds.slice(0, 6).map((id) => (
          <span key={id}>{id}</span>
        ))}
      </div>
      {resolution.missing.length > 0 && (
        <div className="cd-command__chips cd-command__chips--danger">
          {resolution.missing.slice(0, 4).map((id) => (
            <span key={id}>{t("commandCenter.projectMcpMissing", { id })}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="cd-command__meta-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Readiness({
  card,
  onNavigate,
}: {
  card: ReadinessCard;
  onNavigate: (tab: TabId) => void;
}) {
  const { t } = useTranslation();
  const value =
    card.value === "None"
      ? t("commandCenter.none")
      : card.value === "Ready"
        ? t("commandCenter.ready")
        : card.value === "Draft"
          ? t("commandCenter.draft")
          : card.value === "Error"
            ? t("commandCenter.error")
            : card.value;
  return (
    <Card
      interactive
      className={`cd-command__ready cd-command__ready--${card.tone}`}
      onClick={() => onNavigate(card.targetTab)}
    >
      <span className="cd-command__ready-label">{t(card.labelKey)}</span>
      <strong>{value}</strong>
      <small>{t(card.detailKey, card.detailParams)}</small>
    </Card>
  );
}
