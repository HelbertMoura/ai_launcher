import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import { useHistory, type HistoryItem, type SessionStatus } from "./useHistory";
import { buildLaunchEnvAsync, loadProviders, setActive } from "../../providers/storage";
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

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function StatusBadge({ status }: { status: SessionStatus }) {
  switch (status) {
    case "starting":
      return <span className="cd-history__status cd-history__status--starting" title="Starting" aria-label="Starting">●</span>;
    case "running":
      return <span className="cd-history__status cd-history__status--running" title="Running" aria-label="Running">●</span>;
    case "completed":
      return <span className="cd-history__status cd-history__status--completed" title="Completed" aria-label="Completed">✓</span>;
    case "failed":
      return <span className="cd-history__status cd-history__status--failed" title="Failed" aria-label="Failed">✗</span>;
    case "unknown":
    default:
      return <span className="cd-history__status cd-history__status--unknown" title="Unknown" aria-label="Unknown">?</span>;
  }
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

  const [filterCli, setFilterCli] = useState<string>("all");
  const [filterProvider, setFilterProvider] = useState<string>("all");
  const [filterRange, setFilterRange] = useState<"today" | "week" | "month" | "all">("all");
  const [confirmClear, setConfirmClear] = useState(false);

  const distinctClis = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) if (it.cliKey) set.add(it.cliKey);
    return Array.from(set);
  }, [items]);

  const distinctProviders = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) if (it.providerId) set.add(it.providerId);
    return Array.from(set);
  }, [items]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const msPerDay = 24 * 60 * 60 * 1000;
    const cutoff: Record<string, number> = {
      today: now - msPerDay,
      week: now - 7 * msPerDay,
      month: now - 30 * msPerDay,
    };
    return items.filter((it) => {
      if (filterCli !== "all" && it.cliKey !== filterCli) return false;
      if (filterProvider !== "all") {
        if ((it.providerId ?? "") !== filterProvider) return false;
      }
      if (filterRange !== "all") {
        const t = Date.parse(it.timestamp);
        if (isNaN(t) || t < cutoff[filterRange]) return false;
      }
      return true;
    });
  }, [items, filterCli, filterProvider, filterRange]);

  const hasActiveFilters =
    filterCli !== "all" || filterProvider !== "all" || filterRange !== "all";
  const clearFilters = () => {
    setFilterCli("all");
    setFilterProvider("all");
    setFilterRange("all");
  };

  const onClear = () => {
    if (items.length === 0) return;
    setConfirmClear(true);
  };

  const confirmClearHistory = () => {
    clear();
    setConfirmClear(false);
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
        <>
          <div className="cd-history__filters">
            <select
              className="cd-history__filter-select"
              value={filterCli}
              onChange={(e) => setFilterCli(e.target.value)}
            >
              <option value="all">{t("history.filter.allClis")}</option>
              {distinctClis.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>

            <select
              className="cd-history__filter-select"
              value={filterProvider}
              onChange={(e) => setFilterProvider(e.target.value)}
            >
              <option value="all">{t("history.filter.allProviders")}</option>
              {distinctProviders.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>

            <select
              className="cd-history__filter-select"
              value={filterRange}
              onChange={(e) => setFilterRange(e.target.value as typeof filterRange)}
            >
              <option value="all">{t("history.filter.all")}</option>
              <option value="today">{t("history.filter.today")}</option>
              <option value="week">{t("history.filter.week")}</option>
              <option value="month">{t("history.filter.month")}</option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                className="cd-history__filter-clear"
                onClick={clearFilters}
              >
                {t("history.filter.clear")}
              </button>
            )}

            <span className="cd-history__filter-count">
              {t("history.filter.countLabel", { count: filtered.length, total: items.length })}
            </span>
          </div>

          <ul className="cd-history__list">
            {filtered.map((item, idx) => (
              <HistoryRow
                key={`${item.timestamp}-${idx}`}
                item={item}
                index={items.indexOf(item)}
                providersState={providersState}
                onUpdate={updateItem}
                onRemove={removeItem}
              />
            ))}
          </ul>
        </>
      )}

      <ConfirmDialog
        open={confirmClear}
        variant="danger"
        title={t("history.clearTitle", "Clear History")}
        message={t("history.clearConfirm")}
        confirmLabel={t("history.clear", "Clear")}
        onConfirm={confirmClearHistory}
        onCancel={() => setConfirmClear(false)}
      />
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
  const [confirmProviderGone, setConfirmProviderGone] = useState(false);

  const saveDescription = () => {
    onUpdate(index, { description: descValue });
    setDescEditing(false);
  };

  const doReopen = async () => {
    setRelaunching(true);
    try {
      let envVars: Record<string, string> | null = null;
      if (item.cliKey === "claude" && item.providerId) {
        const profileExists = providersState.profiles.some(p => p.id === item.providerId);
        if (!profileExists) {
          const built = await buildLaunchEnvAsync(providersState);
          envVars = built ?? null;
        } else {
          const stateWithProvider = setActive(providersState, item.providerId);
          const built = await buildLaunchEnvAsync(stateWithProvider);
          envVars = built ?? null;
        }
      }
      const result = await invoke<{ session_id: string; message: string }>("launch_cli", {
        cliKey: item.cliKey,
        directory: item.directory,
        args: item.args,
        noPerms: true,
        envVars,
      });
      const now = new Date().toISOString();
      onUpdate(index, {
        status: "starting",
        sessionId: result.session_id,
        startedAt: now,
        completedAt: undefined,
        duration: undefined,
        exitCode: undefined,
        errorMessage: undefined,
      });
    } catch {
      const now = new Date().toISOString();
      onUpdate(index, {
        status: "failed",
        startedAt: now,
        completedAt: now,
        duration: 0,
      });
    } finally {
      setRelaunching(false);
    }
  };

  const handleReopen = () => {
    if (item.cliKey === "claude" && item.providerId) {
      const profileExists = providersState.profiles.some(p => p.id === item.providerId);
      if (!profileExists) {
        setConfirmProviderGone(true);
        return;
      }
    }
    void doReopen();
  };

  const confirmProviderGoneReopen = () => {
    setConfirmProviderGone(false);
    void doReopen();
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
              {item.duration != null && item.duration > 0 && (
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
            {item.status === "failed" && item.errorMessage && (
              <div className="cd-history__error" title={item.errorMessage}>
                {item.errorMessage.length > 80
                  ? `${item.errorMessage.slice(0, 77)}...`
                  : item.errorMessage}
              </div>
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
              <Button size="sm" variant="ghost" onClick={() => onRemove(index)} aria-label={t("common.remove", "Remove")}>
                ×
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmProviderGone}
        variant="danger"
        title={t("history.providerGoneTitle", "Provider Unavailable")}
        message={t("history.providerGone", { id: item.providerId })}
        confirmLabel={t("history.reopen", "Reopen")}
        onConfirm={confirmProviderGoneReopen}
        onCancel={() => {
          setConfirmProviderGone(false);
          setRelaunching(false);
        }}
      />
    </li>
  );
}
