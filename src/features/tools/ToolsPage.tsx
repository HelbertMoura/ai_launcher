import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Banner } from "../../ui/Banner";
import { Skeleton } from "../../ui/Skeleton";
import { ToolCard } from "./ToolCard";
import { useTools, type ToolInfo } from "./useTools";
import "../page.css";
import "./ToolsPage.css";

export function ToolsPage() {
  const { tools, checks, loading, error, refresh } = useTools();
  const [installing, setInstalling] = useState<string | null>(null);
  const [launching, setLaunching] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const onLaunch = async (tool: ToolInfo) => {
    setLaunching(tool.key);
    setActionError(null);
    try {
      await invoke<string>("launch_tool", { toolKey: tool.key });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setLaunching(null);
    }
  };

  const onInstall = async (tool: ToolInfo) => {
    setInstalling(tool.key);
    setActionError(null);
    try {
      if (tool.install_url) {
        await invoke<string>("open_external_url", { url: tool.install_url });
      } else {
        await invoke<string>("install_tool", { toolKey: tool.key });
        await refresh();
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setInstalling(null);
    }
  };

  const installedCount = Object.values(checks).filter((c) => c.installed).length;

  return (
    <section className="cd-page cd-tools">
      <header className="cd-page__head">
        <div className="cd-page__heading">
          <h2 className="cd-page__title">▎ TOOLS</h2>
          <p className="cd-page__sub">
            {loading ? "scanning…" : `${installedCount}/${tools.length} installed`}
          </p>
        </div>
      </header>

      {error && <Banner variant="err">{error}</Banner>}
      {actionError && <Banner variant="err">{actionError}</Banner>}

      {loading && (
        <div className="cd-page__grid">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="card" height={92} />
          ))}
        </div>
      )}

      {!loading && tools.length === 0 && (
        <div className="cd-page__empty">No tools registered.</div>
      )}

      {!loading && tools.length > 0 && (
        <div className="cd-page__grid">
          {tools.map((tool) => (
            <ToolCard
              key={tool.key}
              tool={tool}
              check={checks[tool.name]}
              installing={installing === tool.key}
              launching={launching === tool.key}
              onLaunch={onLaunch}
              onInstall={onInstall}
            />
          ))}
        </div>
      )}
    </section>
  );
}
