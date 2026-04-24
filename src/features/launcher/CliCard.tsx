import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { Chip } from "../../ui/Chip";
import { getCliIcon, hasCliIcon } from "../../icons/registry";
import { getRecentDirs, saveLastDir, addRecentDir } from "../history/useHistory";
import { getPinnedDirs } from "./pinnedDirs";
import { appendHistory } from "./history";
import { buildLaunchEnvAsync, loadProviders } from "../../providers/storage";
import { showToast } from "../../ui/toastStore";
import type { CheckResult, CliInfo } from "./useClis";

interface CliCardProps {
  cli: CliInfo;
  check?: CheckResult;
  installing?: boolean;
  hasUpdate?: boolean;
  onLaunch: (cli: CliInfo) => void;
  onInstall: (cli: CliInfo) => void;
}

function truncateEnd(s: string, max = 32): string {
  return s.length <= max ? s : `…${s.slice(s.length - (max - 1))}`;
}

export function CliCard({ cli, check, installing = false, hasUpdate = false, onLaunch, onInstall }: CliCardProps) {
  const { t } = useTranslation();
  const installed = check?.installed ?? false;
  const version = check?.version ?? null;
  const pinnedDirs = useMemo(() => getPinnedDirs(cli.key), [cli.key]);
  const recentDirs = useMemo(
    () => getRecentDirs(cli.key).filter((d) => !pinnedDirs.includes(d)).slice(0, 3),
    [cli.key, pinnedDirs],
  );
  const [quickLaunching, setQuickLaunching] = useState(false);

  const quickLaunch = async (dir: string) => {
    setQuickLaunching(true);
    let envVars: Record<string, string> | undefined;
    let providerId: string | undefined;
    try {
      if (cli.key === "claude") {
        const state = loadProviders();
        envVars = await buildLaunchEnvAsync(state);
        providerId = state.activeId;
      }
      const result = await invoke<{ session_id: string; message: string }>("launch_cli", {
        cliKey: cli.key,
        directory: dir,
        args: "",
        noPerms: true,
        envVars: envVars ?? null,
      });
      const now = new Date().toISOString();
      saveLastDir(cli.key, dir);
      addRecentDir(cli.key, dir);
      appendHistory({
        cli: cli.name,
        cliKey: cli.key,
        directory: dir,
        args: "",
        timestamp: now,
        providerId,
        status: "starting",
        sessionId: result.session_id,
        startedAt: now,
      });
    } catch (e) {
      const now = new Date().toISOString();
      // Launch failed immediately — record as failed
      appendHistory({
        cli: cli.name,
        cliKey: cli.key,
        directory: dir,
        args: "",
        timestamp: now,
        providerId: providerId,
        status: "failed",
        startedAt: now,
        errorMessage: e instanceof Error ? e.message : String(e),
      });
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setQuickLaunching(false);
    }
  };

  return (
    <Card interactive>
      <div className="cd-cli-card__head">
        {hasCliIcon(cli.key) ? (
          <img className="cd-cli-card__icon" src={getCliIcon(cli.key)} alt="" />
        ) : (
          <span className="cd-cli-card__icon cd-cli-card__icon--placeholder" aria-hidden>
            ◆
          </span>
        )}
        <div className="cd-cli-card__meta">
          <div className="cd-cli-card__name">{cli.name}</div>
          <div className="cd-cli-card__cmd">{cli.command}</div>
        </div>
        <Chip variant={installed ? "online" : "missing"} dot>
          {installed ? (version ?? t("common.online")) : t("common.missing")}
        </Chip>
        {hasUpdate && <span className="cd-cli-card__update" title="Update available" aria-label="Update available">&#x2191;</span>}
      </div>
      <div className="cd-cli-card__actions">
        {installed ? (
          <Button size="sm" onClick={() => onLaunch(cli)}>{t("launcher.launch")}</Button>
        ) : (
          <Button size="sm" variant="ghost" loading={installing} onClick={() => onInstall(cli)}>
            {installing ? t("launcher.installing") : t("launcher.install")}
          </Button>
        )}
      </div>
      {installed && (pinnedDirs.length > 0 || recentDirs.length > 0) && (
        <div className="cd-cli-card__recents">
          {pinnedDirs.map((d) => (
            <button
              key={`pin-${d}`}
              className="cd-cli-card__recent-dir cd-cli-card__recent-dir--pinned"
              title={d}
              disabled={quickLaunching}
              onClick={(e) => {
                e.stopPropagation();
                void quickLaunch(d);
              }}
            >
              <span className="cd-cli-card__pin-icon" aria-hidden="true">&#x25C8;</span> {truncateEnd(d)}
            </button>
          ))}
          {recentDirs.map((d) => (
            <button
              key={d}
              className="cd-cli-card__recent-dir"
              title={d}
              disabled={quickLaunching}
              onClick={(e) => {
                e.stopPropagation();
                void quickLaunch(d);
              }}
            >
              <span className="cd-cli-card__dir-icon" aria-hidden="true">&#x25B7;</span> {truncateEnd(d)}
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}
