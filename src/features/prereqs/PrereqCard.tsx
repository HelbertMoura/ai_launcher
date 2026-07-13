import { useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import type { PrereqCheck } from "./usePrerequisites";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import { SafeCommandPreview } from "../../ui/SafeCommandPreview";
import { buildPreview, type CommandPreview } from "../../lib/commandPreview";

interface PrereqCardProps {
  item: PrereqCheck;
  onInstalled?: () => void;
}

export function PrereqCard({ item, onInstalled }: PrereqCardProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingPreview, setPendingPreview] = useState<CommandPreview | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  const isUrl = item.install_command?.startsWith("http");

  const openPreview = () => {
    setError(null);
    setAcknowledged(false);
    setPendingPreview(buildPreview(item.install_command ?? "", "", {}));
  };

  const handleInstall = async () => {
    if (pendingPreview?.riskLevel === "dangerous" && !acknowledged) return;
    setPendingPreview(null);
    setAcknowledged(false);
    setBusy(true);
    setError(null);
    try {
      await invoke<string>("install_prerequisite", { key: item.key });
      onInstalled?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div
        className={`cd-prereq-card${item.installed ? " cd-prereq-card--ok" : " cd-prereq-card--missing"}`}
      >
        <div className="cd-prereq-card__icon">{item.installed ? "✓" : "!"}</div>
        <div className="cd-prereq-card__body">
          <div className="cd-prereq-card__name">{item.name}</div>
          <div className="cd-prereq-card__version">
            {item.version ?? t("prereqs.notInstalled")}
          </div>
          {error && <div className="cd-prereq-card__error">{error}</div>}
        </div>
        {!item.installed && (
          <div className="cd-prereq-card__action">
            <button
              type="button"
              className="cd-prereq-card__btn"
              onClick={openPreview}
              disabled={busy}
            >
              {busy
                ? t("updates.installing")
                : isUrl
                  ? t("prereqs.openPage")
                  : t("updates.install")}
            </button>
            {item.install_command && (
              <code
                className="cd-prereq-card__cmd"
                tabIndex={0}
                aria-label={t("prereqs.commandLabel", { name: item.name })}
              >
                {item.install_command}
              </code>
            )}
          </div>
        )}
      </div>

      {pendingPreview && (
        <ConfirmDialog
          open
          variant={pendingPreview.riskLevel === "dangerous" ? "danger" : "normal"}
          title={t("prereqs.confirmInstallTitle", { name: item.name })}
          message={t("prereqs.confirmInstallMessage")}
          confirmLabel={isUrl ? t("prereqs.openPage") : t("updates.install")}
          cancelLabel={t("common.cancel")}
          onConfirm={() => void handleInstall()}
          onCancel={() => setPendingPreview(null)}
        >
          <SafeCommandPreview
            preview={pendingPreview}
            hideActions
            onConfirm={() => void handleInstall()}
            onCancel={() => setPendingPreview(null)}
            onAckChange={setAcknowledged}
          />
        </ConfirmDialog>
      )}
    </>
  );
}
