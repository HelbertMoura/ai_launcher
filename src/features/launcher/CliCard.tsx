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
import { buildLaunchEnv, loadProviders } from "../../providers/storage";
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
    try {
      let envVars: Record<string, string> | undefined;
      let providerId: string | undefined;
      if (cli.key === "claude") {
        const state = loadProviders();
        envVars = buildLaunchEnv(state);
        providerId = state.activeId;
      }
      await invoke<string>("launch_cli", {
        cliKey: cli.key,
        directory: dir,
        args: "",
        noPerms: true,
        envVars: envVars ?? null,
      });
      saveLastDir(cli.key, dir);
      addRecentDir(cli.key, dir);
      appendHistory({
        cli: cli.name,
        cliKey: cli.key,
        directory: dir,
        args: "",
        timestamp: new Date().toISOString(),
        providerId,
      });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
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
        {hasUpdate && <span className="cd-cli-card__update" title="Update available">⬆</span>}
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
              📌 {truncateEnd(d)}
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
              📂 {truncateEnd(d)}
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}
