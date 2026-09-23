// ==============================================================================
// AI Launcher Pro - Budget Dashboard (Cost Governance 3.0, wave 3d)
// Providers | Projects tabs (WAI-ARIA tablist, arrow-key navigation). The
// Providers tab preserves the pre-3d behavior exactly (rolling-window limits);
// the Projects tab manages calendar-month quotas (D1) scoped by canonical
// project keys. Every budget bar is an ARIA progressbar (gate condition 8).
// ==============================================================================

import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Banner } from '../../ui/Banner';
import { useUsageEntries } from './usageStore';
import { resolveProjectKey } from './reconcile';
import { loadWorkspaces } from '../workspace/workspaceStore';
import {
  getAllBudgetUsage,
  getBudgetLimits,
  removeBudgetLimit,
  removeProjectBudgetLimit,
  resetBudgetPeriod,
  setBudgetLimit,
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

// --- Budget Tabs -------------------------------------------------------------

type BudgetTab = 'providers' | 'projects';

const BUDGET_TABS: BudgetTab[] = ['providers', 'projects'];

const TAB_IDS: Record<BudgetTab, string> = {
  providers: 'cd-budget-tab-providers',
  projects: 'cd-budget-tab-projects',
};

const PANEL_IDS: Record<BudgetTab, string> = {
  providers: 'cd-budget-panel-providers',
  projects: 'cd-budget-panel-projects',
};

// --- Budget Form (providers, unchanged behavior) -----------------------------

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
  }, [providerKey, limitUsd, periodDays, onSave, t]);

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

// --- Project Budget Form (calendar-month, D1) --------------------------------

interface ProjectOption {
  key: string;
  name: string;
}

interface ProjectBudgetFormProps {
  projects: ProjectOption[];
  onSave: (projectKey: string, displayName: string, limitUsd: number, alertAtPercent: number) => void;
  onCancel: () => void;
}

function ProjectBudgetForm({ projects, onSave, onCancel }: ProjectBudgetFormProps) {
  const { t } = useTranslation();
  const [projectKey, setProjectKey] = useState('');
  const [limitUsd, setLimitUsd] = useState('10');
  const [alertAt, setAlertAt] = useState('80');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(() => {
    const project = projects.find((p) => p.key === projectKey);
    if (!project) {
      setError(t('costs.budget.projectRequired'));
      return;
    }
    const limit = parseFloat(limitUsd);
    if (!Number.isFinite(limit) || limit <= 0) {
      setError(t('costs.budget.limitInvalid'));
      return;
    }
    const alert = parseInt(alertAt, 10);
    if (!Number.isFinite(alert) || alert < 1 || alert > 100) {
      setError(t('costs.budget.alertAtInvalid'));
      return;
    }
    onSave(project.key, project.name, limit, alert);
  }, [projects, projectKey, limitUsd, alertAt, onSave, t]);

  return (
    <div className="cd-budget__form">
      {error && <Banner variant="err">{error}</Banner>}
      <div className="cd-budget__form-row">
        <label className="cd-budget__form-label">
          {t('costs.budget.project')}
          {/* aria-label wins over the wrapping label, whose accessible text
              would otherwise include every <option> (native select quirk). */}
          <select
            className="cd-budget__form-select"
            aria-label={t('costs.budget.project')}
            value={projectKey}
            onChange={(e) => setProjectKey(e.target.value)}
          >
            <option value="">{t('costs.budget.projectPlaceholder')}</option>
            {projects.map((p) => (
              <option key={p.key} value={p.key}>{p.name}</option>
            ))}
          </select>
        </label>
        <label className="cd-budget__form-label">
          {t('costs.budget.periodMonthlyLabel')}
          <span className="cd-budget__form-static">{t('costs.budget.periodMonthly')}</span>
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
          {t('costs.budget.alertAt')}
          <Input
            type="number"
            value={alertAt}
            onChange={(e) => setAlertAt(e.target.value)}
            placeholder="80"
            min="1"
            max="100"
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
  /** Shown name: providerKey for providers, reconciled displayName for projects. */
  name: string;
  /** Overrides the "{{start}} to {{end}}" range (calendar-month rows, D1). */
  periodLabel?: string;
  onRemove?: () => void;
  onReset?: () => void;
}

function BudgetBar({ usage, name, periodLabel, onRemove, onReset }: BudgetBarProps) {
  const { t } = useTranslation();
  const statusLabel =
    usage.status === 'exceeded'
      ? t('costs.budget.statusExceeded')
      : usage.status === 'warning'
        ? t('costs.budget.statusWarning')
        : t('costs.budget.statusOk');
  const clampedPercent = Math.min(100, usage.percentUsed);

  return (
    <Card className="cd-budget__bar">
      <div className="cd-budget__bar-header">
        <span className="cd-budget__bar-name">{name}</span>
        <span className={`cd-budget__bar-status cd-budget__bar-status--${usage.status}`}>
          {statusLabel}
        </span>
      </div>
      <div
        className="cd-budget__bar-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clampedPercent)}
        aria-label={t('costs.budget.barLabel', { name, value: usage.percentUsed.toFixed(1) })}
        style={{ background: progressBarBackground(usage.percentUsed, usage.status) }}
      >
        <div className="cd-budget__bar-fill-info">
          {formatUsd(usage.usedUsd)} / {formatUsd(usage.limitUsd)}
        </div>
      </div>
      <div className="cd-budget__bar-meta">
        <span>{t('costs.budget.percentUsed', { value: usage.percentUsed.toFixed(1) })}</span>
        <span>
          {periodLabel ??
            t('costs.budget.periodRange', { start: usage.periodStart, end: usage.periodEnd })}
        </span>
      </div>
      {(onReset || onRemove) && (
        <div className="cd-budget__bar-actions">
          {onReset && (
            <Button size="sm" variant="ghost" onClick={onReset}>
              {t('costs.budget.reset')}
            </Button>
          )}
          {onRemove && (
            <Button size="sm" variant="danger" onClick={onRemove}>
              {t('costs.budget.remove')}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

// --- Main Dashboard ----------------------------------------------------------

export function BudgetDashboard() {
  const { t } = useTranslation();
  const entries = useUsageEntries();
  const [tab, setTab] = useState<BudgetTab>('providers');
  const [showProviderForm, setShowProviderForm] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const tabsRef = useRef<HTMLDivElement>(null);

  // Workspaces drive project reconciliation (D5); re-read with usage changes.
  const workspaces = useMemo(() => loadWorkspaces(), [entries]);

  const providerUsages = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    refreshKey; // depend on refreshKey to recompute after mutations
    return getAllBudgetUsage(entries, workspaces).filter((u) => u.scope.kind === 'provider');
  }, [entries, workspaces, refreshKey]);

  const projectUsages = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    refreshKey; // depend on refreshKey to recompute after mutations
    return getAllBudgetUsage(entries, workspaces).filter((u) => u.scope.kind === 'project');
  }, [entries, workspaces, refreshKey]);

  /** Limits carry the stable displayName chosen at creation time. */
  const projectNameByKey = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    refreshKey;
    const map = new Map<string, string>();
    for (const limit of getBudgetLimits()) {
      if (limit.scope.kind === 'project') map.set(limit.scope.projectKey, limit.scope.displayName);
    }
    return map;
  }, [refreshKey]);

  /** Reconciled usage projects (dedupe by canonical key) for the form dropdown. */
  const projectOptions = useMemo<ProjectOption[]>(() => {
    const seen = new Map<string, string>();
    for (const e of entries) {
      const rec = resolveProjectKey(
        { project: e.project, projectPath: e.project_path },
        workspaces,
      );
      if (!rec || seen.has(rec.key)) continue;
      seen.set(rec.key, rec.displayName);
    }
    return [...seen.entries()]
      .map(([key, name]) => ({ key, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entries, workspaces]);

  const handleTabKeys = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const idx = BUDGET_TABS.indexOf(tab);
      let next: number | null = null;
      if (e.key === 'ArrowRight') next = (idx + 1) % BUDGET_TABS.length;
      else if (e.key === 'ArrowLeft') next = (idx - 1 + BUDGET_TABS.length) % BUDGET_TABS.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = BUDGET_TABS.length - 1;
      if (next === null) return;
      e.preventDefault();
      setTab(BUDGET_TABS[next]);
      const buttons = tabsRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      buttons?.[next]?.focus();
    },
    [tab],
  );

  const handleSave = useCallback(
    (providerKey: string, limitUsd: number, periodDays: number) => {
      setBudgetLimit(providerKey, limitUsd, periodDays);
      setShowProviderForm(false);
      setRefreshKey((k) => k + 1);
    },
    [],
  );

  const handleSaveProject = useCallback(
    (projectKey: string, displayName: string, limitUsd: number, alertAtPercent: number) => {
      setBudgetLimit({ kind: 'project', projectKey, displayName }, limitUsd, alertAtPercent);
      setShowProjectForm(false);
      setRefreshKey((k) => k + 1);
    },
    [],
  );

  const handleRemove = useCallback((providerKey: string) => {
    removeBudgetLimit(providerKey);
    setRefreshKey((k) => k + 1);
  }, []);

  const handleRemoveProject = useCallback((projectKey: string) => {
    removeProjectBudgetLimit(projectKey);
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

      <div
        ref={tabsRef}
        className="cd-budget__tabs"
        role="tablist"
        aria-label={t('costs.budget.tabsLabel')}
        onKeyDown={handleTabKeys}
      >
        {BUDGET_TABS.map((tabId) => (
          <button
            key={tabId}
            type="button"
            role="tab"
            id={TAB_IDS[tabId]}
            aria-selected={tab === tabId}
            aria-controls={PANEL_IDS[tabId]}
            tabIndex={tab === tabId ? 0 : -1}
            className="cd-budget__tab"
            onClick={() => setTab(tabId)}
          >
            {t(`costs.budget.tab${tabId === 'providers' ? 'Providers' : 'Projects'}`)}
          </button>
        ))}
      </div>

      {tab === 'providers' && (
        <div
          role="tabpanel"
          id={PANEL_IDS.providers}
          aria-labelledby={TAB_IDS.providers}
          className="cd-budget__panel"
        >
          {providerUsages.length > 0 && (
            <div className="cd-budget__list">
              {providerUsages.map((usage) => (
                <BudgetBar
                  key={usage.providerKey}
                  usage={usage}
                  name={usage.providerKey}
                  onRemove={() => handleRemove(usage.providerKey)}
                  onReset={() => handleReset(usage.providerKey)}
                />
              ))}
            </div>
          )}

          {providerUsages.length === 0 && !showProviderForm && (
            <Card className="cd-budget__empty">
              <p className="cd-budget__empty-text">{t('costs.budget.empty')}</p>
              <Button size="sm" onClick={() => setShowProviderForm(true)}>
                {t('costs.budget.add')}
              </Button>
            </Card>
          )}

          {showProviderForm && (
            <Card className="cd-budget__form-card">
              <BudgetForm
                onSave={handleSave}
                onCancel={() => setShowProviderForm(false)}
              />
            </Card>
          )}

          {!showProviderForm && providerUsages.length > 0 && (
            <Button size="sm" onClick={() => setShowProviderForm(true)} className="cd-budget__add-btn">
              {t('costs.budget.add')}
            </Button>
          )}
        </div>
      )}

      {tab === 'projects' && (
        <div
          role="tabpanel"
          id={PANEL_IDS.projects}
          aria-labelledby={TAB_IDS.projects}
          className="cd-budget__panel"
        >
          {projectUsages.length > 0 && (
            <div className="cd-budget__list">
              {projectUsages.map((usage) => {
                const key = usage.scope.kind === 'project' ? usage.scope.projectKey : usage.providerKey;
                return (
                  <BudgetBar
                    key={key}
                    usage={usage}
                    name={projectNameByKey.get(key) ?? key}
                    periodLabel={t('costs.budget.periodMonthly')}
                    onRemove={() => handleRemoveProject(key)}
                  />
                );
              })}
            </div>
          )}

          {projectUsages.length === 0 && !showProjectForm && (
            <Card className="cd-budget__empty">
              <p className="cd-budget__empty-text">
                {projectOptions.length === 0
                  ? t('costs.budget.noProjects')
                  : t('costs.budget.empty')}
              </p>
              {projectOptions.length > 0 && (
                <Button size="sm" onClick={() => setShowProjectForm(true)}>
                  {t('costs.budget.add')}
                </Button>
              )}
            </Card>
          )}

          {showProjectForm && (
            <Card className="cd-budget__form-card">
              <ProjectBudgetForm
                projects={projectOptions}
                onSave={handleSaveProject}
                onCancel={() => setShowProjectForm(false)}
              />
            </Card>
          )}

          {!showProjectForm && projectUsages.length > 0 && (
            <Button size="sm" onClick={() => setShowProjectForm(true)} className="cd-budget__add-btn">
              {t('costs.budget.add')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
