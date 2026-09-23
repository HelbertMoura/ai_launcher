import { describe, expect, it } from 'vitest';
import { FORECAST_WINDOW_DAYS, budgetEta, dailyBurn, projectMonthEnd } from './forecast';
import type { UsageEntry } from './types';

function entry(partial: Partial<UsageEntry> & { date: string; cost_estimate_usd: number }): UsageEntry {
  return {
    cli: 'claude',
    provider: 'anthropic',
    model: null,
    tokens_in: 0,
    tokens_out: 0,
    project: null,
    ...partial,
  };
}

const TODAY = '2026-06-16'; // a Tuesday, mid-month

describe('dailyBurn (gate condition 6: divisor = full window days)', () => {
  it('divides the window total by the calendar days of the window, not by active days', () => {
    const entries = [
      entry({ date: '2026-06-15', cost_estimate_usd: 30 }),
      entry({ date: '2026-06-16', cost_estimate_usd: 40 }),
    ];
    // $70 across a 14-day window -> $5/day even though only 2 days have data.
    expect(dailyBurn(entries, 14, TODAY)).toBe(5);
  });

  it('ignores entries outside the window', () => {
    const entries = [
      entry({ date: '2026-05-20', cost_estimate_usd: 100 }),
      entry({ date: '2026-06-16', cost_estimate_usd: 14 }),
    ];
    expect(dailyBurn(entries, 14, TODAY)).toBe(1);
  });

  it('returns 0 for an empty window or an invalid window length', () => {
    expect(dailyBurn([], 14, TODAY)).toBe(0);
    expect(dailyBurn([entry({ date: TODAY, cost_estimate_usd: 10 })], 0, TODAY)).toBe(0);
  });

  it('exposes 14 days as the exported default window (D2)', () => {
    expect(FORECAST_WINDOW_DAYS).toBe(14);
    const entries = [entry({ date: TODAY, cost_estimate_usd: 28 })];
    expect(dailyBurn(entries, undefined, TODAY)).toBe(2);
  });
});

describe('projectMonthEnd (D2/D3)', () => {
  it('returns zeroed, insufficient data for an empty month', () => {
    expect(projectMonthEnd([], 14, TODAY)).toEqual({
      monthToDate: 0,
      projected: 0,
      dataSufficient: false,
    });
  });

  it('projects from day 1 of the month with the full remaining month ahead', () => {
    const entries = [
      entry({ date: '2026-06-01', cost_estimate_usd: 7 }),
      // May spend must NOT leak into monthToDate (and sits outside the 14d
      // burn window ending 06-01, which starts on 05-19).
      entry({ date: '2026-05-10', cost_estimate_usd: 100 }),
    ];
    const { monthToDate, projected, dataSufficient } = projectMonthEnd(entries, 14, '2026-06-01');
    expect(monthToDate).toBe(7);
    // June has 30 days; day 1 -> 29 days remaining. Burn (14d window) = $7/14
    // = $0.5/day -> 7 + 0.5 * 29 = 21.5.
    expect(projected).toBeCloseTo(21.5, 6);
    expect(dataSufficient).toBe(false); // 1 distinct day < 3
  });

  it('marks data as insufficient with fewer than 3 distinct active days', () => {
    const entries = [
      entry({ date: '2026-06-10', cost_estimate_usd: 5 }),
      entry({ date: '2026-06-10', cost_estimate_usd: 5 }), // same day twice
      entry({ date: '2026-06-12', cost_estimate_usd: 5 }),
    ];
    const result = projectMonthEnd(entries, 14, TODAY);
    expect(result.dataSufficient).toBe(false);
  });

  it('marks data as sufficient with 3 or more distinct active days', () => {
    const entries = [
      entry({ date: '2026-06-10', cost_estimate_usd: 5 }),
      entry({ date: '2026-06-11', cost_estimate_usd: 5 }),
      entry({ date: '2026-06-12', cost_estimate_usd: 5 }),
    ];
    const result = projectMonthEnd(entries, 14, TODAY);
    expect(result.dataSufficient).toBe(true);
    expect(result.monthToDate).toBe(15);
  });

  it('combines month-to-date with the burn over the remaining calendar days', () => {
    const entries = [
      entry({ date: '2026-06-05', cost_estimate_usd: 30 }),
      entry({ date: '2026-06-06', cost_estimate_usd: 30 }),
      entry({ date: '2026-06-07', cost_estimate_usd: 30 }),
    ];
    const { monthToDate, projected } = projectMonthEnd(entries, 14, TODAY);
    expect(monthToDate).toBe(90);
    // June has 30 days; today is the 16th -> 14 days remaining.
    // Burn = $90/14 -> projected = 90 + (90/14) * 14 = 180.
    expect(projected).toBeCloseTo(180, 6);
  });

  it('counts only entries up to today even when future-dated rows exist', () => {
    const entries = [
      entry({ date: '2026-06-10', cost_estimate_usd: 5 }),
      entry({ date: '2026-06-30', cost_estimate_usd: 999 }),
    ];
    expect(projectMonthEnd(entries, 14, TODAY).monthToDate).toBe(5);
  });
});

describe('budgetEta (gate condition 6: limitUsd = 0 without division by zero)', () => {
  it('projects the overflow date for a normal burn', () => {
    // $5 spent of $10, burning $1/day -> crosses in 5 days.
    expect(budgetEta({ limitSpent: 5, limitUsd: 10, dailyBurn: 1, today: TODAY })).toBe('2026-06-21');
  });

  it('returns null when burn is zero, negative or NaN', () => {
    expect(budgetEta({ limitSpent: 0, limitUsd: 10, dailyBurn: 0, today: TODAY })).toBeNull();
    expect(budgetEta({ limitSpent: 0, limitUsd: 10, dailyBurn: -2, today: TODAY })).toBeNull();
    expect(budgetEta({ limitSpent: 0, limitUsd: 10, dailyBurn: NaN, today: TODAY })).toBeNull();
  });

  it('returns null when the limit is already reached or exceeded', () => {
    expect(budgetEta({ limitSpent: 10, limitUsd: 10, dailyBurn: 1, today: TODAY })).toBeNull();
    expect(budgetEta({ limitSpent: 12, limitUsd: 10, dailyBurn: 1, today: TODAY })).toBeNull();
  });

  it('returns null for a zero limit without dividing by zero', () => {
    expect(budgetEta({ limitSpent: 0, limitUsd: 0, dailyBurn: 2, today: TODAY })).toBeNull();
    expect(Number.isFinite(budgetEta({ limitSpent: 0, limitUsd: 0, dailyBurn: 2, today: TODAY }) ?? 0)).toBe(true);
  });

  it('returns null when the overflow would land after the period end', () => {
    // 5 days to overflow, but the calendar-month period ends on the 30th? No —
    // overflow on 06-21 is before that; use a tighter period end instead.
    expect(
      budgetEta({
        limitSpent: 5,
        limitUsd: 10,
        dailyBurn: 1,
        today: TODAY,
        periodEnd: '2026-06-20',
      }),
    ).toBeNull();
    // Boundary: overflowing exactly ON the period end is reported.
    expect(
      budgetEta({
        limitSpent: 5,
        limitUsd: 10,
        dailyBurn: 1,
        today: TODAY,
        periodEnd: '2026-06-21',
      }),
    ).toBe('2026-06-21');
  });

  it('rounds up partial days until the cap is crossed', () => {
    // $1 spent of $10 with $0.5/day burn -> 9 / 0.5 = 18 days exactly.
    expect(budgetEta({ limitSpent: 1, limitUsd: 10, dailyBurn: 0.5, today: TODAY })).toBe('2026-07-04');
    // $1 spent of $10 with $1.5/day burn -> 9 / 1.5 = 6 days exactly.
    expect(budgetEta({ limitSpent: 1, limitUsd: 10, dailyBurn: 1.5, today: TODAY })).toBe('2026-06-22');
  });
});
