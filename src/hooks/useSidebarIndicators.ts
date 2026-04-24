// ==============================================================================
// AI Launcher Pro - Sidebar Indicators Hook
// Computes lightweight status chips shown next to sidebar menu items.
// ==============================================================================

import { useEffect, useMemo, useState } from "react";
import type { UsageReport } from "../features/costs/useUsage";
import { loadWorkspaces } from "../features/workspace/workspaceStore";
import type { HistoryItem } from "../features/history/useHistory";

export interface SidebarIndicators {
  /** Number of sessions started today (YYYY-MM-DD match on startedAt/timestamp). */
  historyToday: number;
  /** Today's spend formatted as USD string; empty string if zero. */
  todaySpend: string;
  /** Number of pinned workspace profiles. */
  pinnedWorkspaces: number;
}

const CONFIG_KEY = "ai-launcher-config";

function isToday(iso: string | undefined, todayPrefix: string): boolean {
  if (!iso) return false;
  return iso.slice(0, 10) === todayPrefix;
}

function readHistoryItems(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return [];
    const cfg = JSON.parse(raw) as Record<string, unknown>;
    if (!Array.isArray(cfg.history)) return [];
    return cfg.history as HistoryItem[];
  } catch {
    return [];
  }
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

  useEffect(() => {
    setHistoryItems(readHistoryItems());
    setPinned(countPinnedWorkspaces());
  }, [refreshTick]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === CONFIG_KEY) setHistoryItems(readHistoryItems());
      if (e.key && e.key.includes("workspace")) {
        setPinned(countPinnedWorkspaces());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return useMemo<SidebarIndicators>(
    () => ({
      historyToday: countSessionsToday(historyItems),
      todaySpend: formatTodaySpend(report),
      pinnedWorkspaces: pinned,
    }),
    [historyItems, report, pinned],
  );
}
