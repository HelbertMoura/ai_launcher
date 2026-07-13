export type HistoryFilterRange = "today" | "week" | "month" | "all";

export interface HistoryFilters {
  cli: string;
  provider: string;
  range: HistoryFilterRange;
  timelineRange: "24h" | "7d";
  timelineOpen: boolean;
}

export const DEFAULT_HISTORY_FILTERS: HistoryFilters = {
  cli: "all",
  provider: "all",
  range: "all",
  timelineRange: "24h",
  timelineOpen: true,
};

const VALID_RANGES = new Set<HistoryFilterRange>(["today", "week", "month", "all"]);
const VALID_TIMELINE_RANGES = new Set(["24h", "7d"]);

export function normalizeHistoryFilters(raw: unknown): HistoryFilters {
  if (!raw || typeof raw !== "object") return DEFAULT_HISTORY_FILTERS;
  const data = raw as Partial<Record<keyof HistoryFilters, unknown>>;
  return {
    cli: typeof data.cli === "string" && data.cli ? data.cli : DEFAULT_HISTORY_FILTERS.cli,
    provider:
      typeof data.provider === "string" && data.provider
        ? data.provider
        : DEFAULT_HISTORY_FILTERS.provider,
    range:
      typeof data.range === "string" && VALID_RANGES.has(data.range as HistoryFilterRange)
        ? (data.range as HistoryFilterRange)
        : DEFAULT_HISTORY_FILTERS.range,
    timelineRange:
      typeof data.timelineRange === "string" && VALID_TIMELINE_RANGES.has(data.timelineRange)
        ? (data.timelineRange as "24h" | "7d")
        : DEFAULT_HISTORY_FILTERS.timelineRange,
    timelineOpen:
      typeof data.timelineOpen === "boolean"
        ? data.timelineOpen
        : DEFAULT_HISTORY_FILTERS.timelineOpen,
  };
}

export function loadHistoryFilters(): HistoryFilters {
  return normalizeHistoryFilters(readKey("historyFilters"));
}

export function saveHistoryFilters(filters: HistoryFilters): void {
  writeKey("historyFilters", normalizeHistoryFilters(filters));
}
import { readKey, writeKey } from "../../lib/storage";
