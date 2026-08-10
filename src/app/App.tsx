import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import pkg from "../../package.json";
import { ACCENTS, useAccent, type Accent } from "../hooks/useAccent";
import { useDensity } from "../hooks/useDensity";
import { useTheme } from "../hooks/useTheme";
import { useHistory } from "../features/history/useHistory";
import { useSessionEvents } from "../features/history/useSessionEvents";
import { Sidebar, type SidebarIndicatorMap } from "./layout/Sidebar";
import {
  StatusBar,
  type LastSessionInfo,
  type ProviderLatency,
} from "./layout/StatusBar";
import { TopBar } from "./layout/TopBar";
import type { TabId } from "./layout/TabId";
import { CommandPalette } from "../features/command-palette/CommandPalette";
import { useCommandPalette } from "../features/command-palette/useCommandPalette";
import { markOnboarded, readOnboarded } from "./onboarding";
import { clisStore } from "../features/launcher/clisStore";
import { useClis } from "../features/launcher/useClis";
import { useUsage } from "../features/costs/useUsage";
import { useUpdates } from "../hooks/useUpdates";
import { useSidebarIndicators } from "../hooks/useSidebarIndicators";
import { ErrorBoundary } from "../ui/ErrorBoundary";
import { ToastContainer } from "../ui/Toast";
import { showToast } from "../ui/toastStore";
import { migrateApiKeysToSecureStorage } from "../providers/storage";
import { getBudgetAlerts } from "../providers/budget";
import { pushEvent } from "../features/inbox/inboxStore";
import type { UsageReport } from "../features/costs/useUsage";
import { invokeOrFallback } from "../lib/tauri";
import { useTranslation } from "react-i18next";
import "./App.css";
import { migrateStorage } from "../lib/storage/migrations";
import { useGlobalShortcuts } from "./shortcuts";
import {
  computeLastSession,
  computeProviderLatency,
  readHistoryItems,
} from "./sessionInfo";
import { EXECUTION_MODE_CHANGED_EVENT, getExecutionMode, type ExecutionMode } from "../domain/executionMode";

const CommandCenterPage = lazy(() =>
  import("../features/command-center/CommandCenterPage").then((m) => ({ default: m.CommandCenterPage })),
);
const LauncherPage = lazy(() =>
  import("../features/launcher/LauncherPage").then((m) => ({ default: m.LauncherPage })),
);
const ToolsPage = lazy(() =>
  import("../features/tools/ToolsPage").then((m) => ({ default: m.ToolsPage })),
);
const McpPage = lazy(() =>
  import("../features/mcp/McpPage").then((m) => ({ default: m.McpPage })),
);
const HistoryPage = lazy(() =>
  import("../features/history/HistoryPage").then((m) => ({ default: m.HistoryPage })),
);
const CostsPage = lazy(() =>
  import("../features/costs/CostsPage").then((m) => ({ default: m.CostsPage })),
);
const WorkspacePage = lazy(() =>
  import("../features/workspace/WorkspacePage").then((m) => ({ default: m.WorkspacePage })),
);
const DoctorPage = lazy(() =>
  import("../features/workspace/DoctorPage").then((m) => ({ default: m.DoctorPage })),
);
const PrereqsPage = lazy(() =>
  import("../features/prereqs/PrereqsPage").then((m) => ({ default: m.PrereqsPage })),
);
const HelpPage = lazy(() =>
  import("../features/help/HelpPage").then((m) => ({ default: m.HelpPage })),
);
const UpdatesPage = lazy(() =>
  import("../features/updates/UpdatesPage").then((m) => ({ default: m.UpdatesPage })),
);
const AdminPage = lazy(() =>
  import("../features/admin/AdminPage").then((m) => ({ default: m.AdminPage })),
);
const OnboardingPage = lazy(() =>
  import("../features/onboarding/OnboardingPage").then((m) => ({ default: m.OnboardingPage })),
);

export function App() {
  const { t } = useTranslation();
  const [active, setActive] = useState<TabId>("command-center");
  const [navCollapsed, setNavCollapsed] = useState(false);
  const { theme, setTheme, cycleTheme } = useTheme();
  const { accent, setAccent } = useAccent();
  const { density, toggleDensity } = useDensity();
  const [onboarded, setOnboarded] = useState<boolean>(readOnboarded);
  const palette = useCommandPalette();
  const history = useHistory();
  const { refresh: refreshUpdates } = useUpdates();

  useEffect(() => {
    const result = migrateStorage();
    if (!result.ok) showToast(`Storage migration failed: ${result.error ?? "unknown error"}`, "error");
  }, []);

  // Register a single global listener for backend `session-ended` events.
  // This activates the session-lifecycle history updates (formerly dead code).
  useSessionEvents();

  // Theme toggle cycles through: dark → light → amber → glacier → dark
  const toggleTheme = () => cycleTheme();

  // Cycle accent through the preset list (custom is skipped).
  const cycleAccent = useCallback(() => {
    const list: Accent[] = ACCENTS;
    const idx = list.indexOf(accent);
    const next = list[(idx === -1 ? 0 : idx + 1) % list.length];
    setAccent(next);
  }, [accent, setAccent]);

  const handleCheckUpdates = useCallback(() => {
    setActive("updates");
    void refreshUpdates();
  }, [refreshUpdates]);

  // One-time migration of API keys to secure storage (runs in background).
  // The effect intentionally depends on nothing: re-running it on every
  // locale change used to retrigger migration (and spam the inbox) because
  // `t` was a dep. The toast key is captured via a ref so a future locale
  // switch still uses the right translation.
  const credentialMigrationFailedKeyRef = useRef(t("security.credentialMigrationFailed"));
  useEffect(() => {
    credentialMigrationFailedKeyRef.current = t("security.credentialMigrationFailed");
  }, [t]);
  useEffect(() => {
    let cancelled = false;
    migrateApiKeysToSecureStorage().catch(() => {
      if (cancelled) return;
      // Source values remain untouched until a secure write is verified.
      showToast(credentialMigrationFailedKeyRef.current, "error");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // On boot, check configured budget limits and surface a toast if any
  // provider is at/over its alert threshold (>= alertAtPercent, default 80%).
  // Badge in the TopBar is intentionally out of scope for this batch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const report = await invokeOrFallback<UsageReport>(
          "read_usage_stats",
          undefined,
          { entries: [] },
        );
        if (cancelled) return;
        const alerts = getBudgetAlerts(report.entries ?? []);
        if (alerts.length === 0) return;
        const month = new Date().toISOString().slice(0, 7);
        for (const a of alerts) {
          pushEvent({
            id: `budget:${a.providerKey}:${month}`,
            type: "budget",
            titleKey: "inbox.budgetTitle",
            titleParams: { provider: a.providerKey },
            bodyKey: a.status === "exceeded" ? "inbox.budgetExceeded" : "inbox.budgetWarning",
            bodyParams: { percent: Math.round(a.percentUsed) },
            targetTab: "costs",
          });
        }
        const exceeded = alerts.filter((a) => a.status === "exceeded").length;
        const variant = exceeded > 0 ? "error" : "warning";
        const message =
          exceeded > 0
            ? `${exceeded} budget limit(s) exceeded`
            : `${alerts.length} budget alert(s) near limit`;
        showToast(message, variant);
      } catch {
        // Budget check is best-effort; failures must not block boot.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useGlobalShortcuts(setActive);

  if (!onboarded) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<FullScreenFallback />}>
          <OnboardingPage
            onFinish={() => {
              markOnboarded();
              setOnboarded(true);
            }}
          />
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className={`cd-app${navCollapsed ? " cd-app--nav-collapsed" : ""}`}>
        <ChromeConnector
          active={active}
          onSelect={setActive}
          theme={theme}
          onToggleTheme={toggleTheme}
          accent={accent}
          onAccent={setAccent}
          density={density}
          onToggleDensity={toggleDensity}
          openPalette={palette.openPalette}
          navCollapsed={navCollapsed}
          onToggleNav={() => setNavCollapsed((value) => !value)}
        />
        <main className="cd-app__main">
          <Suspense fallback={<PageFallback />}>
            {active === "command-center" && <CommandCenterPage onNavigate={setActive} />}
            {active === "launcher" && <LauncherPage onNavigate={setActive} />}
            {active === "tools" && <ToolsPage />}
            {active === "mcp" && <McpPage />}
            {active === "history" && <HistoryPage />}
            {active === "costs" && <CostsPage />}
            {active === "workspace" && (
              <WorkspacePage historyItems={history.items} onNavigate={setActive} />
            )}
            {active === "doctor" && <DoctorPage />}
            {active === "updates" && <UpdatesPage />}
            {active === "prereqs" && <PrereqsPage />}
            {active === "help" && <HelpPage />}
            {active === "admin" && <AdminPage />}
          </Suspense>
        </main>
        <CommandPalette
          open={palette.open}
          onClose={palette.closePalette}
          onNavigate={(tab) => setActive(tab)}
          theme={theme}
          onToggleTheme={toggleTheme}
          onSetTheme={setTheme}
          accent={accent}
          onSetAccent={setAccent}
          onCycleAccent={cycleAccent}
          recentSessions={history.items.slice(0, 5)}
          onRelaunchSession={() => setActive("history")}
          onCheckUpdates={handleCheckUpdates}
        />
        <ToastContainer />
      </div>
    </ErrorBoundary>
  );
}

function PageFallback() {
  return (
    <section className="cd-page cd-page--loading">
      <div className="cd-page__head">
        <div className="cd-page__heading">
          <h1 className="cd-page__title">▎ Loading</h1>
          <p className="cd-page__sub">preparing module…</p>
        </div>
      </div>
    </section>
  );
}

function FullScreenFallback() {
  return <div className="cd-app__fallback">Loading…</div>;
}

interface ChromeConnectorProps {
  active: TabId;
  onSelect: (id: TabId) => void;
  theme: ReturnType<typeof useTheme>["theme"];
  onToggleTheme: () => void;
  accent: ReturnType<typeof useAccent>["accent"];
  onAccent: (a: ReturnType<typeof useAccent>["accent"]) => void;
  density: ReturnType<typeof useDensity>["density"];
  onToggleDensity: () => void;
  openPalette: () => void;
  navCollapsed: boolean;
  onToggleNav: () => void;
}

function ChromeConnector({
  active,
  onSelect,
  theme,
  onToggleTheme,
  accent,
  onAccent,
  density,
  onToggleDensity,
  openPalette,
  navCollapsed,
  onToggleNav,
}: ChromeConnectorProps) {
  // Subscribe to the CLI store so the StatusBar re-renders when checks load.
  // useClis() subscribes via useSyncExternalStore AND triggers ensureLoaded,
  // so the bar populates on boot instead of staying stuck at "0/0" until an
  // unrelated re-render happened to pick up the updated store.
  const snapshot = useClis();
  const { report } = useUsage();
  const { summary: updates, refresh: refreshUpdates } = useUpdates();
  const [refreshTick, setRefreshTick] = useState(0);
  const [executionMode, setExecutionModeState] = useState<ExecutionMode>(getExecutionMode);

  useEffect(() => {
    const refreshMode = () => setExecutionModeState(getExecutionMode());
    window.addEventListener(EXECUTION_MODE_CHANGED_EVENT, refreshMode);
    const timer = window.setInterval(refreshMode, 30_000);
    return () => {
      window.removeEventListener(EXECUTION_MODE_CHANGED_EVENT, refreshMode);
      window.clearInterval(timer);
    };
  }, []);

  // Surface available CLI/tool updates in the inbox. The stable id
  // (update:<cli>:<version>) dedups across boots; identical re-pushes keep
  // their read state, so an ignored update doesn't re-unread every launch.
  useEffect(() => {
    if (!updates) return;
    const all = [
      ...(updates.cli_updates ?? []),
      ...(updates.env_updates ?? []),
      ...(updates.tool_updates ?? []),
    ];
    for (const u of all) {
      if (!u.has_update || !u.latest) continue;
      pushEvent({
        id: `update:${u.cli}:${u.latest}`,
        type: "update",
        titleKey: "inbox.updateTitle",
        titleParams: { cli: u.cli, version: u.latest },
        targetTab: "updates",
      });
    }
  }, [updates]);

  const indicatorCounts = useSidebarIndicators(report, refreshTick);
  const updatesCount = updates?.total_with_updates ?? 0;

  const indicators = useMemo<SidebarIndicatorMap>(() => {
    const map: SidebarIndicatorMap = {};
    if (indicatorCounts.historyToday > 0) {
      map.history = {
        value: String(indicatorCounts.historyToday),
        tone: "neutral",
      };
    }
    if (indicatorCounts.todaySpend) {
      map.costs = { value: indicatorCounts.todaySpend, tone: "neutral" };
    }
    if (indicatorCounts.pinnedWorkspaces > 0) {
      map.workspace = {
        value: String(indicatorCounts.pinnedWorkspaces),
        tone: "neutral",
      };
    }
    if (updatesCount > 0) {
      map.updates = { value: `● ${updatesCount}`, tone: "accent" };
    }
    return map;
  }, [indicatorCounts, updatesCount]);

  const online = useMemo(() => {
    if (!snapshot.checks) return 0;
    return Object.values(snapshot.checks).filter((c) => c.installed).length;
  }, [snapshot.checks]);

  const total = snapshot.clis.length;

  const todaySpend = useMemo(() => {
    if (!report?.entries?.length) return "$0.00";
    const today = new Date().toISOString().slice(0, 10);
    const sum = report.entries
      .filter((e) => e.date === today)
      .reduce((acc, e) => acc + e.cost_estimate_usd, 0);
    return `$${sum.toFixed(2)}`;
  }, [report]);

  const lastSession = useMemo<LastSessionInfo | undefined>(() => {
    void refreshTick;
    return computeLastSession(readHistoryItems());
  }, [refreshTick]);

  const providerLatency = useMemo<ProviderLatency | undefined>(() => {
    void refreshTick;
    return computeProviderLatency();
  }, [refreshTick]);

  const handleRefresh = useCallback(() => {
    void clisStore.refresh();
    void refreshUpdates();
    setRefreshTick((t) => t + 1);
  }, [refreshUpdates]);

  return (
    <>
      <div className="cd-app__side">
        <Sidebar
          active={active}
          onSelect={onSelect}
          version={pkg.version}
          indicators={indicators}
          collapsed={navCollapsed}
          onToggleCollapsed={onToggleNav}
          executionMode={executionMode}
        />
      </div>
      <div className="cd-app__top">
        <TopBar
          onCommand={openPalette}
          onNavigate={onSelect}
          theme={theme}
          onToggleTheme={onToggleTheme}
          accent={accent}
          onAccent={onAccent}
          density={density}
          onToggleDensity={onToggleDensity}
        />
      </div>
      <div className="cd-app__status">
        <StatusBar
          online={online}
          total={total}
          todaySpend={todaySpend}
          version={pkg.version}
          updatesCount={updatesCount}
          lastSession={lastSession}
          providerLatency={providerLatency}
          executionMode={executionMode}
          onRefresh={handleRefresh}
        />
      </div>
    </>
  );
}
