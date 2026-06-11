import { describe, it, expect, beforeEach } from 'vitest';
import type { UsageEntry } from '../features/costs/useUsage';
import {
  setBudgetLimit,
  resetBudgetPeriod,
  checkBudget,
  getBudgetAlerts,
  getAllBudgetUsage,
  resetBudgetLimits,
} from './budget';

// Helper: build a usage entry with a fixed shape, overriding only what matters.
function entry(partial: Partial<UsageEntry> & { cost_estimate_usd: number }): UsageEntry {
  return {
    date: todayISO(),
    cli: 'claude',
    provider: null,
    model: null,
    tokens_in: 0,
    tokens_out: 0,
    project: null,
    ...partial,
  };
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe('budget — per-provider isolation', () => {
  beforeEach(() => {
    resetBudgetLimits();
    localStorage.clear();
  });

  it("one provider's spend does not consume another provider's budget", () => {
    setBudgetLimit('anthropic', 10, 30);
    setBudgetLimit('openai', 10, 30);

    // anthropic spends $8, openai spends $2 — within the same period.
    const entries: UsageEntry[] = [
      entry({ provider: 'anthropic', cost_estimate_usd: 8 }),
      entry({ provider: 'openai', cost_estimate_usd: 2 }),
    ];

    const anthropic = checkBudget('anthropic', entries);
    const openai = checkBudget('openai', entries);

    expect(anthropic?.usedUsd).toBe(8);
    expect(openai?.usedUsd).toBe(2);
    // Crucially, anthropic's spend is NOT counted against openai (would be $10).
    expect(openai?.percentUsed).toBe(20);
    expect(anthropic?.percentUsed).toBe(80);
  });

  it('fires the 80% warning per provider, independently', () => {
    setBudgetLimit('anthropic', 10, 30, 80);
    setBudgetLimit('openai', 10, 30, 80);

    const entries: UsageEntry[] = [
      // anthropic at 80% -> warning
      entry({ provider: 'anthropic', cost_estimate_usd: 8 }),
      // openai at 20% -> ok, must NOT alert
      entry({ provider: 'openai', cost_estimate_usd: 2 }),
    ];

    const alerts = getBudgetAlerts(entries);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].providerKey).toBe('anthropic');
    expect(alerts[0].status).toBe('warning');
    expect(alerts[0].percentUsed).toBe(80);

    expect(checkBudget('openai', entries)?.status).toBe('ok');
    expect(checkBudget('anthropic', entries)?.status).toBe('warning');
  });

  it('marks a provider exceeded only when its own spend passes the limit', () => {
    setBudgetLimit('anthropic', 10, 30);
    setBudgetLimit('openai', 10, 30);

    const entries: UsageEntry[] = [
      entry({ provider: 'anthropic', cost_estimate_usd: 12 }),
      entry({ provider: 'openai', cost_estimate_usd: 1 }),
    ];

    expect(checkBudget('anthropic', entries)?.status).toBe('exceeded');
    expect(checkBudget('openai', entries)?.status).toBe('ok');

    const alerts = getBudgetAlerts(entries);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].providerKey).toBe('anthropic');
    expect(alerts[0].status).toBe('exceeded');
  });

  it('falls back to cli as provider when provider field is absent', () => {
    setBudgetLimit('claude', 10, 30);

    // Legacy entry: no provider, cli === "claude".
    const entries: UsageEntry[] = [entry({ provider: null, cli: 'claude', cost_estimate_usd: 5 })];

    expect(checkBudget('claude', entries)?.usedUsd).toBe(5);
  });

  it('getAllBudgetUsage reports each provider independently', () => {
    setBudgetLimit('anthropic', 10, 30);
    setBudgetLimit('openai', 20, 30);

    const entries: UsageEntry[] = [
      entry({ provider: 'anthropic', cost_estimate_usd: 5 }),
      entry({ provider: 'openai', cost_estimate_usd: 5 }),
    ];

    const all = getAllBudgetUsage(entries);
    const byKey = Object.fromEntries(all.map((u) => [u.providerKey, u]));
    expect(byKey['anthropic'].usedUsd).toBe(5);
    expect(byKey['openai'].usedUsd).toBe(5);
    expect(byKey['anthropic'].percentUsed).toBe(50);
    expect(byKey['openai'].percentUsed).toBe(25);
  });
});

describe('budget — reset period', () => {
  beforeEach(() => {
    resetBudgetLimits();
    localStorage.clear();
  });

  it('reset anchors the period to today, excluding older spend', () => {
    setBudgetLimit('anthropic', 10, 30);

    const entries: UsageEntry[] = [
      // Spent 5 days ago — counted under the default 30-day rolling window.
      entry({ provider: 'anthropic', date: daysAgoISO(5), cost_estimate_usd: 7 }),
      // Spent today.
      entry({ provider: 'anthropic', date: todayISO(), cost_estimate_usd: 1 }),
    ];

    // Before reset: both entries count (within 30-day window) -> $8.
    expect(checkBudget('anthropic', entries)?.usedUsd).toBe(8);

    // Reset anchors the window to today; only today's spend remains -> $1.
    const updated = resetBudgetPeriod('anthropic');
    expect(updated?.periodAnchor).toBe(todayISO());
    expect(checkBudget('anthropic', entries)?.usedUsd).toBe(1);
  });

  it('reset returns null for an unknown provider', () => {
    expect(resetBudgetPeriod('nonexistent')).toBeNull();
  });

  it('editing a limit preserves an existing period anchor', () => {
    setBudgetLimit('anthropic', 10, 30);
    resetBudgetPeriod('anthropic');
    const anchored = checkBudget('anthropic', [])?.periodStart;
    expect(anchored).toBe(todayISO());

    // Re-saving the limit (e.g. changing the dollar cap) must not lose the anchor.
    setBudgetLimit('anthropic', 25, 30);
    expect(checkBudget('anthropic', [])?.periodStart).toBe(todayISO());
    expect(checkBudget('anthropic', [])?.limitUsd).toBe(25);
  });
});
