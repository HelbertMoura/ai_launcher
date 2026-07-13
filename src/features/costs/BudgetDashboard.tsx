// ==============================================================================
// AI Launcher Pro - Budget Dashboard
// Per-provider budget tracking with configurable limits and visual progress bars.
// ==============================================================================

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Banner } from '../../ui/Banner';
import { useUsage } from './useUsage';
import {
  getAllBudgetUsage,
  setBudgetLimit,
  removeBudgetLimit,
  resetBudgetPeriod,
  type BudgetUsage,
} from '../../providers/budget';
import './CostsPage.css';

function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return '$0.00';
  return `$${n.toFixed(2)}`;
}

function progressBarBackground(percent: number, status: BudgetUsage['status']): string {
  const clamped = Math.min(percent, 100);
  const color =
    status === 'exceeded'
      ? 'var(--err)'
      : status === 'warning'
        ? 'var(--warn)'
        : 'var(--ok)';
  return `linear-gradient(to right, ${color} ${clamped}%, var(--surface-1) ${clamped}%)`;
}

// --- Budget Form -------------------------------------------------------------

interface BudgetFormProps {
  initialProviderKey?: string;
  onSave: (providerKey: string, limitUsd: number, periodDays: number) => void;
  onCancel: () => void;
}

function BudgetForm({ initialProviderKey, onSave, onCancel }: BudgetFormProps) {
  const { t } = useTranslation();
  const [providerKey, setProviderKey] = useState(initialProviderKey ?? '');
  const [limitUsd, setLimitUsd] = useState('10');
  const [periodDays, setPeriodDays] = useState('30');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(() => {
    const key = providerKey.trim();
    if (!key) {
      setError(t('costs.budget.providerRequired'));
      return;
    }
    const limit = parseFloat(limitUsd);
    const days = parseInt(periodDays, 10);
    if (!Number.isFinite(limit) || limit <= 0) {
      setError(t('costs.budget.limitInvalid'));
      return;
    }
    if (!Number.isFinite(days) || days < 1) {
      setError(t('costs.budget.periodInvalid'));
      return;
    }
    onSave(key, limit, days);
  }, [providerKey, limitUsd, periodDays, onSave]);

  return (
    <div className="cd-budget__form">
      {error && <Banner variant="err">{error}</Banner>}
      <div className="cd-budget__form-row">
        <label className="cd-budget__form-label">
          {t('costs.budget.provider')}
          <Input
            value={providerKey}
            onChange={(e) => setProviderKey(e.target.value)}
            placeholder={t('costs.budget.providerPlaceholder')}
            disabled={!!initialProviderKey}
          />
        </label>
      </div>
      <div className="cd-budget__form-row">
        <label className="cd-budget__form-label">
          {t('costs.budget.limit')}
          <Input
            type="number"
            value={limitUsd}
            onChange={(e) => setLimitUsd(e.target.value)}
            placeholder="10.00"
            min="0.01"
            step="0.01"
          />
        </label>
        <label className="cd-budget__form-label">
          {t('costs.budget.period')}
          <Input
            type="number"
            value={periodDays}
            onChange={(e) => setPeriodDays(e.target.value)}
            placeholder="30"
            min="1"
          />
        </label>
      </div>
      <div className="cd-budget__form-actions">
        <Button size="sm" onClick={handleSubmit}>{t('common.save')}</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>{t('common.cancel')}</Button>
      </div>
    </div>
  );
}

// --- Budget Bar --------------------------------------------------------------

interface BudgetBarProps {
  usage: BudgetUsage;
  onRemove: (providerKey: string) => void;
  onReset: (providerKey: string) => void;
}

function BudgetBar({ usage, onRemove, onReset }: BudgetBarProps) {
  const { t } = useTranslation();
  const statusLabel =
    usage.status === 'exceeded'
      ? t('costs.budget.statusExceeded')
      : usage.status === 'warning'
        ? t('costs.budget.statusWarning')
        : t('costs.budget.statusOk');

  return (
    <Card className="cd-budget__bar">
      <div className="cd-budget__bar-header">
        <span className="cd-budget__bar-name">{usage.providerKey}</span>
        <span className={`cd-budget__bar-status cd-budget__bar-status--${usage.status}`}>
          {statusLabel}
        </span>
      </div>
      <div className="cd-budget__bar-track" style={{ background: progressBarBackground(usage.percentUsed, usage.status) }}>
        <div className="cd-budget__bar-fill-info">
          {formatUsd(usage.usedUsd)} / {formatUsd(usage.limitUsd)}
        </div>
      </div>
      <div className="cd-budget__bar-meta">
        <span>{t('costs.budget.percentUsed', { value: usage.percentUsed.toFixed(1) })}</span>
        <span>{t('costs.budget.periodRange', { start: usage.periodStart, end: usage.periodEnd })}</span>
      </div>
      <div className="cd-budget__bar-actions">
        <Button size="sm" variant="ghost" onClick={() => onReset(usage.providerKey)}>
          {t('costs.budget.reset')}
        </Button>
        <Button size="sm" variant="danger" onClick={() => onRemove(usage.providerKey)}>
          {t('costs.budget.remove')}
        </Button>
      </div>
    </Card>
  );
}

// --- Main Dashboard ----------------------------------------------------------

export function BudgetDashboard() {
  const { t } = useTranslation();
  const { report } = useUsage();
  const entries = report?.entries ?? [];
  const [showForm, setShowForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const budgetUsages = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    refreshKey; // depend on refreshKey to recompute after mutations
    return getAllBudgetUsage(entries);
  }, [entries, refreshKey]);

  const handleSave = useCallback(
    (providerKey: string, limitUsd: number, periodDays: number) => {
      setBudgetLimit(providerKey, limitUsd, periodDays);
      setShowForm(false);
      setRefreshKey((k) => k + 1);
    },
    [],
  );

  const handleRemove = useCallback((providerKey: string) => {
    removeBudgetLimit(providerKey);
    setRefreshKey((k) => k + 1);
  }, []);

  const handleReset = useCallback((providerKey: string) => {
    // Re-anchor the tracking period to today so spend counts fresh from now.
    // Usage entries come from the read-only backend and are never mutated.
    resetBudgetPeriod(providerKey);
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="cd-budget">
      <h2 className="cd-costs__section">{t('costs.budget.title')}</h2>

      {budgetUsages.length > 0 && (
        <div className="cd-budget__list">
          {budgetUsages.map((usage) => (
            <BudgetBar
              key={usage.providerKey}
              usage={usage}
              onRemove={handleRemove}
              onReset={handleReset}
            />
          ))}
        </div>
      )}

      {budgetUsages.length === 0 && !showForm && (
        <Card className="cd-budget__empty">
          <p className="cd-budget__empty-text">{t('costs.budget.empty')}</p>
          <Button size="sm" onClick={() => setShowForm(true)}>
            {t('costs.budget.add')}
          </Button>
        </Card>
      )}

      {showForm && (
        <Card className="cd-budget__form-card">
          <BudgetForm
            onSave={handleSave}
            onCancel={() => setShowForm(false)}
          />
        </Card>
      )}

      {!showForm && budgetUsages.length > 0 && (
        <Button size="sm" onClick={() => setShowForm(true)} className="cd-budget__add-btn">
          {t('costs.budget.add')}
        </Button>
      )}
    </div>
  );
}
