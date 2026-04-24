import { useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import type { PrereqCheck } from "./usePrerequisites";

interface PrereqCardProps {
  item: PrereqCheck;
  onInstalled?: () => void;
}

export function PrereqCard({ item, onInstalled }: PrereqCardProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isUrl = item.install_command?.startsWith("http");

  const handleInstall = async () => {
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
    <div
      className={`cd-prereq-card${item.installed ? " cd-prereq-card--ok" : " cd-prereq-card--missing"}`}
    >
      <div className="cd-prereq-card__icon">{item.installed ? "✓" : "✗"}</div>
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
            onClick={() => void handleInstall()}
            disabled={busy}
          >
            {busy
              ? t("updates.installing")
              : isUrl
                ? t("prereqs.openPage", { defaultValue: "Open page" })
                : t("updates.install")}
          </button>
          {item.install_command && (
            <code className="cd-prereq-card__cmd">{item.install_command}</code>
          )}
        </div>
      )}
    </div>
  );
}
