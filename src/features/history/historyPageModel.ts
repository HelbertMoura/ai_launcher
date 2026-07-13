import type { HistoryItem } from "./useHistory";

export interface HistoryOverview {
  active: number;
  failed: number;
  completed: number;
  averageDuration: number;
}

const isActive = (item: HistoryItem) =>
  item.status === "running" || item.status === "starting";

export function buildHistoryOverview(items: HistoryItem[]): HistoryOverview {
  const durations = items
    .map((item) => item.duration)
    .filter((duration): duration is number => typeof duration === "number" && duration > 0);
  return {
    active: items.filter(isActive).length,
    failed: items.filter((item) => item.status === "failed").length,
    completed: items.filter((item) => item.status === "completed").length,
    averageDuration: durations.length
      ? Math.round(durations.reduce((total, duration) => total + duration, 0) / durations.length)
      : 0,
  };
}

export function sortSessionsByPriority(items: HistoryItem[]): HistoryItem[] {
  return [...items].sort((left, right) => {
    const activeDelta = Number(isActive(right)) - Number(isActive(left));
    if (activeDelta !== 0) return activeDelta;
    return Date.parse(right.timestamp) - Date.parse(left.timestamp);
  });
}
