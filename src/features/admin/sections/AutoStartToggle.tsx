import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { isEnabled, enable, disable } from "@tauri-apps/plugin-autostart";
import { Toggle } from "../../../ui/Toggle";

export function AutoStartToggle() {
  const { t } = useTranslation();
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    isEnabled()
      .then((v) => setChecked(v))
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[autostart] isEnabled failed", err);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleChange = async (next: boolean) => {
    setBusy(true);
    try {
      if (next) await enable();
      else await disable();
      setChecked(next);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[autostart] toggle failed", err);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return null;

  return (
    <Toggle
      checked={checked}
      onChange={handleChange}
      disabled={busy}
      label={
        <span>
          <span>{t("admin.autostart.label")}</span>
          <span className="cd-muted"> — {t("admin.autostart.hint")}</span>
        </span>
      }
    />
  );
}
