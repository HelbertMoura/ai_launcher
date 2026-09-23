import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { UsageEntry } from '../features/costs/types';
import {
  setBudgetLimit,
  resetBudgetPeriod,
  checkBudget,
  getBudgetAlerts,
  getAllBudgetUsage,
  getBudgetLimits,
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
    // (v3 shape: the anchor moved from `periodAnchor` to `period.anchor`.)
    const updated = resetBudgetPeriod('anthropic');
    expect(updated?.period).toMatchObject({ kind: 'rolling', anchor: todayISO() });
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

// ==============================================================================
// Budget storage v3 (Cost Governance 3.0, wave 3c): loss-less v15 -> v3
// migration on the read path, project scope with calendar month (D1) and
// scope-carrying alerts for the namespaced inbox ids (wave 3d).
// ==============================================================================

const BUDGET_STORAGE_KEY = 'ai-launcher:v15:budget';

function workspace(id: string, name: string, directory: string) {
  return {
    id,
    name,
    directory,
    cliKeys: [],
    envVars: {},
    tags: [],
    pinned: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

describe('budget v3 — loss-less v15 -> v3 migration (gate condition 1)', () => {
  // Real v15 payload: exactly the 5 persisted fields of the pre-3c schema.
  const V15_PAYLOAD = {
    limits: [
      {
        providerKey: 'anthropic',
        limitUsd: 25.5,
        periodDays: 30,
        alertAtPercent: 80,
        periodAnchor: '2026-09-01',
      },
      {
        providerKey: 'openai',
        limitUsd: 10,
        periodDays: 14,
        alertAtPercent: 90,
      },
    ],
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it('migrates a real v15 payload preserving every field, one by one', () => {
    localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(V15_PAYLOAD));

    const limits = getBudgetLimits();
    expect(limits).toHaveLength(2);

    const [anthropic, openai] = limits;

    // Field-by-field loss-less proof for the anchored limit.
    expect(anthropic.scope).toEqual({ kind: 'provider', providerKey: 'anthropic' });
    expect(anthropic.limitUsd).toBe(25.5);
    expect(anthropic.period).toEqual({ kind: 'rolling', days: 30, anchor: '2026-09-01' });
    expect(anthropic.alertAtPercent).toBe(80);
    expect(anthropic.id).toMatch(/^bgt-[0-9a-f]{8}$/);
    expect(anthropic.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Unanchored limit: absent periodAnchor stays absent (not invented).
    expect(openai.scope).toEqual({ kind: 'provider', providerKey: 'openai' });
    expect(openai.limitUsd).toBe(10);
    expect(openai.period).toEqual({ kind: 'rolling', days: 14 });
    expect(openai.alertAtPercent).toBe(90);

    // Migrated limits keep computing spend exactly as v15 did.
    const entries: UsageEntry[] = [entry({ provider: 'anthropic', cost_estimate_usd: 8 })];
    expect(checkBudget('anthropic', entries)?.usedUsd).toBe(8);
  });

  it('generates deterministic ids across independent migrations', () => {
    localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(V15_PAYLOAD));
    const first = getBudgetLimits().map((l) => l.id);

    localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(V15_PAYLOAD));
    const second = getBudgetLimits().map((l) => l.id);

    expect(first).toEqual(second);
  });

  it('does not re-migrate an already-v3 store (idempotent read path)', () => {
    // Seed through the migration, then persist the v3 result with a stamped
    // old createdAt: a re-migration would re-stamp it with today.
    localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(V15_PAYLOAD));
    const migrated = getBudgetLimits();
    const stamped = migrated.map((l) => ({ ...l, createdAt: '2020-01-01' }));
    localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify({ limits: stamped }));

    expect(getBudgetLimits()).toEqual(stamped);
  });

  it('never drops v15-detected entries, even with corrupt numerics', () => {
    localStorage.setItem(
      BUDGET_STORAGE_KEY,
      JSON.stringify({
        limits: [
          { providerKey: 'weird' }, // numerics missing -> safe defaults, not a drop
          { providerKey: 'ok', limitUsd: 5, periodDays: 7, alertAtPercent: 50 },
        ],
      }),
    );

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const limits = getBudgetLimits();
      expect(limits).toHaveLength(2);
      const weird = limits.find((l) => l.scope.kind === 'provider' && l.scope.providerKey === 'weird');
      expect(weird?.limitUsd).toBe(0);
      expect(weird?.period).toEqual({ kind: 'rolling', days: 30 });
      expect(weird?.alertAtPercent).toBe(80);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('drops truly corrupt entries loudly, keeping valid neighbors', () => {
    localStorage.setItem(
      BUDGET_STORAGE_KEY,
      JSON.stringify({
        limits: [
          // Not v15 (no providerKey) and not valid v3 (bogus scope kind).
          { id: 'x', scope: { kind: 'bogus' }, limitUsd: 1, period: {}, alertAtPercent: 80, createdAt: '2026-01-01' },
          { providerKey: 'ok', limitUsd: 5, periodDays: 7, alertAtPercent: 50 },
        ],
      }),
    );

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const limits = getBudgetLimits();
      expect(limits).toHaveLength(1);
      expect(limits[0].scope).toEqual({ kind: 'provider', providerKey: 'ok' });
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe('budget v3 — project scope with calendar month (D1)', () => {
  beforeEach(() => {
    resetBudgetLimits();
    localStorage.clear();
  });

  it('counts only current-calendar-month spend for project budgets', () => {
    const projectKey = 'c:/users/helbe/myapp';
    setBudgetLimit({ kind: 'project', projectKey, displayName: 'myapp' }, 10, 80);

    const entries: UsageEntry[] = [
      // 40+ days ago is always a previous month: excluded by calendar month.
      entry({
        provider: 'anthropic',
        project: 'MyApp',
        project_path: 'C:\\Users\\helbe\\myapp',
        date: daysAgoISO(40),
        cost_estimate_usd: 7,
      }),
      entry({
        provider: 'anthropic',
        project: 'MyApp',
        project_path: 'C:\\Users\\helbe\\myapp',
        date: todayISO(),
        cost_estimate_usd: 3,
      }),
    ];

    const usage = checkBudget(projectKey, entries);
    expect(usage?.scope).toEqual({ kind: 'project', projectKey });
    expect(usage?.providerKey).toBe(projectKey);
    expect(usage?.periodKind).toBe('calendar-month');
    expect(usage?.periodStart).toBe(`${todayISO().slice(0, 7)}-01`);
    expect(usage?.usedUsd).toBe(3);
    expect(usage?.percentUsed).toBe(30);
  });

  it('reconciles label-only entries via unambiguous workspace basename (D5)', () => {
    const workspaces = [workspace('ws1', 'MyApp', 'C:\\Users\\helbe\\MyApp')];
    setBudgetLimit({ kind: 'project', projectKey: 'c:/users/helbe/myapp', displayName: 'MyApp' }, 10, 80);

    // Claude-style entry: no project_path, label matches workspace basename.
    const entries: UsageEntry[] = [
      entry({ provider: 'anthropic', project: 'myapp', project_path: null, cost_estimate_usd: 9 }),
    ];

    const usage = checkBudget('c:/users/helbe/myapp', entries, workspaces);
    expect(usage?.usedUsd).toBe(9);

    const alerts = getBudgetAlerts(entries, workspaces);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].scope).toEqual({ kind: 'project', projectKey: 'c:/users/helbe/myapp' });
    expect(alerts[0].providerKey).toBe('c:/users/helbe/myapp');
    expect(alerts[0].periodKind).toBe('calendar-month');
    expect(alerts[0].status).toBe('warning');
  });

  it('reports every configured scope from getAllBudgetUsage', () => {
    setBudgetLimit('anthropic', 10, 30);
    setBudgetLimit({ kind: 'project', projectKey: 'p1', displayName: 'P1' }, 5, 80);

    const entries: UsageEntry[] = [entry({ provider: 'anthropic', cost_estimate_usd: 8 })];
    const all = getAllBudgetUsage(entries);

    expect(all).toHaveLength(2);
    const provider = all.find((u) => u.scope.kind === 'provider');
    const project = all.find((u) => u.scope.kind === 'project');
    expect(provider?.usedUsd).toBe(8);
    expect(project?.usedUsd).toBe(0);
    expect(provider?.periodKind).toBe('rolling');
    expect(project?.periodKind).toBe('calendar-month');

    // Provider alerts keep the legacy flat alias for pre-3c consumers.
    const alerts = getBudgetAlerts(entries);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].providerKey).toBe('anthropic');
    expect(alerts[0].scope).toEqual({ kind: 'provider', providerKey: 'anthropic' });
    expect(alerts[0].periodKind).toBe('rolling');
  });
});
