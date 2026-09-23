// ==============================================================================
// AI Launcher Pro - Provider & Project Budget Guard (Cost Governance 3.0)
// Spending limits per provider (rolling window, pre-v3 behavior) and per
// project (calendar month, D1), with period-based tracking. All data stays
// local. Persisted under the SAME `ai-launcher:v15:budget` key, storage
// schema v3 — the v15 -> v3 migration runs loss-less on this read-path
// (gate condition 1) and on old-backup imports via the registry entry.
// ==============================================================================

import type { BudgetLimitV3, BudgetPeriod, UsageEntry } from '../features/costs/types';
import { normalizeBudgetLimits, stableBudgetLimitId } from '../features/costs/types';
import { resolveProjectKey } from '../features/costs/reconcile';
import type { WorkspaceProfile } from '../domain/types';
import { readKey, removeKey, writeKey } from '../lib/storage';

// --- Types -------------------------------------------------------------------

export type { BudgetLimitV3, BudgetPeriod };

/** Scope reference carried on usages/alerts so the UI can namespace ids (3d). */
export type BudgetScopeRef =
  | { kind: 'provider'; providerKey: string }
  | { kind: 'project'; projectKey: string };

export interface BudgetUsage {
  scope: BudgetScopeRef;
  /**
   * Legacy flat key (pre-3c consumers): the providerKey for provider scope,
   * the projectKey for project scope. Prefer `scope` in new code.
   */
  providerKey: string;
  periodKind: BudgetPeriod['kind'];
  usedUsd: number;
  periodStart: string;
  periodEnd: string;
  limitUsd: number;
  percentUsed: number;
  status: 'ok' | 'warning' | 'exceeded';
}

export interface BudgetAlert {
  scope: BudgetScopeRef;
  /** Legacy flat key — same value as the scope's key (see BudgetUsage). */
  providerKey: string;
  periodKind: BudgetPeriod['kind'];
  usedUsd: number;
  limitUsd: number;
  percentUsed: number;
  status: 'warning' | 'exceeded';
}

// --- Storage -----------------------------------------------------------------

interface BudgetStore {
  limits: BudgetLimitV3[];
}

function loadStore(): BudgetStore {
  const parsed = readKey('budget') as unknown;
  const limitsRaw = (parsed as { limits?: unknown } | null)?.limits;
  // v15 entries are migrated here (loss-less, before strict v3 validation);
  // only truly corrupt entries are dropped, always with a console.warn.
  return { limits: normalizeBudgetLimits(limitsRaw, todayISO()) };
}

function saveStore(store: BudgetStore): void {
  writeKey('budget', store);
}

// --- Helpers -----------------------------------------------------------------

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function computeStatus(percentUsed: number, alertAtPercent: number): 'ok' | 'warning' | 'exceeded' {
  if (percentUsed >= 100) return 'exceeded';
  if (percentUsed >= alertAtPercent) return 'warning';
  return 'ok';
}

/**
 * The provider a usage entry should be billed against. The backend (T1) sends
 * `provider`; the cli->provider mapping is not 1:1 (several providers run via
 * `claude` with env vars), so we trust `provider` first and fall back to `cli`
 * for legacy entries that predate the field.
 */
function entryProvider(entry: UsageEntry): string {
  return entry.provider ?? entry.cli;
}

/** Key that identifies a limit within its scope (upsert/alert lookups). */
function scopeKeyOf(limit: BudgetLimitV3): string {
  return limit.scope.kind === 'provider' ? limit.scope.providerKey : limit.scope.projectKey;
}

/**
 * Start of the limit's tracking window. Rolling: explicit anchor if set, else
 * the rolling window (exact pre-v3 date math preserved). Calendar-month (D1):
 * the first day of the current month.
 */
function periodStartFor(limit: BudgetLimitV3, today: string): string {
  if (limit.period.kind === 'calendar-month') return `${today.slice(0, 7)}-01`;
  return limit.period.anchor ?? dateDaysAgo(limit.period.days);
}

/**
 * Sum spend for a single provider within [periodStart, periodEnd]. Only entries
 * whose resolved provider matches `providerKey` are counted, so one provider's
 * limit never consumes another's budget.
 */
function sumProviderSpend(
  entries: UsageEntry[],
  providerKey: string,
  periodStart: string,
  periodEnd: string,
): number {
  return entries
    .filter(
      (e) =>
        entryProvider(e) === providerKey &&
        e.date >= periodStart &&
        e.date <= periodEnd,
    )
    .reduce((sum, e) => sum + e.cost_estimate_usd, 0);
}

/**
 * Sum spend attributed to a project scope within [periodStart, periodEnd]:
 * every entry whose reconciled project key (D5) matches the limit's key.
 */
function sumProjectSpend(
  entries: UsageEntry[],
  projectKey: string,
  workspaces: WorkspaceProfile[],
  periodStart: string,
  periodEnd: string,
): number {
  return entries
    .filter((e) => {
      if (e.date < periodStart || e.date > periodEnd) return false;
      // UsageEntry carries the wire field `project_path`; reconcile expects
      // the camelCase shape from the design contract.
      return resolveProjectKey({ project: e.project, projectPath: e.project_path }, workspaces)?.key === projectKey;
    })
    .reduce((sum, e) => sum + e.cost_estimate_usd, 0);
}

function sumScopeSpend(
  entries: UsageEntry[],
  limit: BudgetLimitV3,
  workspaces: WorkspaceProfile[],
  periodStart: string,
  periodEnd: string,
): number {
  if (limit.scope.kind === 'provider') {
    return sumProviderSpend(entries, limit.scope.providerKey, periodStart, periodEnd);
  }
  return sumProjectSpend(entries, limit.scope.projectKey, workspaces, periodStart, periodEnd);
}

/**
 * Find a limit by key: provider scope wins on the (pathological) collision
 * with a project key, preserving pre-v3 lookup semantics.
 */
function findLimit(store: BudgetStore, key: string): BudgetLimitV3 | undefined {
  return (
    store.limits.find((l) => l.scope.kind === 'provider' && l.scope.providerKey === key) ??
    store.limits.find((l) => l.scope.kind === 'project' && l.scope.projectKey === key)
  );
}

// --- Public API --------------------------------------------------------------

/**
 * Set or update a budget limit.
 *
 * Provider scope (pre-v3 positional signature, unchanged): one limit per
 * provider — upsert semantics on the rolling window.
 * Project scope: one limit per project key — upsert semantics on a
 * calendar-month window (D1). The deterministic id is derived from the
 * project key and preserved across edits.
 */
export function setBudgetLimit(
  providerKey: string,
  limitUsd: number,
  periodDays: number,
  alertAtPercent?: number,
): BudgetLimitV3;
export function setBudgetLimit(
  scope: { kind: 'project'; projectKey: string; displayName: string },
  limitUsd: number,
  alertAtPercent?: number,
): BudgetLimitV3;
export function setBudgetLimit(
  providerOrScope: string | { kind: 'project'; projectKey: string; displayName: string },
  limitUsd: number,
  periodOrAlert?: number,
  alertAtPercent?: number,
): BudgetLimitV3 {
  const store = loadStore();
  const today = todayISO();

  if (typeof providerOrScope === 'string') {
    const providerKey = providerOrScope;
    const days = Math.max(1, periodOrAlert ?? 30);
    const existing = store.limits.find(
      (l) => l.scope.kind === 'provider' && l.scope.providerKey === providerKey,
    );
    const limit: BudgetLimitV3 = {
      id: existing?.id ?? stableBudgetLimitId(providerKey, Math.max(0, limitUsd), days),
      scope: { kind: 'provider', providerKey },
      limitUsd: Math.max(0, limitUsd),
      period: {
        kind: 'rolling',
        days,
        // Preserve any existing period anchor so editing a limit doesn't
        // silently un-reset its tracking window.
        ...(existing?.period.kind === 'rolling' && existing.period.anchor
          ? { anchor: existing.period.anchor }
          : {}),
      },
      alertAtPercent: Math.min(100, Math.max(1, alertAtPercent ?? 80)),
      createdAt: existing?.createdAt ?? today,
    };
    store.limits = existing
      ? store.limits.map((l) => (l === existing ? limit : l))
      : [...store.limits, limit];
    saveStore(store);
    return limit;
  }

  const { projectKey, displayName } = providerOrScope;
  const existing = store.limits.find(
    (l) => l.scope.kind === 'project' && l.scope.projectKey === projectKey,
  );
  const limit: BudgetLimitV3 = {
    id: existing?.id ?? `bgp-${projectKey}`,
    scope: { kind: 'project', projectKey, displayName },
    limitUsd: Math.max(0, limitUsd),
    period: { kind: 'calendar-month' },
    alertAtPercent: Math.min(100, Math.max(1, alertAtPercent ?? 80)),
    createdAt: existing?.createdAt ?? today,
  };
  store.limits = existing
    ? store.limits.map((l) => (l === existing ? limit : l))
    : [...store.limits, limit];
  saveStore(store);
  return limit;
}

/**
 * Reset a provider's tracking period: anchor the window to today so spend is
 * counted fresh from now. We do NOT delete historical usage entries (those come
 * from the read-only backend), so "reset" means "start a new period", which is
 * the only meaningful reset without mutating immutable usage data.
 *
 * Returns the updated limit, or null if no provider-scope limit exists for the
 * provider. (Calendar-month project limits have no anchor to reset.)
 */
export function resetBudgetPeriod(providerKey: string): BudgetLimitV3 | null {
  const store = loadStore();
  const existing = store.limits.find(
    (l) => l.scope.kind === 'provider' && l.scope.providerKey === providerKey,
  );
  if (!existing || existing.period.kind !== 'rolling') return null;
  const updated: BudgetLimitV3 = {
    ...existing,
    period: { ...existing.period, anchor: todayISO() },
  };
  store.limits = store.limits.map((l) => (l === existing ? updated : l));
  saveStore(store);
  return updated;
}

/** Remove budget limit for a provider. */
export function removeBudgetLimit(providerKey: string): void {
  const store = loadStore();
  store.limits = store.limits.filter(
    (l) => !(l.scope.kind === 'provider' && l.scope.providerKey === providerKey),
  );
  saveStore(store);
}

/** Get all configured budget limits (v3 shape, both scopes). */
export function getBudgetLimits(): BudgetLimitV3[] {
  return loadStore().limits;
}

function buildUsage(
  limit: BudgetLimitV3,
  entries: UsageEntry[],
  workspaces: WorkspaceProfile[],
  today: string,
): BudgetUsage {
  const periodStart = periodStartFor(limit, today);
  const periodEnd = today;

  const usedUsd = sumScopeSpend(entries, limit, workspaces, periodStart, periodEnd);
  const percentUsed = limit.limitUsd > 0 ? (usedUsd / limit.limitUsd) * 100 : 0;
  const status = computeStatus(percentUsed, limit.alertAtPercent);

  return {
    scope:
      limit.scope.kind === 'provider'
        ? { kind: 'provider', providerKey: limit.scope.providerKey }
        : { kind: 'project', projectKey: limit.scope.projectKey },
    providerKey: scopeKeyOf(limit),
    periodKind: limit.period.kind,
    usedUsd,
    periodStart,
    periodEnd,
    limitUsd: limit.limitUsd,
    percentUsed,
    status,
  };
}

/**
 * Check current usage vs limit for a key (provider scope preferred, project
 * scope as fallback). Returns null if no limit is configured for the key.
 * Project scopes reconcile usage entries against `workspaces` (D5).
 */
export function checkBudget(
  key: string,
  entries: UsageEntry[],
  workspaces: WorkspaceProfile[] = [],
): BudgetUsage | null {
  const limit = findLimit(loadStore(), key);
  if (!limit) return null;
  return buildUsage(limit, entries, workspaces, todayISO());
}

/**
 * Get all budget alerts — providers AND projects that are near, at, or over
 * their limit. Each alert carries its scope (kind + key + period kind) so the
 * UI can namespace inbox ids without re-deriving it.
 */
export function getBudgetAlerts(
  entries: UsageEntry[],
  workspaces: WorkspaceProfile[] = [],
): BudgetAlert[] {
  const store = loadStore();
  const today = todayISO();
  const alerts: BudgetAlert[] = [];

  for (const limit of store.limits) {
    const usage = buildUsage(limit, entries, workspaces, today);
    if (usage.status !== 'ok') {
      alerts.push({
        scope: usage.scope,
        providerKey: usage.providerKey,
        periodKind: usage.periodKind,
        usedUsd: usage.usedUsd,
        limitUsd: usage.limitUsd,
        percentUsed: usage.percentUsed,
        status: usage.status,
      });
    }
  }

  return alerts;
}

/**
 * Get budget usage for ALL configured limits (providers and projects).
 */
export function getAllBudgetUsage(
  entries: UsageEntry[],
  workspaces: WorkspaceProfile[] = [],
): BudgetUsage[] {
  const store = loadStore();
  const today = todayISO();
  return store.limits.map((limit) => buildUsage(limit, entries, workspaces, today));
}

/** Reset all budget limits. */
export function resetBudgetLimits(): void {
  removeKey('budget');
}
