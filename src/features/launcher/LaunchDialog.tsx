import { useEffect, useMemo, useReducer } from "react";
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
import { pinDir, unpinDir, isPinned } from "./pinnedDirs";
import { saveTemplate } from "./sessionTemplates";
import { buildLaunchEnv, loadProviders, setActive } from "../../providers/storage";
import { ensurePermissionThenNotify } from "../../lib/notifications";
import type { ProvidersState } from "../../providers/types";
import type { CliInfo } from "./useClis";

interface LaunchDialogProps {
  cli: CliInfo | null;
  onClose: () => void;
}

const CLAUDE_KEY = "claude";

interface LaunchState {
  directory: string;
  args: string;
  noPerms: boolean;
  providersState: ProvidersState | null;
  providerId: string;
  launching: boolean;
  error: string | null;
  recentDirs: string[];
  showRecent: boolean;
}

type LaunchAction =
  | {
      type: "loadForCli";
      directory: string;
      recentDirs: string[];
      providersState: ProvidersState | null;
      providerId: string;
    }
  | { type: "setDirectory"; value: string }
  | { type: "setArgs"; value: string }
  | { type: "setNoPerms"; value: boolean }
  | { type: "setProviderId"; value: string }
  | { type: "setShowRecent"; value: boolean }
  | { type: "startLaunch" }
  | { type: "launchFailed"; error: string }
  | { type: "setError"; error: string | null };

function launchReducer(state: LaunchState, action: LaunchAction): LaunchState {
  switch (action.type) {
    case "loadForCli":
      return {
        ...state,
        directory: action.directory,
        args: "",
        noPerms: true,
        showRecent: false,
        launching: false,
        error: null,
        providersState: action.providersState,
        providerId: action.providerId,
        recentDirs: action.recentDirs,
      };
    case "setDirectory":
      return { ...state, directory: action.value };
    case "setArgs":
      return { ...state, args: action.value };
    case "setNoPerms":
      return { ...state, noPerms: action.value };
    case "setProviderId":
      return { ...state, providerId: action.value };
    case "setShowRecent":
      return { ...state, showRecent: action.value };
    case "startLaunch":
      return { ...state, launching: true, error: null };
    case "launchFailed":
      return { ...state, launching: false, error: action.error };
    case "setError":
      return { ...state, error: action.error };
  }
}

const INITIAL_LAUNCH_STATE: LaunchState = {
  directory: "",
  args: "",
  noPerms: true,
  providersState: null,
  providerId: "",
  launching: false,
  error: null,
  recentDirs: [],
  showRecent: false,
};

export function LaunchDialog({ cli, onClose }: LaunchDialogProps) {
  const { t } = useTranslation();
  const [state, dispatch] = useReducer(launchReducer, INITIAL_LAUNCH_STATE);
  const {
    directory,
    args,
    noPerms,
    providersState,
    providerId,
    launching,
    error,
    recentDirs,
    showRecent,
  } = state;

  const isClaude = cli?.key === CLAUDE_KEY;

  useEffect(() => {
    if (!cli) return;
    const lastDir = getLastDir(cli.key);
    let providersStateLocal: ProvidersState | null = null;
    let providerIdLocal = "";
    if (cli.key === CLAUDE_KEY) {
      providersStateLocal = loadProviders();
      providerIdLocal = providersStateLocal.activeId;
    }
    dispatch({
      type: "loadForCli",
      directory: lastDir,
      recentDirs: getRecentDirs(cli.key),
      providersState: providersStateLocal,
      providerId: providerIdLocal,
    });
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
      if (typeof picked === "string") dispatch({ type: "setDirectory", value: picked });
    } catch (e) {
      dispatch({ type: "setError", error: e instanceof Error ? e.message : String(e) });
    }
  };

  const doLaunch = async () => {
    if (!cli) return;
    if (!directory.trim()) {
      dispatch({ type: "setError", error: t("launchDialog.directoryRequired") });
      return;
    }
    dispatch({ type: "startLaunch" });
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
      void ensurePermissionThenNotify(
        t("notifications.sessionStarted.title", { cli: cli.name }),
        t("notifications.sessionStarted.body", { dir: directory }),
      );
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
      dispatch({
        type: "launchFailed",
        error: e instanceof Error ? e.message : String(e),
      });
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
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (!cli || !directory.trim()) return;
              const defaultName = `${cli.name} · ${directory.split(/[\\/]/).pop() || directory}`;
              const name = window.prompt(t("launchDialog.saveTemplatePrompt"), defaultName);
              if (!name) return;
              saveTemplate({
                name,
                cliKey: cli.key,
                cliName: cli.name,
                directory,
                args,
                noPerms,
                providerId: isClaude ? providerId : null,
              });
            }}
          >
            {t("launchDialog.saveTemplate")}
          </Button>
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
              onChange={(e) => dispatch({ type: "setDirectory", value: e.target.value })}
              onFocus={() =>
                recentDirs.length > 0 && dispatch({ type: "setShowRecent", value: true })
              }
              onBlur={() =>
                setTimeout(() => dispatch({ type: "setShowRecent", value: false }), 200)
              }
            />
            {showRecent && recentDirs.length > 0 && cli && (
              <ul className="cd-launch-dialog__recent-list">
                {recentDirs.map((d) => {
                  const pinned = isPinned(cli.key, d);
                  return (
                    <li key={d} className="cd-launch-dialog__recent-item">
                      <button
                        className="cd-launch-dialog__recent-main"
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          dispatch({ type: "setDirectory", value: d });
                          dispatch({ type: "setShowRecent", value: false });
                        }}
                      >
                        <span className="cd-launch-dialog__recent-icon">📁</span>
                        <span className="cd-launch-dialog__recent-path" title={d}>
                          {d.length > 60 ? `…${d.slice(d.length - 58)}` : d}
                        </span>
                      </button>
                      <button
                        className="cd-launch-dialog__pin-btn"
                        type="button"
                        title={pinned ? t("launchDialog.unpin") : t("launchDialog.pin")}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (pinned) unpinDir(cli.key, d);
                          else pinDir(cli.key, d);
                          dispatch({ type: "setShowRecent", value: false });
                          setTimeout(
                            () => dispatch({ type: "setShowRecent", value: true }),
                            0,
                          );
                        }}
                      >
                        {pinned ? "📌" : "📍"}
                      </button>
                    </li>
                  );
                })}
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
          onChange={(e) => dispatch({ type: "setArgs", value: e.target.value })}
        />
      </div>

      <div className="cd-launch-dialog__field cd-launch-dialog__field--toggle">
        <Toggle
          checked={noPerms}
          onChange={(value) => dispatch({ type: "setNoPerms", value })}
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
            onChange={(e) => dispatch({ type: "setProviderId", value: e.target.value })}
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
