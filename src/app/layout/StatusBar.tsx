import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "./StatusBar.css";

interface StatusBarProps {
  online: number;
  total: number;
  todaySpend: string;
  version: string;
  updatesCount?: number;
  onRefresh?: () => void;
}

function useClock(): string {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const msUntilNextMinute =
      (60 - time.getSeconds()) * 1000 - time.getMilliseconds();

    const timeout = setTimeout(() => {
      setTime(new Date());
    }, msUntilNextMinute);

    const interval = setInterval(() => {
      setTime(new Date());
    }, 60_000);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [time]);

  return time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function StatusBar({
  online,
  total,
  todaySpend,
  version,
  updatesCount = 0,
  onRefresh,
}: StatusBarProps) {
  const { t } = useTranslation();
  const clock = useClock();

  return (
    <footer className="cd-status">
      <span className="cd-status__cell cd-status__cell--brand">
        {t("statusBar.branding")}
      </span>

      <span className="cd-status__cell">▎ {online}/{total} online</span>

      <span className="cd-status__cell cd-status__cell--accent">● ADMIN</span>

      <span className="cd-status__cell">
        {todaySpend} {t("statusBar.todaySpend")}
      </span>

      {updatesCount > 0 && (
        <span className="cd-status__cell cd-status__cell--warn">
          ▲ {t("statusBar.updates", { count: updatesCount })}
        </span>
      )}

      {onRefresh && (
        <button
          type="button"
          className="cd-status__cell cd-status__btn"
          onClick={onRefresh}
          title={t("statusBar.refresh")}
          aria-label={t("statusBar.refresh")}
        >
          ⟳
        </button>
      )}

      <span className="cd-status__cell cd-status__cell--muted">{clock}</span>

      <span className="cd-status__cell cd-status__cell--muted">v{version}</span>
    </footer>
  );
}
