import { useCallback, useEffect, useMemo, useState } from "react";
import pkg from "../../package.json";
import { ACCENTS, useAccent, type Accent } from "../hooks/useAccent";
import { useDensity } from "../hooks/useDensity";
import { useTheme } from "../hooks/useTheme";
import { useHistory } from "../features/history/useHistory";
import { LauncherPage } from "../features/launcher/LauncherPage";
import { ToolsPage } from "../features/tools/ToolsPage";
import { HistoryPage } from "../features/history/HistoryPage";
import { CostsPage } from "../features/costs/CostsPage";
import { WorkspacePage } from "../features/workspace/WorkspacePage";
import { DoctorPage } from "../features/workspace/DoctorPage";
import { PrereqsPage } from "../features/prereqs/PrereqsPage";
import { HelpPage } from "../features/help/HelpPage";
import { UpdatesPage } from "../features/updates/UpdatesPage";
import { AdminPage } from "../features/admin/AdminPage";
import { OnboardingPage } from "../features/onboarding/OnboardingPage";
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
import { useUsage } from "../features/costs/useUsage";
import { useUpdates } from "../hooks/useUpdates";
import { useSidebarIndicators } from "../hooks/useSidebarIndicators";
import { loadProviders } from "../providers/storage";
import type { HistoryItem } from "../features/history/useHistory";
import { ErrorBoundary } from "../ui/ErrorBoundary";
import { ToastContainer } from "../ui/Toast";
import { migrateApiKeysToSecureStorage } from "../providers/storage";
import "./App.css";

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform);

const DIGIT_TABS: Record<string, TabId> = {
  "1": "launcher",
  "2": "tools",
  "3": "history",
  "4": "costs",
  "5": "workspace",
  "6": "doctor",
  "7": "updates",
  "8": "prereqs",
};

export function App() {
  const [active, setActive] = useState<TabId>("launcher");
  const { theme, setTheme, cycleTheme } = useTheme();
  const { accent, setAccent } = useAccent();
  const { density, toggleDensity } = useDensity();
  const [onboarded, setOnboarded] = useState<boolean>(readOnboarded);
  const palette = useCommandPalette();
  const history = useHistory();
  const { refresh: refreshUpdates } = useUpdates();

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
  useEffect(() => {
    migrateApiKeysToSecureStorage().catch(() => {
      // Migration failure is non-critical; keys stay in localStorage.
    });
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setActive("help");
        return;
      }

      if ((IS_MAC ? e.metaKey : e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        setActive("admin");
        return;
      }

      if ((IS_MAC ? e.metaKey : e.ctrlKey) && DIGIT_TABS[e.key]) {
        e.preventDefault();
        setActive(DIGIT_TABS[e.key]);
      }
    },
    [],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!onboarded) {
    return (
      <ErrorBoundary>
        <OnboardingPage
          onFinish={() => {
            markOnboarded();
            setOnboarded(true);
          }}
        />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="cd-app">
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
        />
        <main className="cd-app__main">
          {active === "launcher" && <LauncherPage />}
          {active === "tools" && <ToolsPage />}
          {active === "history" && <HistoryPage />}
          {active === "costs" && <CostsPage />}
          {active === "workspace" && <WorkspacePage onNavigate={setActive} />}
          {active === "doctor" && <DoctorPage />}
          {active === "updates" && <UpdatesPage />}
          {active === "prereqs" && <PrereqsPage />}
          {active === "help" && <HelpPage />}
          {active === "admin" && <AdminPage />}
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

const CONFIG_KEY = "ai-launcher-config";
const DAY_MS = 24 * 60 * 60 * 1000;

function readHistoryItems(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return [];
    const cfg = JSON.parse(raw) as Record<string, unknown>;
    if (!Array.isArray(cfg.history)) return [];
    return cfg.history as HistoryItem[];
  } catch {
    return [];
  }
}

function formatRelative(iso: string | undefined): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const diff = Date.now() - ms;
  if (diff < 0 || diff > DAY_MS) return null;
  if (diff < 60_000) return "just now";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function computeLastSession(items: HistoryItem[]): LastSessionInfo | undefined {
  if (!items.length) return undefined;
  const mostRecent = items.reduce<HistoryItem | null>((best, cur) => {
    const cand = cur.startedAt || cur.timestamp;
    const bestIso = best ? best.startedAt || best.timestamp : undefined;
    if (!cand) return best;
    if (!bestIso) return cur;
    return Date.parse(cand) > Date.parse(bestIso) ? cur : best;
  }, null);
  if (!mostRecent) return undefined;
  const rel = formatRelative(mostRecent.startedAt || mostRecent.timestamp);
  if (!rel) return undefined;
  return { cli: mostRecent.cli || mostRecent.cliKey || "session", relative: rel };
}

interface StoredProviderTest {
  ok?: boolean;
  testedAt?: string;
}

function readProviderTest(providerId: string): StoredProviderTest | null {
  try {
    const raw = localStorage.getItem(`ai-launcher:provider-test:${providerId}`);
    if (!raw) return null;
    return JSON.parse(raw) as StoredProviderTest;
  } catch {
    return null;
  }
}

function computeProviderLatency(): ProviderLatency | undefined {
  try {
    const state = loadProviders();
    const active = state.profiles.find((p) => p.id === state.activeId);
    if (!active) return undefined;
    const test = readProviderTest(active.id);
    if (!test || !test.testedAt) {
      return { name: active.name, tone: "warn" };
    }
    const age = Date.now() - Date.parse(test.testedAt);
    if (Number.isNaN(age)) return { name: active.name, tone: "warn" };
    if (test.ok === false) return { name: active.name, tone: "err" };
    if (age > DAY_MS) return { name: active.name, tone: "warn" };
    return { name: active.name, tone: "ok" };
  } catch {
    return undefined;
  }
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
}: ChromeConnectorProps) {
  const snapshot = clisStore.getSnapshot();
  const { report } = useUsage();
  const { summary: updates, refresh: refreshUpdates } = useUpdates();
  const [refreshTick, setRefreshTick] = useState(0);

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
        />
      </div>
      <div className="cd-app__top">
        <TopBar
          onCommand={openPalette}
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
          onRefresh={handleRefresh}
        />
      </div>
    </>
  );
}
