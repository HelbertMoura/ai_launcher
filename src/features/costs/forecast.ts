// ==============================================================================
// AI Launcher Pro - Cost forecast (Cost Governance 3.0, design §5c / D2-D3)
// Pure projection helpers. No I/O, no Date.now — `today` is always injectable
// so every function is deterministic in tests (same contract as analytics.ts).
// ==============================================================================

import type { UsageEntry } from './types';

/** Default smoothing window for the daily burn rate (design decision D2). */
export const FORECAST_WINDOW_DAYS = 14;

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** ISO date string N days after `iso` (N=0 returns iso). */
function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Average daily spend over the last `windowDays` days. The divisor is ALWAYS
 * the full window length (dias corridos da janela) — conservative and coherent
 * with `averageDailyUsd` in analytics.ts, never inflated by sparse data.
 */
export function dailyBurn(
  entries: UsageEntry[],
  windowDays: number = FORECAST_WINDOW_DAYS,
  today: string = todayISO(),
): number {
  if (windowDays <= 0) return 0;
  const start = addDays(today, -(windowDays - 1));
  const total = entries
    .filter((e) => e.date >= start && e.date <= today)
    .reduce((sum, e) => sum + e.cost_estimate_usd, 0);
  return total / windowDays;
}

export interface MonthProjection {
  /** Accrued spend in the current calendar month. */
  monthToDate: number;
  /** monthToDate + daily burn x days remaining in the month (D2). */
  projected: number;
  /** False when fewer than 3 distinct days carry data this month (D3). */
  dataSufficient: boolean;
}

/**
 * Project the current month's end-of-month spend. monthToDate counts only
 * entries inside the current calendar month; the projection extrapolates the
 * rolling-window burn over the remaining calendar days.
 */
export function projectMonthEnd(
  entries: UsageEntry[],
  windowDays: number = FORECAST_WINDOW_DAYS,
  today: string = todayISO(),
): MonthProjection {
  const month = today.slice(0, 7);
  const monthStart = `${month}-01`;
  let monthToDate = 0;
  const activeDays = new Set<string>();
  for (const e of entries) {
    if (e.date >= monthStart && e.date <= today) {
      monthToDate += e.cost_estimate_usd;
      activeDays.add(e.date);
    }
  }

  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7));
  const daysInMonth = new Date(year, monthIndex, 0).getDate();
  const dayOfMonth = Number(today.slice(8, 10));
  const daysRemaining = Math.max(0, daysInMonth - dayOfMonth);

  return {
    monthToDate,
    projected: monthToDate + dailyBurn(entries, windowDays, today) * daysRemaining,
    dataSufficient: activeDays.size >= 3,
  };
}

export interface BudgetEtaInput {
  /** Spend already accrued inside the limit's current period. */
  limitSpent: number;
  /** Limit cap. A zero (or negative) cap never projects — no division by zero. */
  limitUsd: number;
  /** Projected daily spend (e.g. `dailyBurn`). */
  dailyBurn: number;
  today: string;
  /**
   * Inclusive period boundary (ISO date). An estimated overflow after this
   * date is reported as "no overflow in period" (null). Omit for open-ended
   * projections.
   */
  periodEnd?: string;
}

/**
 * Estimated ISO date on which accrued spend crosses `limitUsd`, or null when:
 * burn is zero/negative, the limit is already reached/exceeded, the cap is not
 * positive, or the overflow would land after `periodEnd`.
 */
export function budgetEta({ limitSpent, limitUsd, dailyBurn: burn, today, periodEnd }: BudgetEtaInput): string | null {
  if (!(burn > 0)) return null; // zero, negative or NaN burn: no projection
  if (!(limitUsd > 0)) return null; // zero cap: nothing to overflow, no division by zero
  if (limitSpent >= limitUsd) return null; // already at/over the limit
  const daysToOverflow = Math.ceil((limitUsd - limitSpent) / burn);
  if (daysToOverflow <= 0) return null;
  const eta = addDays(today, daysToOverflow);
  if (periodEnd !== undefined && eta > periodEnd) return null;
  return eta;
}
