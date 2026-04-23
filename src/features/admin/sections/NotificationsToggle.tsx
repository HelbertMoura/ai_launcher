import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Toggle } from "../../../ui/Toggle";
import {
  isNotificationsEnabled,
  setNotificationsEnabled,
} from "../../../lib/notifications";

export function NotificationsToggle() {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(isNotificationsEnabled());

  const handleChange = (next: boolean) => {
    setNotificationsEnabled(next);
    setEnabled(next);
  };

  return (
    <Toggle
      checked={enabled}
      onChange={handleChange}
      label={
        <span>
          <span>{t("admin.notifications.label")}</span>
          <span className="cd-muted"> — {t("admin.notifications.hint")}</span>
        </span>
      }
    />
  );
}
