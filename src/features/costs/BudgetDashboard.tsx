// ==============================================================================
// AI Launcher Pro - Budget Dashboard
// Per-provider budget tracking with configurable limits and visual progress bars.
// ==============================================================================

import { useCallback, useMemo, useState } from 'react';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Banner } from '../../ui/Banner';
import { useUsage } from './useUsage';
import {
  getAllBudgetUsage,
  setBudgetLimit,
  removeBudgetLimit,
  type BudgetUsage,
} from '../../providers/budget';
import './CostsPage.css';

function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return '$0.00';
  return `$${n.toFixed(2)}`;
}

function statusColor(status: BudgetUsage['status']): string {
  switch (status) {
    case 'exceeded':
      return '#e53e3e';
    case 'warning':
      return '#d69e2e';
    default:
      return '#48bb78';
  }
}

function progressBarBackground(percent: number, status: BudgetUsage['status']): string {
  const clamped = Math.min(percent, 100);
  const color = statusColor(status);
  return `linear-gradient(to right, ${color} ${clamped}%, var(--surface-1) ${clamped}%)`;
}

// --- Budget Form -------------------------------------------------------------

interface BudgetFormProps {
  initialProviderKey?: string;
  onSave: (providerKey: string, limitUsd: number, periodDays: number) => void;
  onCancel: () => void;
}

function BudgetForm({ initialProviderKey, onSave, onCancel }: BudgetFormProps) {
  const [providerKey, setProviderKey] = useState(initialProviderKey ?? '');
  const [limitUsd, setLimitUsd] = useState('10');
  const [periodDays, setPeriodDays] = useState('30');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(() => {
    const key = providerKey.trim();
    if (!key) {
      setError('Provider name is required');
      return;
    }
    const limit = parseFloat(limitUsd);
    const days = parseInt(periodDays, 10);
    if (!Number.isFinite(limit) || limit <= 0) {
      setError('Limit must be a positive number');
      return;
    }
    if (!Number.isFinite(days) || days < 1) {
      setError('Period must be at least 1 day');
      return;
    }
    onSave(key, limit, days);
  }, [providerKey, limitUsd, periodDays, onSave]);

  return (
    <div className="cd-budget__form">
      {error && <Banner variant="err">{error}</Banner>}
      <div className="cd-budget__form-row">
        <label className="cd-budget__form-label">
          Provider
          <Input
            value={providerKey}
            onChange={(e) => setProviderKey(e.target.value)}
            placeholder="e.g. anthropic, zai"
            disabled={!!initialProviderKey}
          />
        </label>
      </div>
      <div className="cd-budget__form-row">
        <label className="cd-budget__form-label">
          Limit (USD)
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
          Period (days)
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
        <Button size="sm" onClick={handleSubmit}>Save</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
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
  return (
    <Card className="cd-budget__bar">
      <div className="cd-budget__bar-header">
        <span className="cd-budget__bar-name">{usage.providerKey}</span>
        <span className="cd-budget__bar-status" style={{ color: statusColor(usage.status) }}>
          {usage.status === 'exceeded' ? 'OVER LIMIT' : usage.status === 'warning' ? 'WARNING' : 'OK'}
        </span>
      </div>
      <div className="cd-budget__bar-track" style={{ background: progressBarBackground(usage.percentUsed, usage.status) }}>
        <div className="cd-budget__bar-fill-info">
          {formatUsd(usage.usedUsd)} / {formatUsd(usage.limitUsd)}
        </div>
      </div>
      <div className="cd-budget__bar-meta">
        <span>{usage.percentUsed.toFixed(1)}% used</span>
        <span>{usage.periodStart} to {usage.periodEnd}</span>
      </div>
      <div className="cd-budget__bar-actions">
        <Button size="sm" variant="ghost" onClick={() => onReset(usage.providerKey)}>
          Reset
        </Button>
        <Button size="sm" variant="danger" onClick={() => onRemove(usage.providerKey)}>
          Remove
        </Button>
      </div>
    </Card>
  );
}

// --- Main Dashboard ----------------------------------------------------------

export function BudgetDashboard() {
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
    const usages = getAllBudgetUsage(entries);
    const usage = usages.find((u) => u.providerKey === providerKey);
    if (usage) {
      setBudgetLimit(providerKey, usage.limitUsd, usage.limitUsd > 0 ? 30 : 30);
    }
    setRefreshKey((k) => k + 1);
  }, [entries]);

  return (
    <div className="cd-budget">
      <h3 className="cd-costs__section">Budget Guard</h3>

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
          <p className="cd-budget__empty-text">No budget limits configured.</p>
          <Button size="sm" onClick={() => setShowForm(true)}>
            Add Budget Limit
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
          + Add Budget Limit
        </Button>
      )}
    </div>
  );
}
