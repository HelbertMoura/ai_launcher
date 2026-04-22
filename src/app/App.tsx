import { useState } from "react";
import pkg from "../../package.json";
import { useAccent } from "../hooks/useAccent";
import { useTheme } from "../hooks/useTheme";
import { LauncherPage } from "../features/launcher/LauncherPage";
import { ToolsPage } from "../features/tools/ToolsPage";
import { HistoryPage } from "../features/history/HistoryPage";
import { CostsPage } from "../features/costs/CostsPage";
import { HelpPage } from "../features/help/HelpPage";
import { OnboardingPage } from "../features/onboarding/OnboardingPage";
import { Sidebar } from "./layout/Sidebar";
import { StatusBar } from "./layout/StatusBar";
import { TopBar } from "./layout/TopBar";
import type { TabId } from "./layout/TabId";
import "./App.css";

const ONBOARDING_KEY = "ai-launcher:onboarding-done";

function readOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === "true";
  } catch {
    return false;
  }
}

export function App() {
  const [active, setActive] = useState<TabId>("launcher");
  const { theme, setTheme } = useTheme();
  const { accent, setAccent } = useAccent();
  const [onboarded, setOnboarded] = useState<boolean>(readOnboarded);

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  if (!onboarded) {
    return (
      <OnboardingPage
        onFinish={() => {
          try {
            localStorage.setItem(ONBOARDING_KEY, "true");
          } catch {
            /* ignore storage errors */
          }
          setOnboarded(true);
        }}
      />
    );
  }

  return (
    <div className="cd-app">
      <div className="cd-app__side">
        <Sidebar active={active} onSelect={setActive} version={pkg.version} />
      </div>
      <div className="cd-app__top">
        <TopBar
          onCommand={() => {
            /* wired in Phase 7 */
          }}
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
        {active === "help" && <HelpPage />}
        {active === "admin" && <Placeholder tab={active} />}
      </main>
      <div className="cd-app__status">
        <StatusBar online={0} total={0} todaySpend="$0.00" version={pkg.version} />
      </div>
    </div>
  );
}

function Placeholder({ tab }: { tab: TabId }) {
  return (
    <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
      <h2 style={{ margin: 0, color: "var(--text)" }}>▎ {tab.toUpperCase()}</h2>
      <p>Feature page wiring arrives in Phase 6B.</p>
    </div>
  );
}
