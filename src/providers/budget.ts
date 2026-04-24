// ==============================================================================
// AI Launcher Pro - Provider Budget Guard
// Per-provider spending limits with period-based tracking. All data stays local.
// ==============================================================================

import type { UsageEntry } from '../features/costs/useUsage';

// --- Types -------------------------------------------------------------------

export interface BudgetLimit {
  providerKey: string;
  limitUsd: number;
  periodDays: number;
  alertAtPercent: number;
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

const STORAGE_KEY = 'ai-launcher:v15:budget';

interface BudgetStore {
  limits: BudgetLimit[];
}

function loadStore(): BudgetStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { limits: [] };
    const parsed = JSON.parse(raw) as Partial<BudgetStore>;
    return { limits: Array.isArray(parsed.limits) ? parsed.limits : [] };
  } catch {
    return { limits: [] };
  }
}

function saveStore(store: BudgetStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    console.error('[budget] failed to save', e);
  }
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
  const limit: BudgetLimit = {
    providerKey,
    limitUsd: Math.max(0, limitUsd),
    periodDays: Math.max(1, periodDays),
    alertAtPercent: Math.min(100, Math.max(1, alertAtPercent)),
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

  const periodStart = dateDaysAgo(limit.periodDays);
  const periodEnd = todayISO();

  const usedUsd = entries
    .filter((e) => e.date >= periodStart && e.date <= periodEnd)
    .reduce((sum, e) => sum + e.cost_estimate_usd, 0);

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

  for (const limit of store.limits) {
    const periodStart = dateDaysAgo(limit.periodDays);
    const usedUsd = entries
      .filter((e) => e.date >= periodStart)
      .reduce((sum, e) => sum + e.cost_estimate_usd, 0);

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
    const periodStart = dateDaysAgo(limit.periodDays);
    const periodEnd = todayISO();

    const usedUsd = entries
      .filter((e) => e.date >= periodStart && e.date <= periodEnd)
      .reduce((sum, e) => sum + e.cost_estimate_usd, 0);

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
  localStorage.removeItem(STORAGE_KEY);
}
