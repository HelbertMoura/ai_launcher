import { useEffect, useMemo, useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { Input } from "../../ui/Input";
import { Banner } from "../../ui/Banner";
import { Toggle } from "../../ui/Toggle";
import { SafeCommandPreview } from "../../ui/SafeCommandPreview";
import { appendHistory } from "./history";
import { getLastDir, saveLastDir, getRecentDirs, addRecentDir } from "../history/useHistory";
import { pinDir, unpinDir, isPinned } from "./pinnedDirs";
import { addProfile, loadProfiles } from "../../domain/profileStore";
import type { LaunchProfile } from "../../domain/types";
import { buildLaunchEnvAsync, buildLaunchEnv, loadProviders, setActive } from "../../providers/storage";
import { ensurePermissionThenNotify } from "../../lib/notifications";
import { buildPreview } from "../../lib/commandPreview";
import type { CommandPreview } from "../../lib/commandPreview";
import type { ProvidersState } from "../../providers/types";
import type { CliInfo } from "./useClis";

interface LaunchDialogProps {
  cli: CliInfo | null;
  onClose: () => void;
}

const CLAUDE_KEY = "claude";
const CLIS_WITH_PROMPT_FLAG = new Set(["claude", "codex", "gemini"]);

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
  clipboardPrompt: boolean;
  showPreview: boolean;
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
  | { type: "setError"; error: string | null }
  | { type: "setClipboardPrompt"; value: boolean }
  | { type: "setShowPreview"; value: boolean };

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
        clipboardPrompt: false,
        showPreview: false,
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
    case "setClipboardPrompt":
      return { ...state, clipboardPrompt: action.value };
    case "setShowPreview":
      return { ...state, showPreview: action.value };
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
  clipboardPrompt: false,
  showPreview: false,
};

export function LaunchDialog({ cli, onClose }: LaunchDialogProps) {
  const { t } = useTranslation();
  const [state, dispatch] = useReducer(launchReducer, INITIAL_LAUNCH_STATE);
  const [saveTemplateName, setSaveTemplateName] = useState<string | null>(null);
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
    clipboardPrompt,
    showPreview,
  } = state;

  const isClaude = cli?.key === CLAUDE_KEY;
  const supportsPrompt = cli ? CLIS_WITH_PROMPT_FLAG.has(cli.key) : false;

  // Build command preview for SafeCommandPreview
  const commandLine = cli
    ? [cli.command, args].filter(Boolean).join(" ")
    : "";

  const previewEnv = useMemo(() => {
    if (isClaude && providersState) {
      const stateWithSelected = setActive(providersState, providerId);
      return buildLaunchEnv(stateWithSelected);
    }
    return {} as Record<string, string>;
  }, [isClaude, providersState, providerId]);

  const preview: CommandPreview = useMemo(
    () => buildPreview(commandLine, directory || ".", previewEnv),
    [commandLine, directory, previewEnv],
  );

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
        envVars = await buildLaunchEnvAsync(stateWithSelected);
      }
      let finalArgs = args;
      if (clipboardPrompt && supportsPrompt) {
        try {
          const text = await navigator.clipboard.readText();
          const trimmed = text.trim();
          if (trimmed) {
            // JSON.stringify escapes quotes and newlines safely
            const escaped = JSON.stringify(trimmed);
            finalArgs = finalArgs ? `${finalArgs} -p ${escaped}` : `-p ${escaped}`;
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn("[clipboard] read failed", err);
          // Continue launch without the prompt
        }
      }
      const result = await invoke<{ session_id: string; message: string }>("launch_cli", {
        cliKey: cli.key,
        directory,
        args: finalArgs,
        noPerms,
        envVars: envVars ?? null,
      });
      void ensurePermissionThenNotify(
        t("notifications.sessionStarted.title", { cli: cli.name }),
        t("notifications.sessionStarted.body", { dir: directory }),
      );
      const now = new Date().toISOString();
      saveLastDir(cli.key, directory);
      addRecentDir(cli.key, directory);
      appendHistory({
        cli: cli.name,
        cliKey: cli.key,
        directory,
        args,
        timestamp: now,
        providerId: isClaude ? providerId : undefined,
        status: "starting",
        sessionId: result.session_id,
        startedAt: now,
      });
      onClose();
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      // Record failed launch in history
      const now = new Date().toISOString();
      appendHistory({
        cli: cli.name,
        cliKey: cli.key,
        directory,
        args,
        timestamp: now,
        providerId: isClaude ? providerId : undefined,
        status: "failed",
        startedAt: now,
        errorMessage: errMsg,
      });
      dispatch({
        type: "launchFailed",
        error: errMsg,
      });
    }
  };

  return (
    <>
    <Dialog
      open={cli !== null}
      onClose={onClose}
      title={cli ? t("launchDialog.title", { cli: cli.name }) : t("launchDialog.title_default")}
      size="md"
      footer={
        showPreview ? undefined : (
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (!cli || !directory.trim()) return;
                const defaultName = `${cli.name} · ${directory.split(/[\\/]/).pop() || directory}`;
                setSaveTemplateName(defaultName);
              }}
            >
              {t("launchDialog.saveTemplate")}
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => dispatch({ type: "setShowPreview", value: true })}
            >
              Preview
            </Button>
            <Button size="sm" loading={launching} onClick={doLaunch}>
              {t("launcher.launch")}
            </Button>
          </>
        )
      }
    >
      {error && <Banner variant="err">{error}</Banner>}

      {showPreview ? (
        <SafeCommandPreview
          preview={preview}
          onConfirm={doLaunch}
          onCancel={() => dispatch({ type: "setShowPreview", value: false })}
          confirmLabel={t("launcher.launch")}
          cancelLabel={t("common.cancel")}
          loading={launching}
        />
      ) : (
      <>
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
                        <span className="cd-launch-dialog__recent-icon" aria-hidden="true">&#x25B7;</span>
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
                        {pinned ? "◈" : "○"}
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

      {supportsPrompt && (
        <div className="cd-launch-dialog__field cd-launch-dialog__field--toggle">
          <Toggle
            checked={clipboardPrompt}
            onChange={(value) => dispatch({ type: "setClipboardPrompt", value })}
            label={
              <span>
                <span className="cd-launch-dialog__toggle-main">
                  {t("launchDialog.clipboardPromptLabel")}
                </span>
                <span className="cd-launch-dialog__hint">
                  {t("launchDialog.clipboardPromptHint")}
                </span>
              </span>
            }
          />
        </div>
      )}

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
      </>
      )}
    </Dialog>

    <InnerSavePrompt
      open={saveTemplateName !== null}
      defaultValue={saveTemplateName ?? ""}
      onCancel={() => setSaveTemplateName(null)}
      onConfirm={(name) => {
        if (!cli) return;
        const now = new Date().toISOString();
        const profile: LaunchProfile = {
          id: `profile-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name,
          directory,
          cliKeys: [cli.key],
          toolKeys: [],
          providerKey: isClaude ? providerId || undefined : undefined,
          args: args || undefined,
          noPerms,
          tags: [],
          pinned: false,
          createdAt: now,
          updatedAt: now,
        };
        const current = loadProfiles();
        addProfile(current, profile);
        setSaveTemplateName(null);
      }}
    />
    </>
  );
}

function InnerSavePrompt({
  open,
  defaultValue,
  onCancel,
  onConfirm,
}: {
  readonly open: boolean;
  readonly defaultValue: string;
  readonly onCancel: () => void;
  readonly onConfirm: (name: string) => void;
}) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (open) setValue(defaultValue);
  }, [open, defaultValue]);

  if (!open) return null;

  const handleConfirm = () => {
    const name = value.trim();
    if (name) onConfirm(name);
  };

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title="Save Template"
      size="sm"
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleConfirm}>
            Save
          </Button>
        </>
      }
    >
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleConfirm();
          if (e.key === "Escape") onCancel();
        }}
        placeholder="Template name"
        autoFocus
      />
    </Dialog>
  );
}
