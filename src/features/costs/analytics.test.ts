import { describe, expect, it } from "vitest";
import { byModel, byProject, dailySeries, trend } from "./analytics";
import type { UsageEntry } from "./useUsage";

function entry(partial: Partial<UsageEntry>): UsageEntry {
  return {
    date: "2026-06-10",
    cli: "claude",
    provider: "anthropic",
    model: "claude-opus",
    tokens_in: 100,
    tokens_out: 50,
    cost_estimate_usd: 1,
    project: "alpha",
    ...partial,
  };
}

describe("dailySeries", () => {
  it("returns one point per day, oldest first, zero-filled", () => {
    const entries = [
      entry({ date: "2026-06-10", cost_estimate_usd: 2 }),
      entry({ date: "2026-06-10", cost_estimate_usd: 3 }),
      entry({ date: "2026-06-08", cost_estimate_usd: 1 }),
    ];
    const series = dailySeries(entries, 3, "2026-06-10");
    expect(series).toHaveLength(3);
    expect(series[0]).toEqual({ date: "2026-06-08", tokensIn: 100, tokensOut: 50, costUsd: 1 });
    expect(series[1]).toEqual({ date: "2026-06-09", tokensIn: 0, tokensOut: 0, costUsd: 0 });
    expect(series[2].costUsd).toBe(5);
  });

  it("ignores entries outside the window", () => {
    const series = dailySeries([entry({ date: "2026-05-01" })], 3, "2026-06-10");
    expect(series.every((p) => p.costUsd === 0)).toBe(true);
  });

  it("handles empty input", () => {
    expect(dailySeries([], 30, "2026-06-10")).toHaveLength(30);
  });
});

describe("byProject", () => {
  it("ranks projects by cost desc with share, aggregating the rest as null label", () => {
    const entries = [
      entry({ project: "alpha", cost_estimate_usd: 6 }),
      entry({ project: "beta", cost_estimate_usd: 3 }),
      entry({ project: "gamma", cost_estimate_usd: 1 }),
    ];
    const rows = byProject(entries, 30, 2, "2026-06-10");
    expect(rows[0]).toEqual({ label: "alpha", costUsd: 6, share: 0.6 });
    expect(rows[1].label).toBe("beta");
    expect(rows[2]).toEqual({ label: null, costUsd: 1, share: 0.1 });
  });

  it("buckets null project as null label (renders as 'other')", () => {
    const rows = byProject([entry({ project: null, cost_estimate_usd: 2 })], 30, 8, "2026-06-10");
    expect(rows[0].label).toBeNull();
  });

  it("merges the rest bucket into a null row already in the top (never two 'other' rows)", () => {
    const entries = [
      entry({ project: null, cost_estimate_usd: 6 }),
      entry({ project: "beta", cost_estimate_usd: 3 }),
      entry({ project: "gamma", cost_estimate_usd: 1 }),
    ];
    const rows = byProject(entries, 30, 2, "2026-06-10");
    const nullRows = rows.filter((r) => r.label === null);
    expect(nullRows).toHaveLength(1);
    expect(nullRows[0].costUsd).toBe(7);
    expect(nullRows[0].share).toBe(0.7);
  });
});

describe("byModel", () => {
  it("ranks models by cost desc", () => {
    const entries = [
      entry({ model: "opus", cost_estimate_usd: 5 }),
      entry({ model: "haiku", cost_estimate_usd: 1 }),
      entry({ model: null, cost_estimate_usd: 2 }),
    ];
    const rows = byModel(entries, 30, "2026-06-10");
    expect(rows.map((r) => r.label)).toEqual(["opus", null, "haiku"]);
  });
});

describe("trend", () => {
  it("compares current window vs previous window", () => {
    const entries = [
      entry({ date: "2026-06-10", cost_estimate_usd: 4 }), // current (06-08..06-10)
      entry({ date: "2026-06-06", cost_estimate_usd: 2 }), // previous (06-05..06-07)
    ];
    const t = trend(entries, 3, "2026-06-10");
    expect(t.currentUsd).toBe(4);
    expect(t.previousUsd).toBe(2);
    expect(t.deltaPct).toBe(100);
  });

  it("returns null deltaPct when previous window is zero", () => {
    const t = trend([entry({ date: "2026-06-10" })], 3, "2026-06-10");
    expect(t.deltaPct).toBeNull();
  });
});
