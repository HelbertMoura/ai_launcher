import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../../ui/Button";
import { Card } from "../../../ui/Card";
import {
  downloadConfigJson,
  importConfig,
  previewImportConfig,
  type ConfigImportPreview,
} from "../../../lib/configIO";
import { showToast } from "../../../ui/toastStore";
import { ConfirmDialog } from "../../../ui/ConfirmDialog";

export function ConfigBackupSection() {
  const { t, i18n } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [raw, setRaw] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<ConfigImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);

  const handleExport = () => {
    downloadConfigJson(__APP_VERSION__);
    showToast(t("admin.backup.exported"), "success");
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const nextPreview = previewImportConfig(text);
      setRaw(text);
      setFileName(file.name);
      if (nextPreview.ok) {
        setPreview(nextPreview);
        setError(null);
      } else {
        setPreview(null);
        setError(nextPreview.error);
      }
    };
    reader.onerror = () => {
      setPreview(null);
      setError(t("admin.backup.readFailed"));
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const applyImport = (mode: "merge" | "replace") => {
    if (!raw || !preview) return;
    const result = importConfig(raw, mode);
    if (!result.ok) {
      setError(result.error);
      showToast(result.error, "error");
      return;
    }
    showToast(
      t("admin.backup.imported", {
        count: preview.knownKeys.length,
        redacted: result.redactedCount,
      }),
      "success",
    );
  };

  return (
    <div>
      <div className="cd-admin-section__head">
        <div>
          <span className="cd-admin-section__eyebrow">{t("admin.backup.eyebrow")}</span>
          <h2 className="cd-admin-section__title">{t("admin.backup.title")}</h2>
          <p className="cd-admin-section__sub">{t("admin.backup.subtitle")}</p>
        </div>
      </div>

      <div className="cd-admin-backup__flow" aria-label={t("admin.backup.flowLabel")}>
        <div><span>01</span><strong>{t("admin.backup.flowExport")}</strong><small>{t("admin.backup.flowExportHint")}</small></div>
        <div><span>02</span><strong>{t("admin.backup.flowPreview")}</strong><small>{t("admin.backup.flowPreviewHint")}</small></div>
        <div><span>03</span><strong>{t("admin.backup.flowRestore")}</strong><small>{t("admin.backup.flowRestoreHint")}</small></div>
      </div>

      <div className="cd-admin-backup__actions">
        <Card className="cd-admin-backup__action-card">
          <span className="cd-admin-section__eyebrow">{t("admin.backup.createLabel")}</span>
          <strong>{t("admin.backup.createTitle")}</strong>
          <p>{t("admin.backup.createHint")}</p>
          <Button size="sm" onClick={handleExport}>{t("admin.backup.export")}</Button>
        </Card>
        <Card className="cd-admin-backup__action-card">
          <span className="cd-admin-section__eyebrow">{t("admin.backup.restoreLabel")}</span>
          <strong>{t("admin.backup.restoreTitle")}</strong>
          <p>{t("admin.backup.restoreHint")}</p>
          <Button size="sm" variant="ghost" onClick={() => inputRef.current?.click()}>
            {t("admin.backup.choose")}
          </Button>
        </Card>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        aria-label={t("admin.backup.choose")}
        className="cd-admin-file-input"
        onChange={handleFile}
      />

      <Card className="cd-admin-backup__preview">
        <div className="cd-admin-card">
          {!preview && !error && (
            <p className="cd-admin-card__detail">{t("admin.backup.empty")}</p>
          )}

          {error && (
            <p className="cd-admin-card__test cd-admin-card__test--err" role="alert">
              {error}
            </p>
          )}

          {preview && (
            <>
              <div className="cd-admin-card__row">
                <div>
                  <div className="cd-admin-card__name">{fileName}</div>
                  <div className="cd-admin-card__detail">
                    v{preview.version} · {new Date(preview.exportedAt).toLocaleString(i18n.language)}
                  </div>
                </div>
                <div className="cd-admin-card__meta">
                  <span className="cd-admin-backup__badge">
                    {t("admin.backup.known", { count: preview.knownKeys.length })}
                  </span>
                  <span className="cd-admin-backup__badge">
                    {t("admin.backup.unknown", { count: preview.unknownKeys.length })}
                  </span>
                  <span className="cd-admin-backup__badge cd-admin-backup__badge--accent">
                    {t("admin.backup.redacted", { count: preview.redactedCount })}
                  </span>
                </div>
              </div>

              <div className="cd-admin-card__detail">
                {preview.knownKeys.slice(0, 18).join(", ")}
                {preview.knownKeys.length > 18 ? "..." : ""}
              </div>

              <div className="cd-admin-card__actions">
                <Button size="sm" variant="ghost" onClick={() => applyImport("merge")}>
                  {t("admin.backup.merge")}
                </Button>
                <Button size="sm" variant="danger" onClick={() => setConfirmReplace(true)}>
                  {t("admin.backup.replace")}
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>

      <ConfirmDialog
        open={confirmReplace}
        variant="danger"
        title={t("admin.backup.replaceTitle")}
        message={t("admin.backup.replaceMessage")}
        confirmLabel={t("admin.backup.replaceConfirm")}
        onConfirm={() => { applyImport("replace"); setConfirmReplace(false); }}
        onCancel={() => setConfirmReplace(false)}
      />
    </div>
  );
}
