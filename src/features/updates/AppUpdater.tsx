import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import { Banner } from "../../ui/Banner";
import { useAppUpdate } from "../../hooks/useAppUpdate";

export function AppUpdater() {
  const { t } = useTranslation();
  const { info, status, progress, error, check, download, dismiss } = useAppUpdate();

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  };

  return (
    <div className="cd-updates__section cd-updates__app">
      <h3 className="cd-updates__section-title">
        {t("updates.appTitle", "AI Launcher")}
      </h3>
      <div className="cd-updates__list">
        {/* Current version display */}
        <div className="cd-updates__row cd-updates__row--app">
          <div className="cd-updates__row-info">
            <span className="cd-updates__row-name">
              {t("updates.appCurrentVersion", "Current Version")}
            </span>
            <span className="cd-updates__row-detail">
              v{info?.current_version ?? __APP_VERSION__}
            </span>
          </div>

          {status === "idle" && !info?.update_available && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void check()}
            >
              {t("updates.appCheck", "Check for Updates")}
            </Button>
          )}

          {status === "checking" && (
            <Button size="sm" variant="ghost" loading>
              {t("updates.appChecking", "Checking...")}
            </Button>
          )}
        </div>

        {/* Update available */}
        {status === "available" && info?.update_available && (
          <div className="cd-updates__row cd-updates__row--update">
            <div className="cd-updates__row-info">
              <span className="cd-updates__row-name">
                {t("updates.appUpdateAvailable", "Update Available")}
              </span>
              <span className="cd-updates__row-detail">
                v{info.current_version} → v{info.version}
              </span>
            </div>
            <div className="cd-updates__row-actions">
              <Button
                size="sm"
                variant="ghost"
                onClick={dismiss}
              >
                {t("updates.appDismiss", "Dismiss")}
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => void download()}
              >
                {t("updates.appDownload", "Download & Install")}
              </Button>
            </div>
          </div>
        )}

        {/* Downloading */}
        {status === "downloading" && (
          <div className="cd-updates__row cd-updates__row--progress">
            <div className="cd-updates__row-info">
              <span className="cd-updates__row-name">
                {t("updates.appDownloading", "Downloading update...")}
              </span>
              <span className="cd-updates__row-detail">
                {progress && progress.total > 0
                  ? `${formatBytes(progress.downloaded)} / ${formatBytes(progress.total)} (${progress.percent}%)`
                  : t("updates.appPreparing", "Preparing download...")}
              </span>
            </div>
            <div className="cd-updates__progress-bar">
              <div
                className="cd-updates__progress-fill"
                style={{ width: `${progress?.percent ?? 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Verifying checksum */}
        {status === "verifying" && (
          <div className="cd-updates__row cd-updates__row--verifying">
            <div className="cd-updates__row-info">
              <span className="cd-updates__row-name">
                {t("updates.appVerifying", "Verifying integrity...")}
              </span>
              <span className="cd-updates__row-detail">
                SHA-256 checksum validation
              </span>
            </div>
            <Button size="sm" variant="ghost" loading>
              {t("updates.appVerifying", "Verifying...")}
            </Button>
          </div>
        )}

        {/* Ready to install */}
        {status === "ready" && (
          <div className="cd-updates__row cd-updates__row--ready">
            <div className="cd-updates__row-info">
              <span className="cd-updates__row-name">
                {t("updates.appReady", "Update downloaded successfully")}
              </span>
              <span className="cd-updates__row-detail">
                v{info?.version} — {t("updates.appInstallerOpened", "Installer folder opened")}
              </span>
            </div>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              {t("updates.appClose", "Close")}
            </Button>
          </div>
        )}

        {/* Error */}
        {error && (
          <Banner variant="err">
            {error}
          </Banner>
        )}

        {/* Release notes link */}
        {info?.release_notes_url && status !== "idle" && (
          <div className="cd-updates__changelog">
            <a
              href={info.release_notes_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("updates.appChangelog", "View changelog on GitHub")} ↗
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// Build-time version injection via Vite define.
declare const __APP_VERSION__: string;
