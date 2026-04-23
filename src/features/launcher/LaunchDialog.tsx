import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { Input } from "../../ui/Input";
import { Banner } from "../../ui/Banner";
import { Toggle } from "../../ui/Toggle";
import { appendHistory } from "./history";
import { getLastDir, saveLastDir, getRecentDirs, addRecentDir } from "../history/useHistory";
import { buildLaunchEnv, loadProviders, setActive } from "../../providers/storage";
import type { ProvidersState } from "../../providers/types";
import type { CliInfo } from "./useClis";

interface LaunchDialogProps {
  cli: CliInfo | null;
  onClose: () => void;
}

const CLAUDE_KEY = "claude";

export function LaunchDialog({ cli, onClose }: LaunchDialogProps) {
  const { t } = useTranslation();
  const [directory, setDirectory] = useState("");
  const [args, setArgs] = useState("");
  const [noPerms, setNoPerms] = useState(true);
  const [providersState, setProvidersState] = useState<ProvidersState | null>(null);
  const [providerId, setProviderId] = useState<string>("");
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentDirs, setRecentDirs] = useState<string[]>([]);
  const [showRecent, setShowRecent] = useState(false);

  const isClaude = cli?.key === CLAUDE_KEY;

  useEffect(() => {
    if (!cli) return;
    const lastDir = getLastDir(cli.key);
    setDirectory(lastDir);
    setRecentDirs(getRecentDirs(cli.key));
    setShowRecent(false);
    setArgs("");
    setNoPerms(true);
    setError(null);
    setLaunching(false);
    if (cli.key === CLAUDE_KEY) {
      const state = loadProviders();
      setProvidersState(state);
      setProviderId(state.activeId);
    } else {
      setProvidersState(null);
      setProviderId("");
    }
  }, [cli]);

  const providerOptions = useMemo(() => {
    if (!providersState) return [];
    return providersState.profiles.map((p) => ({
      id: p.id,
      label: `${p.name}${p.kind !== "anthropic" ? ` · ${p.kind}` : ""}`,
    }));
  }, [providersState]);

  const pickDirectory = async () => {
    try {
      const picked = await openDialog({ directory: true, multiple: false });
      if (typeof picked === "string") setDirectory(picked);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const doLaunch = async () => {
    if (!cli) return;
    if (!directory.trim()) {
      setError(t("launchDialog.directoryRequired"));
      return;
    }
    setLaunching(true);
    setError(null);
    try {
      let envVars: Record<string, string> | undefined;
      if (isClaude && providersState) {
        const stateWithSelected = setActive(providersState, providerId);
        envVars = buildLaunchEnv(stateWithSelected);
      }
      await invoke<string>("launch_cli", {
        cliKey: cli.key,
        directory,
        args,
        noPerms,
        envVars: envVars ?? null,
      });
      saveLastDir(cli.key, directory);
      addRecentDir(cli.key, directory);
      appendHistory({
        cli: cli.name,
        cliKey: cli.key,
        directory,
        args,
        timestamp: new Date().toISOString(),
        providerId: isClaude ? providerId : undefined,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLaunching(false);
    }
  };

  return (
    <Dialog
      open={cli !== null}
      onClose={onClose}
      title={cli ? t("launchDialog.title", { cli: cli.name }) : t("launchDialog.title_default")}
      size="md"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button size="sm" loading={launching} onClick={doLaunch}>
            {t("launcher.launch")}
          </Button>
        </>
      }
    >
      {error && <Banner variant="err">{error}</Banner>}

      <div className="cd-launch-dialog__field">
        <label className="cd-launch-dialog__label">{t("launchDialog.directory")}</label>
        <div className="cd-launch-dialog__row">
          <div style={{ position: "relative", flex: 1 }}>
            <Input
              className="cd-launch-dialog__input"
              value={directory}
              placeholder={t("launchDialog.directoryPlaceholder")}
              onChange={(e) => setDirectory(e.target.value)}
              onFocus={() => recentDirs.length > 0 && setShowRecent(true)}
              onBlur={() => setTimeout(() => setShowRecent(false), 200)}
            />
            {showRecent && recentDirs.length > 0 && (
              <ul className="cd-launch-dialog__recent-list">
                {recentDirs.map((d) => (
                  <li
                    key={d}
                    className="cd-launch-dialog__recent-item"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setDirectory(d);
                      setShowRecent(false);
                    }}
                  >
                    <span className="cd-launch-dialog__recent-icon">📁</span>
                    <span className="cd-launch-dialog__recent-path" title={d}>
                      {d.length > 60 ? `…${d.slice(d.length - 58)}` : d}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Button size="sm" variant="ghost" onClick={pickDirectory}>
            {t("common.browse")}
          </Button>
        </div>
      </div>

      <div className="cd-launch-dialog__field">
        <label className="cd-launch-dialog__label">
          {t("launchDialog.argsOptional")}
        </label>
        <Input
          className="cd-launch-dialog__input"
          value={args}
          placeholder={t("launchDialog.argsPlaceholder")}
          onChange={(e) => setArgs(e.target.value)}
        />
      </div>

      <div className="cd-launch-dialog__field cd-launch-dialog__field--toggle">
        <Toggle
          checked={noPerms}
          onChange={setNoPerms}
          label={
            <span>
              <span className="cd-launch-dialog__toggle-main">
                {t("launchDialog.permissionToggle")}
              </span>
              <span className="cd-launch-dialog__hint">
                {t("launchDialog.permissionHint")}
              </span>
            </span>
          }
        />
      </div>

      {isClaude && providersState && (
        <div className="cd-launch-dialog__field">
          <label className="cd-launch-dialog__label">
            {t("launchDialog.provider")}
          </label>
          <select
            className="cd-launch-dialog__select"
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
          >
            {providerOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="cd-launch-dialog__hint">
            {t("launchDialog.providerHint")}
          </div>
        </div>
      )}
    </Dialog>
  );
}
