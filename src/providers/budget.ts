// ==============================================================================
// AI Launcher Pro - Provider Budget Guard
// Per-provider spending limits with period-based tracking. All data stays local.
// ==============================================================================

import { z } from 'zod';
import type { UsageEntry } from '../features/costs/useUsage';
import { readKey, removeKey, writeKey } from '../lib/storage';

// --- Types -------------------------------------------------------------------

export interface BudgetLimit {
  providerKey: string;
  limitUsd: number;
  periodDays: number;
  alertAtPercent: number;
  /**
   * Optional explicit period anchor (YYYY-MM-DD). When set, the budget period
   * starts at this date instead of `today - periodDays`. The Reset action sets
   * this to today so spend is counted fresh from "now". Absent for limits that
   * use the default rolling window.
   */
  periodAnchor?: string;
}

export interface BudgetUsage {
  providerKey: string;
  usedUsd: number;
  periodStart: string;
  periodEnd: string;
  limitUsd: number;
  percentUsed: number;
  status: 'ok' | 'warning' | 'exceeded';
}

export interface BudgetAlert {
  providerKey: string;
  usedUsd: number;
  limitUsd: number;
  percentUsed: number;
  status: 'warning' | 'exceeded';
}

// --- Storage -----------------------------------------------------------------

interface BudgetStore {
  limits: BudgetLimit[];
}

// Validate persisted data at the storage boundary — localStorage is external,
// untrusted input that may be stale or hand-edited.
const budgetLimitSchema = z.object({
  providerKey: z.string().min(1),
  limitUsd: z.number().nonnegative(),
  periodDays: z.number().int().positive(),
  alertAtPercent: z.number().min(1).max(100),
  periodAnchor: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

function loadStore(): BudgetStore {
    const parsed = readKey('budget') as unknown;
    const limitsRaw = (parsed as { limits?: unknown })?.limits;
    if (!Array.isArray(limitsRaw)) return { limits: [] };
    // Drop any malformed entries rather than failing the whole store.
    const limits = limitsRaw.flatMap((l) => {
      const result = budgetLimitSchema.safeParse(l);
      return result.success ? [result.data] : [];
    });
    return { limits };
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

/** Start of the budget window: explicit anchor if set, else rolling window. */
function periodStartFor(limit: BudgetLimit): string {
  return limit.periodAnchor ?? dateDaysAgo(limit.periodDays);
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

// --- Public API --------------------------------------------------------------

/**
 * Set or update a budget limit for a given provider.
 * Only one limit per provider — upsert semantics.
 */
export function setBudgetLimit(
  providerKey: string,
  limitUsd: number,
  periodDays: number,
  alertAtPercent: number = 80,
): BudgetLimit {
  const store = loadStore();
  const existing = store.limits.find((l) => l.providerKey === providerKey);
  const limit: BudgetLimit = {
    providerKey,
    limitUsd: Math.max(0, limitUsd),
    periodDays: Math.max(1, periodDays),
    alertAtPercent: Math.min(100, Math.max(1, alertAtPercent)),
    // Preserve any existing period anchor so editing a limit doesn't silently
    // un-reset its tracking window.
    ...(existing?.periodAnchor ? { periodAnchor: existing.periodAnchor } : {}),
  };
  const idx = store.limits.findIndex((l) => l.providerKey === providerKey);
  if (idx >= 0) {
    store.limits = store.limits.map((l, i) => (i === idx ? limit : l));
  } else {
    store.limits = [...store.limits, limit];
  }
  saveStore(store);
  return limit;
}

/**
 * Reset a provider's tracking period: anchor the window to today so spend is
 * counted fresh from now. We do NOT delete historical usage entries (those come
 * from the read-only backend), so "reset" means "start a new period", which is
 * the only meaningful reset without mutating immutable usage data.
 *
 * Returns the updated limit, or null if no limit exists for the provider.
 */
export function resetBudgetPeriod(providerKey: string): BudgetLimit | null {
  const store = loadStore();
  const existing = store.limits.find((l) => l.providerKey === providerKey);
  if (!existing) return null;
  const updated: BudgetLimit = { ...existing, periodAnchor: todayISO() };
  store.limits = store.limits.map((l) =>
    l.providerKey === providerKey ? updated : l,
  );
  saveStore(store);
  return updated;
}

/** Remove budget limit for a provider. */
export function removeBudgetLimit(providerKey: string): void {
  const store = loadStore();
  store.limits = store.limits.filter((l) => l.providerKey !== providerKey);
  saveStore(store);
}

/** Get all configured budget limits. */
export function getBudgetLimits(): BudgetLimit[] {
  return loadStore().limits;
}

/**
 * Check current usage vs limit for a specific provider.
 * Returns null if no limit is configured.
 */
export function checkBudget(
  providerKey: string,
  entries: UsageEntry[],
): BudgetUsage | null {
  const store = loadStore();
  const limit = store.limits.find((l) => l.providerKey === providerKey);
  if (!limit) return null;

  const periodStart = periodStartFor(limit);
  const periodEnd = todayISO();

  const usedUsd = sumProviderSpend(entries, providerKey, periodStart, periodEnd);

  const percentUsed = limit.limitUsd > 0 ? (usedUsd / limit.limitUsd) * 100 : 0;
  const status = computeStatus(percentUsed, limit.alertAtPercent);

  return {
    providerKey,
    usedUsd,
    periodStart,
    periodEnd,
    limitUsd: limit.limitUsd,
    percentUsed,
    status,
  };
}

/**
 * Get all budget alerts — providers that are near, at, or over their limit.
 */
export function getBudgetAlerts(entries: UsageEntry[]): BudgetAlert[] {
  const store = loadStore();
  const alerts: BudgetAlert[] = [];

  const periodEnd = todayISO();
  for (const limit of store.limits) {
    const periodStart = periodStartFor(limit);
    const usedUsd = sumProviderSpend(entries, limit.providerKey, periodStart, periodEnd);

    const percentUsed = limit.limitUsd > 0 ? (usedUsd / limit.limitUsd) * 100 : 0;
    const status = computeStatus(percentUsed, limit.alertAtPercent);

    if (status !== 'ok') {
      alerts.push({
        providerKey: limit.providerKey,
        usedUsd,
        limitUsd: limit.limitUsd,
        percentUsed,
        status,
      });
    }
  }

  return alerts;
}

/**
 * Get budget usage for ALL configured providers.
 */
export function getAllBudgetUsage(entries: UsageEntry[]): BudgetUsage[] {
  const store = loadStore();
  return store.limits.map((limit) => {
    const periodStart = periodStartFor(limit);
    const periodEnd = todayISO();

    const usedUsd = sumProviderSpend(entries, limit.providerKey, periodStart, periodEnd);

    const percentUsed = limit.limitUsd > 0 ? (usedUsd / limit.limitUsd) * 100 : 0;
    const status = computeStatus(percentUsed, limit.alertAtPercent);

    return {
      providerKey: limit.providerKey,
      usedUsd,
      periodStart,
      periodEnd,
      limitUsd: limit.limitUsd,
      percentUsed,
      status,
    };
  });
}

/** Reset all budget limits. */
export function resetBudgetLimits(): void {
  removeKey('budget');
}
