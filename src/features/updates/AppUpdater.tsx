import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import { Banner } from "../../ui/Banner";
import { Chip } from "../../ui/Chip";
import { useAppUpdate } from "../../hooks/useAppUpdate";

export function AppUpdater() {
  const { t } = useTranslation();
  const { info, status, progress, error, check, download, dismiss } = useAppUpdate();
  const statusLabel = t(`updates.appStatus.${status}`);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  };

  return (
    <section className="cd-updates__section cd-updates__app" aria-labelledby="app-updater-title">
      <div className="cd-updates__app-head">
        <div>
          <span className="cd-updates__section-kicker">{t("updates.appEyebrow")}</span>
          <h2 id="app-updater-title" className="cd-updates__section-title">
            {t("updates.appTitle")}
          </h2>
        </div>
        <Chip variant={status === "error" ? "missing" : status === "ready" ? "online" : "neutral"} dot>
          {statusLabel}
        </Chip>
      </div>
      <div className="cd-updates__list">
        {/* Current version display */}
        <div className="cd-updates__row cd-updates__row--app">
          <div className="cd-updates__row-info">
            <span className="cd-updates__row-name">
              {t("updates.appCurrentVersion")}
            </span>
            <span className="cd-updates__row-detail">
              v{info?.current_version ?? __APP_VERSION__}
            </span>
            <span className="cd-updates__trust-line">
              {t("updates.appTrustLine")}
            </span>
          </div>

          {status === "idle" && !info?.update_available && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void check()}
            >
              {t("updates.appCheck")}
            </Button>
          )}

          {status === "checking" && (
            <Button size="sm" variant="ghost" loading>
              {t("updates.appChecking")}
            </Button>
          )}
        </div>

        {/* Update available */}
        {status === "available" && info?.update_available && (
          <div className="cd-updates__row cd-updates__row--update">
            <div className="cd-updates__row-info">
              <span className="cd-updates__row-name">
                {t("updates.appUpdateAvailable")}
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
                {t("updates.appDismiss")}
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => void download()}
              >
                {t("updates.appDownload")}
              </Button>
            </div>
          </div>
        )}

        {/* Downloading */}
        {status === "downloading" && (
          <div className="cd-updates__row cd-updates__row--progress">
            <div className="cd-updates__row-info">
              <span className="cd-updates__row-name">
                {t("updates.appDownloading")}
              </span>
              <span className="cd-updates__row-detail">
                {progress && progress.total > 0
                  ? `${formatBytes(progress.downloaded)} / ${formatBytes(progress.total)} (${progress.percent}%)`
                  : t("updates.appPreparing")}
              </span>
            </div>
            <div
              className="cd-updates__progress-bar"
              role="progressbar"
              aria-label={t("updates.appDownloadProgress")}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress?.percent ?? 0}
            >
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
                {t("updates.appVerifying")}
              </span>
              <span className="cd-updates__row-detail">
                {t("updates.appVerifyingDetail")}
              </span>
            </div>
            <Button size="sm" variant="ghost" loading>
              {t("updates.appVerifying")}
            </Button>
          </div>
        )}

        {/* Ready to install */}
        {status === "ready" && (
          <div className="cd-updates__row cd-updates__row--ready">
            <div className="cd-updates__row-info">
              <span className="cd-updates__row-name">
                {t("updates.appReady")}
              </span>
              <span className="cd-updates__row-detail">
                v{info?.version} — {t("updates.appInstallerOpened")}
              </span>
            </div>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              {t("updates.appClose")}
            </Button>
          </div>
        )}

        <div className="cd-updates__trust" aria-label={t("updates.appTrustTitle")}>
          <div><span aria-hidden>01</span><strong>{t("updates.appTrustManifest")}</strong><small>{t("updates.appTrustManifestHint")}</small></div>
          <div><span aria-hidden>02</span><strong>{t("updates.appTrustChecksum")}</strong><small>{t("updates.appTrustChecksumHint")}</small></div>
          <div><span aria-hidden>03</span><strong>{t("updates.appTrustRelease")}</strong><small>{t("updates.appTrustReleaseHint")}</small></div>
        </div>

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
              {t("updates.appChangelog")} ↗
            </a>
          </div>
        )}
      </div>
    </section>
  );
}

// Build-time version injection via Vite define.
declare const __APP_VERSION__: string;
