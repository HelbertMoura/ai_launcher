// Pure aggregation helpers for the Analytics view. No I/O, no Date.now —
// `today` is always injectable so every function is deterministic in tests.
import type { UsageEntry } from "./useUsage";

export interface DayPoint {
  date: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

export interface RankRow {
  /** null = aggregated bucket ("other" / unknown). */
  label: string | null;
  costUsd: number;
  /** Fraction of the window total, 0..1 (0 when total is 0). */
  share: number;
}

export interface Trend {
  currentUsd: number;
  previousUsd: number;
  /** Percent change vs previous window; null when previous is 0. */
  deltaPct: number | null;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** ISO date string N days before `iso` (N=0 returns iso). */
function shiftDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Continuous daily series for the last `days` days ending at `today`, zero-filled. */
export function dailySeries(entries: UsageEntry[], days = 30, today = todayISO()): DayPoint[] {
  const byDate = new Map<string, DayPoint>();
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = shiftDays(today, i);
    byDate.set(date, { date, tokensIn: 0, tokensOut: 0, costUsd: 0 });
  }
  for (const e of entries) {
    const point = byDate.get(e.date);
    if (!point) continue; // outside window
    point.tokensIn += e.tokens_in;
    point.tokensOut += e.tokens_out;
    point.costUsd += e.cost_estimate_usd;
  }
  return [...byDate.values()];
}

function windowEntries(entries: UsageEntry[], days: number, today: string): UsageEntry[] {
  const start = shiftDays(today, days - 1);
  return entries.filter((e) => e.date >= start && e.date <= today);
}

function rank(
  entries: UsageEntry[],
  keyOf: (e: UsageEntry) => string | null,
  topN: number,
): RankRow[] {
  const acc = new Map<string | null, number>();
  let total = 0;
  for (const e of entries) {
    const key = keyOf(e);
    acc.set(key, (acc.get(key) ?? 0) + e.cost_estimate_usd);
    total += e.cost_estimate_usd;
  }
  const sorted = [...acc.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, topN);
  const restUsd = sorted.slice(topN).reduce((s, [, v]) => s + v, 0);
  const rows: RankRow[] = top.map(([label, costUsd]) => ({
    label,
    costUsd,
    share: total > 0 ? costUsd / total : 0,
  }));
  if (restUsd === 0) return rows;
  // The aggregated "other" bucket shares the null label with unknown entries;
  // if a null row already ranked into the top, merge instead of duplicating.
  const nullIdx = rows.findIndex((r) => r.label === null);
  if (nullIdx >= 0) {
    const mergedUsd = rows[nullIdx].costUsd + restUsd;
    return rows.map((r, i) =>
      i === nullIdx ? { label: null, costUsd: mergedUsd, share: total > 0 ? mergedUsd / total : 0 } : r,
    );
  }
  return [...rows, { label: null, costUsd: restUsd, share: total > 0 ? restUsd / total : 0 }];
}

export function byProject(entries: UsageEntry[], days = 30, topN = 8, today = todayISO()): RankRow[] {
  return rank(windowEntries(entries, days, today), (e) => e.project ?? null, topN);
}

export function byModel(entries: UsageEntry[], days = 30, today = todayISO()): RankRow[] {
  return rank(windowEntries(entries, days, today), (e) => e.model ?? null, 8);
}

export function trend(entries: UsageEntry[], days = 30, today = todayISO()): Trend {
  const currentStart = shiftDays(today, days - 1);
  const previousEnd = shiftDays(currentStart, 1);
  const previousStart = shiftDays(previousEnd, days - 1);
  let currentUsd = 0;
  let previousUsd = 0;
  for (const e of entries) {
    if (e.date >= currentStart && e.date <= today) currentUsd += e.cost_estimate_usd;
    else if (e.date >= previousStart && e.date <= previousEnd) previousUsd += e.cost_estimate_usd;
  }
  const deltaPct = previousUsd > 0 ? ((currentUsd - previousUsd) / previousUsd) * 100 : null;
  return { currentUsd, previousUsd, deltaPct };
}
