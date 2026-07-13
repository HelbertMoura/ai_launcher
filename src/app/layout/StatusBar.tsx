import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "./StatusBar.css";
import type { ExecutionMode } from "../../domain/executionMode";

export type LatencyTone = "ok" | "warn" | "err";

export interface LastSessionInfo {
  cli: string;
  /** Short relative label (e.g. "2m ago", "just now"). */
  relative: string;
}

export interface ProviderLatency {
  name: string;
  tone: LatencyTone;
}

interface StatusBarProps {
  online: number;
  total: number;
  todaySpend: string;
  version: string;
  updatesCount?: number;
  lastSession?: LastSessionInfo;
  providerLatency?: ProviderLatency;
  onRefresh?: () => void;
  executionMode: ExecutionMode;
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
  lastSession,
  providerLatency,
  onRefresh,
  executionMode,
}: StatusBarProps) {
  const { t } = useTranslation();
  const clock = useClock();

  return (
    <footer className="cd-status">
      <div className="cd-status__group cd-status__group--primary">
        <span className="cd-status__cell cd-status__cell--online">
          <span className="cd-status__dot cd-status__dot--ok" aria-hidden />
          {online}/{total} {t("statusBar.onlineLabel")}
        </span>
        <span className={`cd-status__cell cd-status__cell--mode cd-status__cell--mode-${executionMode}`}>
          {t(`statusBar.modes.${executionMode}`)}
        </span>
        {providerLatency && (
          <span className="cd-status__cell cd-status__cell--mini" title={`Provider: ${providerLatency.name}`}>
            <span className={`cd-status__dot cd-status__dot--${providerLatency.tone}`} aria-hidden />
            {providerLatency.name}
          </span>
        )}
      </div>

      <div className="cd-status__group cd-status__group--secondary">
        {lastSession && (
          <span className="cd-status__cell cd-status__cell--mini cd-status__cell--session" title={`Last session: ${lastSession.cli}`}>
            {lastSession.cli} · {lastSession.relative}
          </span>
        )}
        <span className="cd-status__cell cd-status__cell--spend">{todaySpend} {t("statusBar.todaySpend")}</span>
        {updatesCount > 0 && <span className="cd-status__cell cd-status__cell--warn">▲ {t("statusBar.updates", { count: updatesCount })}</span>}
        {onRefresh && (
          <button type="button" className="cd-status__btn" onClick={onRefresh}
            title={t("statusBar.refresh")} aria-label={t("statusBar.refresh")}>⟳</button>
        )}
        <span className="cd-status__cell cd-status__cell--clock">{clock}</span>
        <span className="cd-status__cell cd-status__cell--version">v{version}</span>
      </div>
    </footer>
  );
}
