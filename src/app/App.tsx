import { useCallback, useEffect, useMemo, useState } from "react";
import pkg from "../../package.json";
import { useAccent } from "../hooks/useAccent";
import { useTheme } from "../hooks/useTheme";
import { LauncherPage } from "../features/launcher/LauncherPage";
import { ToolsPage } from "../features/tools/ToolsPage";
import { HistoryPage } from "../features/history/HistoryPage";
import { CostsPage } from "../features/costs/CostsPage";
import { PrereqsPage } from "../features/prereqs/PrereqsPage";
import { HelpPage } from "../features/help/HelpPage";
import { UpdatesPage } from "../features/updates/UpdatesPage";
import { AdminPage } from "../features/admin/AdminPage";
import { OnboardingPage } from "../features/onboarding/OnboardingPage";
import { Sidebar } from "./layout/Sidebar";
import { StatusBar } from "./layout/StatusBar";
import { TopBar } from "./layout/TopBar";
import type { TabId } from "./layout/TabId";
import { CommandPalette } from "../features/command-palette/CommandPalette";
import { useCommandPalette } from "../features/command-palette/useCommandPalette";
import { markOnboarded, readOnboarded } from "./onboarding";
import { clisStore } from "../features/launcher/clisStore";
import { useUsage } from "../features/costs/useUsage";
import { useUpdates } from "../hooks/useUpdates";
import { ErrorBoundary } from "../components/ErrorBoundary";
import "./App.css";

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform);

const DIGIT_TABS: Record<string, TabId> = {
  "1": "launcher",
  "2": "tools",
  "3": "history",
  "4": "costs",
  "5": "prereqs",
  "6": "updates",
};

export function App() {
  const [active, setActive] = useState<TabId>("launcher");
  const { theme, setTheme } = useTheme();
  const { accent, setAccent } = useAccent();
  const [onboarded, setOnboarded] = useState<boolean>(readOnboarded);
  const palette = useCommandPalette();

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

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
        <div className="cd-app__side">
          <Sidebar active={active} onSelect={setActive} version={pkg.version} />
        </div>
        <div className="cd-app__top">
          <TopBar
            onCommand={palette.openPalette}
            theme={theme}
            onToggleTheme={toggleTheme}
            accent={accent}
            onAccent={setAccent}
          />
        </div>
        <main className="cd-app__main">
          {active === "launcher" && <LauncherPage />}
          {active === "tools" && <ToolsPage />}
          {active === "history" && <HistoryPage />}
          {active === "costs" && <CostsPage />}
          {active === "updates" && <UpdatesPage />}
          {active === "prereqs" && <PrereqsPage />}
          {active === "help" && <HelpPage />}
          {active === "admin" && <AdminPage />}
        </main>
        <div className="cd-app__status">
          <StatusBarConnector version={pkg.version} />
        </div>
        <CommandPalette
          open={palette.open}
          onClose={palette.closePalette}
          onNavigate={(tab) => setActive(tab)}
          theme={theme}
          onToggleTheme={toggleTheme}
          onSetAccent={setAccent}
        />
      </div>
    </ErrorBoundary>
  );
}

function StatusBarConnector({ version }: { version: string }) {
  const snapshot = clisStore.getSnapshot();
  const { report } = useUsage();
  const { summary: updates, refresh: refreshUpdates } = useUpdates();

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

  const updatesCount = updates?.total_with_updates ?? 0;

  const handleRefresh = useCallback(() => {
    void clisStore.refresh();
    void refreshUpdates();
  }, [refreshUpdates]);

  return (
    <StatusBar
      online={online}
      total={total}
      todaySpend={todaySpend}
      version={version}
      updatesCount={updatesCount}
      onRefresh={handleRefresh}
    />
  );
}
