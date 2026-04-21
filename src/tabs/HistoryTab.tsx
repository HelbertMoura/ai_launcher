// ==============================================================================
// AI Launcher Pro - HistoryTab
// v5.5 Terminal Dramático — git-log style timeline
// ==============================================================================

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Copy } from '../icons';
import type { LaunchProviderInfo } from '../providers/types';
import './HistoryTab.css';

interface HistoryItem {
  cli: string;
  cliKey: string;
  directory: string;
  args: string;
  timestamp: string;
  provider?: LaunchProviderInfo;
}

export interface HistoryTabProps {
  history: HistoryItem[];
  clearHistory: () => void;
  relaunchFromHistory: (item: HistoryItem) => void;
}

function entryKey(item: HistoryItem): string {
  return `${item.timestamp}|${item.cliKey}|${item.directory}`;
}

export function HistoryTab({ history, clearHistory, relaunchFromHistory }: HistoryTabProps) {
  const { t } = useTranslation();
  const [cliFilter, setCliFilter] = useState<Set<string>>(new Set());
  const [providerFilter, setProviderFilter] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const uniqueClis = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of history) {
      if (!map.has(item.cliKey)) map.set(item.cliKey, item.cli);
    }
    return Array.from(map, ([key, label]) => ({ key, label }));
  }, [history]);

  const uniqueProviders = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of history) {
      if (item.provider && !map.has(item.provider.providerId)) {
        map.set(item.provider.providerId, item.provider.providerName);
      }
    }
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [history]);

  const filtered = useMemo(
    () =>
      history.filter(
        (item) =>
          (cliFilter.size === 0 || cliFilter.has(item.cliKey)) &&
          (providerFilter === '' || item.provider?.providerId === providerFilter),
      ),
    [history, cliFilter, providerFilter],
  );

  function toggleCli(key: string) {
    setCliFilter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function copyArgs(item: HistoryItem) {
    const key = entryKey(item);
    try {
      await navigator.clipboard.writeText(item.args);
      setCopiedKey(key);
    } catch {
      setCopiedKey(`${key}::failed`);
    }
    setTimeout(() => setCopiedKey((prev) => (prev && prev.startsWith(key) ? null : prev)), 1500);
  }

  function clearFilters() {
    setCliFilter(new Set());
    setProviderFilter('');
  }

  const filtersActive = cliFilter.size > 0 || providerFilter !== '';

  return (
    <div className="tab-scroll">
      <div className="tab-pad">
        <div className="history-filters">
          <div className="history-filter-group" role="group" aria-label={t('history.filterByCli')}>
            {uniqueClis.length === 0 ? (
              <span className="history-filter-hint">{t('history.filterEmpty')}</span>
            ) : uniqueClis.map(({ key, label }) => {
              const active = cliFilter.has(key);
              return (
                <button key={key} type="button"
                        className={`history-filter-chip${active ? ' is-active' : ''}`}
                        aria-pressed={active} onClick={() => toggleCli(key)}>
                  {label}
                </button>
              );
            })}
          </div>
          {uniqueProviders.length > 0 && (
            <label className="history-filter-label">
              <span className="history-filter-label__text">{t('history.providerLabel')}</span>
              <select className="history-filter-select" value={providerFilter}
                      onChange={(e) => setProviderFilter(e.target.value)}>
                <option value="">{t('history.providerAll')}</option>
                {uniqueProviders.map(({ id, name }) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            </label>
          )}
          {history.length > 0 && (
            <button type="button" className="history-clear-btn"
                    onClick={clearHistory} aria-label={t('history.clearAllLabel')}>
              {t('history.clearAll')}
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="history-empty">
            <p>
              {history.length === 0
                ? t('history.empty')
                : t('history.emptyFiltered')}
            </p>
            {filtersActive && (
              <button type="button" className="history-empty__action" onClick={clearFilters}>
                {t('history.clearFilters')}
              </button>
            )}
          </div>
        ) : (
          <ol className="history-timeline">
            {filtered.map((item) => {
              const providerClass = item.provider ? ` kind-${item.provider.providerKind}` : '';
              const key = entryKey(item);
              const copyState =
                copiedKey === key ? 'copied' : copiedKey === `${key}::failed` ? 'failed' : 'idle';
              return (
                <li key={key} className="history-entry">
                  <span className="history-entry__marker" aria-hidden="true">●</span>
                  <div className="history-entry__body">
                    <header className="history-entry__head">
                      <span className="history-entry__prompt" aria-hidden="true">&gt;</span>
                      <strong className="history-entry__cli">{item.cli}</strong>
                      <span className={`history-entry__provider${providerClass}`}>
                        @ {item.provider?.providerName ?? t('history.providerDefault')}
                      </span>
                      <time className="history-entry__time">{item.timestamp}</time>
                    </header>
                    {item.directory && (
                      <code className="history-entry__dir" title={item.directory}>{item.directory}</code>
                    )}
                    {item.args && (
                      <code className="history-entry__args" title={item.args}>{item.args}</code>
                    )}
                    <div className="history-entry__actions">
                      <button type="button" className="history-entry__action"
                              onClick={() => relaunchFromHistory(item)}
                              aria-label={t('history.reRunLabel', { name: item.cli })}>
                        <RefreshCw size={12} /><span>{t('history.reRun')}</span>
                      </button>
                      {item.args && (
                        <button type="button" className="history-entry__action"
                                onClick={() => copyArgs(item)}
                                aria-label={t('history.copyArgsLabel', { name: item.cli })}>
                          <Copy size={12} />
                          <span>
                            {copyState === 'copied'
                              ? t('history.copied')
                              : copyState === 'failed'
                                ? t('history.failed')
                                : t('history.copyArgs')}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
