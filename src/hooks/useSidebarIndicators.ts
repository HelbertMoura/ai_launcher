// ==============================================================================
// AI Launcher Pro - Sidebar Indicators Hook
// Computes lightweight status chips shown next to sidebar menu items.
// ==============================================================================

import { useEffect, useMemo, useState } from "react";
import type { UsageReport } from "../features/costs/types";
import { loadWorkspaces } from "../features/workspace/workspaceStore";
import { getBudgetAlerts } from "../providers/budget";
import type { HistoryItem } from "../features/history/useHistory";
import { readKey, STORAGE_KEYS } from "../lib/storage";

export type BudgetIndicatorStatus = "ok" | "warning" | "exceeded";

export interface SidebarIndicators {
  /** Number of sessions started today (YYYY-MM-DD match on startedAt/timestamp). */
  historyToday: number;
  /** Today's spend formatted as USD string; empty string if zero. */
  todaySpend: string;
  /** Number of pinned workspace profiles. */
  pinnedWorkspaces: number;
  /** Worst active budget status across provider AND project scopes (condition 7). */
  budgetStatus: BudgetIndicatorStatus;
  /** Rounded percent of the worst active alert; null when nothing is near a limit. */
  budgetPercent: number | null;
}

function isToday(iso: string | undefined, todayPrefix: string): boolean {
  if (!iso) return false;
  return iso.slice(0, 10) === todayPrefix;
}

function readHistoryItems(): HistoryItem[] {
    const cfg = readKey("config");
    if (!Array.isArray(cfg.history)) return [];
    return cfg.history as HistoryItem[];
}

function countSessionsToday(items: HistoryItem[]): number {
  const today = new Date().toISOString().slice(0, 10);
  return items.filter(
    (it) =>
      isToday(it.startedAt, today) || isToday(it.timestamp, today),
  ).length;
}

function countPinnedWorkspaces(): number {
  return loadWorkspaces().filter((p) => p.pinned).length;
}

function formatTodaySpend(report: UsageReport | null): string {
  if (!report?.entries?.length) return "";
  const today = new Date().toISOString().slice(0, 10);
  const sum = report.entries
    .filter((e) => e.date === today)
    .reduce((acc, e) => acc + e.cost_estimate_usd, 0);
  if (sum <= 0) return "";
  return `$${sum.toFixed(2)}`;
}

/**
 * Worst active budget status (provider AND project scopes — 3c foundation
 * evaluated with the workspace profiles so project keys reconcile, closing
 * the 3c follow-up). Among the worst status, the highest percent wins.
 */
function computeBudgetStatus(report: UsageReport | null): {
  status: BudgetIndicatorStatus;
  percent: number | null;
} {
  if (!report?.entries?.length) return { status: "ok", percent: null };
  const alerts = getBudgetAlerts(report.entries, loadWorkspaces());
  let status: BudgetIndicatorStatus = "ok";
  let percent: number | null = null;
  for (const a of alerts) {
    if (a.status === "exceeded") status = "exceeded";
    else if (a.status === "warning" && status === "ok") status = "warning";
    else continue;
    const rounded = Math.round(a.percentUsed);
    percent = percent === null ? rounded : Math.max(percent, rounded);
  }
  if (status === "ok") return { status, percent: null };
  return { status, percent };
}

/**
 * Computes sidebar indicator counts from localStorage-backed stores.
 * Re-reads when the storage event fires (same-window updates use refreshTick).
 */
export function useSidebarIndicators(
  report: UsageReport | null,
  refreshTick: number = 0,
): SidebarIndicators {
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>(() =>
    readHistoryItems(),
  );
  const [pinned, setPinned] = useState<number>(() => countPinnedWorkspaces());
  const [budgetTick, setBudgetTick] = useState(0);

  useEffect(() => {
    setHistoryItems(readHistoryItems());
    setPinned(countPinnedWorkspaces());
  }, [refreshTick]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.config) setHistoryItems(readHistoryItems());
      if (e.key && e.key.includes("workspace")) {
        setPinned(countPinnedWorkspaces());
      }
      if (e.key && e.key.includes("budget")) {
        setBudgetTick((t) => t + 1);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return useMemo<SidebarIndicators>(() => {
    void budgetTick; // edited budget limits re-read on the storage event
    const budget = computeBudgetStatus(report);
    return {
      historyToday: countSessionsToday(historyItems),
      todaySpend: formatTodaySpend(report),
      pinnedWorkspaces: pinned,
      budgetStatus: budget.status,
      budgetPercent: budget.percent,
    };
  }, [historyItems, report, pinned, budgetTick]);
}
