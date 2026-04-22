import { useState } from "react";
import pkg from "../../package.json";
import { useAccent } from "../hooks/useAccent";
import { useTheme } from "../hooks/useTheme";
import { Sidebar } from "./layout/Sidebar";
import { StatusBar } from "./layout/StatusBar";
import { TopBar } from "./layout/TopBar";
import type { TabId } from "./layout/TabId";
import "./App.css";

export function App() {
  const [active, setActive] = useState<TabId>("launcher");
  const { theme, setTheme } = useTheme();
  const { accent, setAccent } = useAccent();

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

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
        <Placeholder tab={active} />
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
      <p>Feature page wiring arrives in Phase 6.</p>
    </div>
  );
}
