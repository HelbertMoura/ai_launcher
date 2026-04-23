import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { useHistory, type HistoryItem, type SessionStatus } from "./useHistory";
import { buildLaunchEnv, loadProviders, setActive } from "../../providers/storage";
import type { ProvidersState } from "../../providers/types";
import "../page.css";
import "./HistoryPage.css";

function truncateDir(dir: string, max = 48): string {
  if (dir.length <= max) return dir;
  const head = Math.ceil(max / 2) - 1;
  const tail = Math.floor(max / 2) - 2;
  return `${dir.slice(0, head)}…${dir.slice(dir.length - tail)}`;
}

function useRelativeTime() {
  const { t } = useTranslation();
  return (iso: string): string => {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return iso;
    const diff = Date.now() - then;
    if (diff < 60_000) return t("history.justNow");
    if (diff < 3_600_000)
      return t("history.minutesAgo", { count: Math.floor(diff / 60_000) });
    if (diff < 86_400_000)
      return t("history.hoursAgo", { count: Math.floor(diff / 3_600_000) });
    if (diff < 604_800_000)
      return t("history.daysAgo", { count: Math.floor(diff / 86_400_000) });
    return new Date(iso).toLocaleDateString();
  };
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function StatusBadge({ status }: { status?: SessionStatus }) {
  if (!status || status === "running") {
    return <span className="cd-history__status cd-history__status--running" title="Running">●</span>;
  }
  if (status === "finished") {
    return <span className="cd-history__status cd-history__status--finished" title="Finished">✓</span>;
  }
  return <span className="cd-history__status cd-history__status--error" title="Error">✗</span>;
}

function ProviderBadge({ providerId, profiles }: { providerId?: string; profiles: ProvidersState["profiles"] }) {
  if (!providerId) return null;
  const profile = profiles.find(p => p.id === providerId);
  if (profile) {
    return (
      <span className="cd-history__provider" title={`Provider: ${profile.name}`}>
        {profile.name}
      </span>
    );
  }
  return (
    <span className="cd-history__provider cd-history__provider--gone" title="Provider no longer available">
      {providerId}
    </span>
  );
}

export function HistoryPage() {
  const { t } = useTranslation();
  const { items, clear, updateItem, removeItem } = useHistory();
  const providersState = useMemo(() => loadProviders(), []);

  const onClear = () => {
    if (items.length === 0) return;
    const ok = window.confirm(t("history.clearConfirm"));
    if (ok) clear();
  };

  return (
    <section className="cd-page cd-history">
      <header className="cd-page__head">
        <div className="cd-page__heading">
          <h2 className="cd-page__title">▎ {t("history.title")}</h2>
          <p className="cd-page__sub">
            {items.length === 0
              ? t("history.none")
              : t("history.count", { count: items.length })}
          </p>
        </div>
        {items.length > 0 && (
          <Button variant="danger" size="sm" onClick={onClear}>
            {t("history.clear")}
          </Button>
        )}
      </header>

      {items.length === 0 ? (
        <div className="cd-page__empty">{t("history.none")}.</div>
      ) : (
        <ul className="cd-history__list">
          {items.map((item, idx) => (
            <HistoryRow
              key={`${item.timestamp}-${idx}`}
              item={item}
              index={idx}
              providersState={providersState}
              onUpdate={updateItem}
              onRemove={removeItem}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function HistoryRow({
  item,
  index,
  providersState,
  onUpdate,
  onRemove,
}: {
  item: HistoryItem;
  index: number;
  providersState: ProvidersState;
  onUpdate: (index: number, patch: Partial<HistoryItem>) => void;
  onRemove: (index: number) => void;
}) {
  const { t } = useTranslation();
  const relativeTime = useRelativeTime();
  const [descEditing, setDescEditing] = useState(false);
  const [descValue, setDescValue] = useState(item.description ?? "");
  const [relaunching, setRelaunching] = useState(false);

  const saveDescription = () => {
    onUpdate(index, { description: descValue });
    setDescEditing(false);
  };

  const handleReopen = async () => {
    setRelaunching(true);
    try {
      let envVars: Record<string, string> | null = null;
      if (item.cliKey === "claude" && item.providerId) {
        const profileExists = providersState.profiles.some(p => p.id === item.providerId);
        if (!profileExists) {
          const ok = window.confirm(t("history.providerGone", { id: item.providerId }));
          if (!ok) { setRelaunching(false); return; }
          const built = buildLaunchEnv(providersState);
          envVars = built ?? null;
        } else {
          const stateWithProvider = setActive(providersState, item.providerId);
          const built = buildLaunchEnv(stateWithProvider);
          envVars = built ?? null;
        }
      }
      await invoke<string>("launch_cli", {
        cliKey: item.cliKey,
        directory: item.directory,
        args: item.args,
        noPerms: true,
        envVars,
      });
      onUpdate(index, { status: "running", duration: undefined });
    } catch {
      onUpdate(index, { status: "error" });
    } finally {
      setRelaunching(false);
    }
  };

  return (
    <li className="cd-history__item">
      <Card>
        <div className="cd-history__row">
          <div className="cd-history__main">
            <div className="cd-history__cli-row">
              <StatusBadge status={item.status} />
              <span className="cd-history__cli">{item.cli}</span>
              <ProviderBadge providerId={item.providerId} profiles={providersState.profiles} />
              {item.duration != null && (
                <span className="cd-history__duration">
                  {formatDuration(item.duration)}
                </span>
              )}
            </div>
            <div className="cd-history__dir" title={item.directory}>
              {truncateDir(item.directory)}
            </div>
            {item.args.trim() && (
              <code className="cd-history__args">{item.args}</code>
            )}
            {descEditing ? (
              <div className="cd-history__desc-edit">
                <input
                  className="cd-history__desc-input"
                  value={descValue}
                  placeholder={t("history.descriptionPlaceholder")}
                  onChange={(e) => setDescValue(e.target.value)}
                  onBlur={saveDescription}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveDescription();
                    if (e.key === "Escape") setDescEditing(false);
                  }}
                  autoFocus
                />
              </div>
            ) : (
              <div
                className={`cd-history__desc ${item.description ? "" : "cd-history__desc--empty"}`}
                onClick={() => {
                  setDescValue(item.description ?? "");
                  setDescEditing(true);
                }}
              >
                {item.description || t("history.addDescription")}
              </div>
            )}
          </div>
          <div className="cd-history__side">
            <time className="cd-history__time" dateTime={item.timestamp}>
              {relativeTime(item.timestamp)}
            </time>
            <div className="cd-history__actions">
              <Button size="sm" loading={relaunching} onClick={handleReopen}>
                {t("history.reopen")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onRemove(index)}>
                ×
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </li>
  );
}
