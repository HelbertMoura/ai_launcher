import { useEffect, useMemo, useReducer } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { Input } from "../../ui/Input";
import { Banner } from "../../ui/Banner";
import { SafeCommandPreview } from "../../ui/SafeCommandPreview";
import { ensurePermissionThenNotify } from "../../lib/notifications";
import { buildPreview } from "../../lib/commandPreview";
import type { CommandPreview } from "../../lib/commandPreview";
import type { CustomCli } from "../../lib/customClis";

interface CustomCliLaunchDialogProps {
  cli: CustomCli | null;
  onClose: () => void;
}

interface LaunchState {
  directory: string;
  args: string;
  launching: boolean;
  error: string | null;
  confirmed: boolean;
  showPreview: boolean;
}

type LaunchAction =
  | { type: "reset"; directory: string }
  | { type: "setDirectory"; value: string }
  | { type: "setArgs"; value: string }
  | { type: "startLaunch" }
  | { type: "launchFailed"; error: string }
  | { type: "setError"; error: string | null }
  | { type: "setConfirmed"; value: boolean }
  | { type: "setShowPreview"; value: boolean };

const INITIAL_STATE: LaunchState = {
  directory: "",
  args: "",
  launching: false,
  error: null,
  confirmed: false,
  showPreview: false,
};

function reducer(state: LaunchState, action: LaunchAction): LaunchState {
  switch (action.type) {
    case "reset":
      return { ...INITIAL_STATE, directory: action.directory };
    case "setDirectory":
      return { ...state, directory: action.value };
    case "setArgs":
      return { ...state, args: action.value };
    case "startLaunch":
      return { ...state, launching: true, error: null };
    case "launchFailed":
      return { ...state, launching: false, error: action.error };
    case "setError":
      return { ...state, error: action.error };
    case "setConfirmed":
      return { ...state, confirmed: action.value };
    case "setShowPreview":
      return { ...state, showPreview: action.value };
  }
}

export function CustomCliLaunchDialog({ cli, onClose }: CustomCliLaunchDialogProps) {
  const { t } = useTranslation();
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const { directory, args, launching, error, confirmed, showPreview } = state;

  useEffect(() => {
    if (cli) {
      dispatch({ type: "reset", directory: "" });
    }
  }, [cli]);

  const commandLine = cli
    ? [
        cli.installCmd.split(/\s+/).pop() ?? cli.key,
        cli.launchArgs || args ? [cli.launchArgs, args].filter(Boolean).join(" ") : "",
      ].filter(Boolean).join(" ")
    : "";

  const preview: CommandPreview = useMemo(
    () => buildPreview(commandLine, directory || "."),
    [commandLine, directory],
  );

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
      const command = cli.installCmd.split(/\s+/).pop() ?? cli.key;
      const allArgs = [cli.launchArgs, args].filter(Boolean).join(" ") || null;
      await invoke<{ session_id: string; message: string }>("launch_custom_cli", {
        command,
        args: allArgs,
        directory,
        env: null,
      });
      void ensurePermissionThenNotify(
        t("notifications.sessionStarted.title", { cli: cli.name }),
        t("notifications.sessionStarted.body", { dir: directory }),
      );
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
        showPreview ? undefined : (
          <>
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
            <Button
              size="sm"
              loading={launching}
              disabled={!confirmed}
              onClick={doLaunch}
            >
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
          {/* Command preview summary */}
          <div className="cd-launch-dialog__field">
            <label className="cd-launch-dialog__label">Command preview</label>
            <pre className="cd-custom-launch-preview">
              <code>{commandLine}</code>
            </pre>
            {directory && (
              <pre className="cd-custom-launch-preview cd-custom-launch-preview--secondary">
                <code>cwd: {directory}</code>
              </pre>
            )}
          </div>

          <div className="cd-launch-dialog__field">
            <label className="cd-launch-dialog__label">{t("launchDialog.directory")}</label>
            <div className="cd-launch-dialog__row">
              <Input
                className="cd-launch-dialog__input"
                value={directory}
                placeholder={t("launchDialog.directoryPlaceholder")}
                onChange={(e) => dispatch({ type: "setDirectory", value: e.target.value })}
              />
              <Button size="sm" variant="ghost" onClick={pickDirectory}>
                {t("common.browse")}
              </Button>
            </div>
          </div>

          <div className="cd-launch-dialog__field">
            <label className="cd-launch-dialog__label">{t("launchDialog.argsOptional")}</label>
            <Input
              className="cd-launch-dialog__input"
              value={args}
              placeholder={t("launchDialog.argsPlaceholder")}
              onChange={(e) => dispatch({ type: "setArgs", value: e.target.value })}
            />
          </div>

          {/* Confirm checkbox */}
          <div className="cd-launch-dialog__field cd-launch-dialog__field--toggle">
            <label className="cd-launch-dialog__confirm-label">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => dispatch({ type: "setConfirmed", value: e.target.checked })}
              />
              <span>{t("launchDialog.confirmCommand", "I confirm this command is safe to execute")}</span>
            </label>
          </div>
        </>
      )}
    </Dialog>
  );
}
