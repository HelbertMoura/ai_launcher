import { useEffect, useMemo, useReducer } from "react";
import { useTranslation } from "react-i18next";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Button } from "../../../ui/Button";
import { Dialog } from "../../../ui/Dialog";
import { Input } from "../../../ui/Input";
import { Banner } from "../../../ui/Banner";
import { SafeCommandPreview } from "../../../ui/SafeCommandPreview";
import { ensurePermissionThenNotify } from "../../../lib/notifications";
import { buildPreview } from "../../../lib/commandPreview";
import type { CommandPreview } from "../../../lib/commandPreview";

/**
 * Shared launch dialog for user-defined catalog entries (custom CLIs and
 * custom IDEs). The feature wrappers supply the entry, the command line
 * builder and the launch execution; everything else (state machine,
 * directory picker, preview flow, confirm checkbox) is identical.
 */
export interface CustomEntryLaunchDialogProps {
  /** Entry under launch; null keeps the dialog closed. */
  entry: { name: string } | null;
  onClose: () => void;
  /** Full command line for the preview block (also fed to buildPreview). */
  commandLine: (directory: string, args: string) => string;
  /** Executes the launch; a rejection routes the error to the banner. */
  launch: (directory: string, args: string) => Promise<void>;
  /** Directory value interpolated into the "session started" notification. */
  notifyDirectory?: (directory: string) => string;
  /** Block the launch while the directory is empty (custom CLI behavior). */
  requireDirectory?: boolean;
  /** Render the optional args field (custom CLI behavior). */
  showArgsField?: boolean;
  /** Label of the launch action (footer button + preview confirm). */
  launchLabel: string;
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

export function CustomEntryLaunchDialog({
  entry,
  onClose,
  commandLine: buildCommandLine,
  launch,
  notifyDirectory = (directory) => directory,
  requireDirectory = false,
  showArgsField = false,
  launchLabel,
}: CustomEntryLaunchDialogProps) {
  const { t } = useTranslation();
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const { directory, args, launching, error, confirmed, showPreview } = state;

  useEffect(() => {
    if (entry) {
      dispatch({ type: "reset", directory: "" });
    }
  }, [entry]);

  const commandLine = entry ? buildCommandLine(directory, args) : "";

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
    if (!entry) return;
    if (requireDirectory && !directory.trim()) {
      dispatch({ type: "setError", error: t("launchDialog.directoryRequired") });
      return;
    }
    dispatch({ type: "startLaunch" });
    try {
      await launch(directory, args);
      void ensurePermissionThenNotify(
        t("notifications.sessionStarted.title", { cli: entry.name }),
        t("notifications.sessionStarted.body", { dir: notifyDirectory(directory) }),
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
      open={entry !== null}
      onClose={onClose}
      title={entry ? t("launchDialog.title", { cli: entry.name }) : t("launchDialog.title_default")}
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
              {launchLabel}
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
          confirmLabel={launchLabel}
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

          {showArgsField && (
            <div className="cd-launch-dialog__field">
              <label className="cd-launch-dialog__label">{t("launchDialog.argsOptional")}</label>
              <Input
                className="cd-launch-dialog__input"
                value={args}
                placeholder={t("launchDialog.argsPlaceholder")}
                onChange={(e) => dispatch({ type: "setArgs", value: e.target.value })}
              />
            </div>
          )}

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
