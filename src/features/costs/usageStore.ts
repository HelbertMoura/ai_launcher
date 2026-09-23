import { useSyncExternalStore } from "react";
import { readUsageStats } from "../../lib/tauri";
import { UsageReportSchema, type UsageEntry, type UsageReport } from "./types";

// ==============================================================================
// AI Launcher Pro - Usage store (v23 Cost Governance 3.0, wave 3b)
//
// Single shared source for the `read_usage_stats` report. Replaces the four
// independent per-component invokes (App boot, CostsPage, BudgetDashboard,
// BudgetSummaryCard) with one cached snapshot, following the `raceStore`
// pattern: one immutable snapshot + subscribe/getSnapshot pair for
// useSyncExternalStore, and the payload validated with zod HERE (never
// inside `lib/tauri.ts`) so contract drift degrades to an error state
// instead of poisoning the UI. No polling: the report is fetched on boot and
// revalidated on explicit `refresh()` calls only.
// ==============================================================================

export interface UsageState {
  /** Latest validated report; null before the first successful fetch. */
  report: UsageReport | null;
  /** True while a refresh is in flight. */
  loading: boolean;
  /** Last validation or command error; cleared when the next refresh starts. */
  error: string | null;
  /** Wall-clock ms of the last successful fetch; null before it. */
  fetchedAt: number | null;
}

type Listener = (state: UsageState) => void;

const INITIAL_STATE: UsageState = {
  report: null,
  loading: false,
  error: null,
  fetchedAt: null,
};

let state: UsageState = INITIAL_STATE;
const listeners = new Set<Listener>();
/** Shared in-flight refresh; concurrent callers never duplicate the invoke. */
let inflight: Promise<void> | null = null;

function emit(): void {
  for (const fn of listeners) fn(state);
}

function setState(partial: Partial<UsageState>): void {
  state = { ...state, ...partial };
  emit();
}

function toMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export const usageStore = {
  getSnapshot(): UsageState {
    return state;
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /**
   * Fetches the usage report through the typed wrapper and validates it.
   * `force: true` bypasses the backend mtime cache; omitted/false keeps the
   * default cached read (the pre-store wire behavior). Concurrent calls share
   * the single in-flight request. Contract drift clears the report (nothing
   * is rendered unvalidated) and lands in `error`; a command failure keeps
   * the previous report and only surfaces the error.
   */
  async refresh(force?: boolean): Promise<void> {
    if (inflight) return inflight;
    setState({ loading: true, error: null });
    inflight = (async () => {
      try {
        const raw = await readUsageStats(force ? true : undefined);
        const parsed = UsageReportSchema.safeParse(raw);
        if (!parsed.success) {
          setState({ report: null, loading: false, error: parsed.error.message });
          return;
        }
        setState({
          report: parsed.data,
          loading: false,
          error: null,
          fetchedAt: Date.now(),
        });
      } catch (e: unknown) {
        setState({ loading: false, error: toMessage(e) });
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  },

  /** Full teardown back to the pristine state (tests). */
  reset(): void {
    inflight = null;
    state = INITIAL_STATE;
    emit();
  },
};

/** React binding: subscribes the component to the shared usage snapshot. */
export function useUsageStore(): UsageState {
  return useSyncExternalStore(usageStore.subscribe, usageStore.getSnapshot);
}

const EMPTY_ENTRIES: UsageEntry[] = [];

/** Light selector: entries of the current report (empty before the first fetch). */
export function useUsageEntries(): UsageEntry[] {
  return useUsageStore().report?.entries ?? EMPTY_ENTRIES;
}
