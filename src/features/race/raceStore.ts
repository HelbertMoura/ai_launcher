import { z } from "zod";
import {
  AdoptReportSchema,
  DiffReportSchema,
  OrphanScanReportSchema,
  RaceCleanupReportSchema,
  RaceHandleSchema,
  RaceHistoryEntrySchema,
  RaceSnapshotSchema,
  isTerminalSnapshotStatus,
  type AdoptReport,
  type DiffReport,
  type RaceAdoptMode,
  type RaceCleanupReport,
  type RaceHandle,
  type RaceHistoryEntry,
  type RaceOrphan,
  type RaceSnapshot,
} from "./types";
import {
  raceAdopt,
  raceCancel,
  raceCleanup,
  raceDiff,
  raceListHistory,
  raceRecover,
  raceScanOrphans,
  raceStart,
  raceStatus,
} from "../../lib/tauri";

// ==============================================================================
// AI Launcher Pro - Race Mode store (v23.2)
//
// Single in-memory state machine for the agent race: idle → configuring →
// running → finished/failed/cancelled (+ adopted after a successful adopt).
// Mirrors the `mcpStore` pattern (one snapshot, subscribe/getSnapshot pair
// for useSyncExternalStore) with two race-specific duties:
//   - every command payload is validated with zod HERE (never inside
//     `lib/tauri.ts`), so contract drift degrades to an error state instead
//     of poisoning the UI;
//   - while a race runs, `race_status` is polled every 2s; the interval is
//     cleared on terminal status, on cancel and on unmount (`dispose`).
// A generation counter invalidates in-flight polls once the race is cancelled
// or reset, so stale responses can never resurrect a closed race.
// v23.2c adds the endgame actions: `loadDiff` (Diff Cockpit), `adopt`
// (branch/apply with conflict report) and `cleanup` (worktree removal after
// the retention window), each with its own in-flight/error/report slots.
// v23.2d adds the graveyard ("Corridas anteriores") and crash recovery:
// `loadHistory` lists terminal races, `restoreFromHistory` reopens one
// (live cockpit while the worktrees exist, read-only archived record
// otherwise), `cleanupFromHistory` removes one immediately, and the
// boot-time `scanOrphans`/`recoverOrphan` pair drives the orphan banner.
// ==============================================================================

export type RacePhase =
  | "idle"
  | "configuring"
  | "starting"
  | "running"
  | "finished"
  | "failed"
  | "cancelled"
  | "adopted";

export interface RaceState {
  phase: RacePhase;
  /** Validated handle of the current (or last) race; null outside a race. */
  handle: RaceHandle | null;
  /** Latest validated poll snapshot; null before the first poll lands. */
  snapshot: RaceSnapshot | null;
  /** Last start/cancel/poll error; cleared by the next successful action. */
  error: string | null;
  cancelling: boolean;
  /** Diff Cockpit (v23.2c): validated reports per agent, keyed by agent. */
  diffs: Record<string, DiffReport>;
  /** Agent whose diff request is in flight. */
  diffLoading: string | null;
  /** Agent + message of the last failed diff request. */
  diffError: { agent: string; message: string } | null;
  /** Adopt in flight: agent + mode. */
  adopting: { agent: string; mode: RaceAdoptMode } | null;
  /** Last adopt report (success, or blocked apply with conflicts). */
  adoptReport: AdoptReport | null;
  /** Message of a thrown adopt failure (command error, not a conflict). */
  adoptError: string | null;
  cleanupRunning: boolean;
  /** Last cleanup report (removals or skipped retention window). */
  cleanupReport: RaceCleanupReport | null;
  cleanupError: string | null;
  // --- Graveyard + crash recovery (23.2d) ----------------------------------
  /** Terminal race records ("Corridas anteriores"), newest first. */
  history: RaceHistoryEntry[];
  historyLoading: boolean;
  /** History/restore/cleanup-from-graveyard error message. */
  historyError: string | null;
  /** Race id whose graveyard cleanup ("Limpar agora") is in flight. */
  historyBusy: string | null;
  /** Last graveyard cleanup/recover report, shown inside the section. */
  historyReport: RaceCleanupReport | null;
  /** Terminal record reopened read-only (worktrees already removed). */
  archivedEntry: RaceHistoryEntry | null;
  /** Orphaned races from the boot-time scan (app died mid-race). */
  orphans: RaceOrphan[];
  orphanScanning: boolean;
  orphanError: string | null;
  /** Orphan race id whose recover (kill + cleanup) is in flight. */
  recovering: string | null;
  /** Orphan race id currently expanded for inspection; null = collapsed. */
  inspectedOrphan: string | null;
}

export interface RaceStartInput {
  directory: string;
  taskPrompt: string;
  agents: string[];
}

/** Backend poll cadence for the live columns (kept light on purpose). */
export const RACE_POLL_INTERVAL_MS = 2000;

/** Retention window (days) mirrored from the backend `DEFAULT_KEEP_DAYS`. */
export const RACE_RETENTION_DAYS = 7;

/** Snapshot status → UI phase once the race is over. */
const TERMINAL_PHASES: Record<string, "finished" | "failed" | "cancelled" | "adopted"> = {
  completed: "finished",
  adopted: "adopted",
  cleaned: "finished",
  failed: "failed",
  cancelled: "cancelled",
};

/** True when the race ended more than the retention window ago. */
export function isRetentionExpired(
  entry: Pick<RaceHistoryEntry, "started_at" | "finished_at">,
  now: number = Date.now(),
): boolean {
  const end = entry.finished_at ?? entry.started_at;
  const endMs = Date.parse(end);
  if (Number.isNaN(endMs)) return false;
  return now - endMs >= RACE_RETENTION_DAYS * 86_400_000;
}

type Listener = (state: RaceState) => void;

const INITIAL_STATE: RaceState = {
  phase: "idle",
  handle: null,
  snapshot: null,
  error: null,
  cancelling: false,
  diffs: {},
  diffLoading: null,
  diffError: null,
  adopting: null,
  adoptReport: null,
  adoptError: null,
  cleanupRunning: false,
  cleanupReport: null,
  cleanupError: null,
  history: [],
  historyLoading: false,
  historyError: null,
  historyBusy: null,
  historyReport: null,
  archivedEntry: null,
  orphans: [],
  orphanScanning: false,
  orphanError: null,
  recovering: null,
  inspectedOrphan: null,
};

let state: RaceState = INITIAL_STATE;
const listeners = new Set<Listener>();
let intervalId: ReturnType<typeof setInterval> | null = null;
let generation = 0;

function emit(): void {
  for (const fn of listeners) fn(state);
}

function setState(partial: Partial<RaceState>): void {
  state = { ...state, ...partial };
  emit();
}

function toMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Rebuilds a full wire handle from a persisted record (history entry or
 * orphan scan hit). The backend resolves everything else from `races.json`;
 * only `race_id` is strictly validated there.
 */
function handleFromRecord(
  record: Pick<
    RaceHistoryEntry,
    "race_id" | "directory" | "base_sha" | "agents" | "branches" | "worktrees" | "started_at"
  >,
): RaceHandle {
  return {
    race_id: record.race_id,
    directory: record.directory,
    base_sha: record.base_sha,
    agents: record.agents,
    branches: record.branches,
    worktrees: record.worktrees,
    warnings: [],
    started_at: record.started_at,
  };
}

function stopPolling(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

async function poll(handle: RaceHandle, gen: number): Promise<void> {
  try {
    const raw = await raceStatus(handle);
    if (gen !== generation) return;
    const parsed = RaceSnapshotSchema.safeParse(raw);
    if (!parsed.success) {
      // Contract drift between frontend and backend: stop the race view with
      // a clear error instead of rendering unvalidated data.
      stopPolling();
      setState({ phase: "failed", snapshot: null, error: parsed.error.message });
      return;
    }
    const snapshot = parsed.data;
    if (isTerminalSnapshotStatus(snapshot.status)) {
      stopPolling();
      setState({
        snapshot,
        phase: TERMINAL_PHASES[snapshot.status] ?? "finished",
        error: null,
      });
      return;
    }
    setState({ snapshot, error: null });
  } catch (e: unknown) {
    if (gen !== generation) return;
    // Transient poll failure: keep polling (the agents may still be alive);
    // a later successful poll clears the message.
    setState({ error: toMessage(e) });
  }
}

function startPolling(handle: RaceHandle): void {
  stopPolling();
  const gen = generation;
  // Immediate first snapshot, then the steady 2s cadence.
  void poll(handle, gen);
  intervalId = setInterval(() => {
    void poll(handle, gen);
  }, RACE_POLL_INTERVAL_MS);
}

export const raceStore = {
  getSnapshot(): RaceState {
    return state;
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /** Opens the form (idle or after a finished race). No-op mid-race. */
  beginConfiguration(): void {
    if (state.phase === "starting" || state.phase === "running") return;
    generation += 1;
    stopPolling();
    setState({ ...INITIAL_STATE, phase: "configuring" });
  },

  /** Closes the form without starting (configuring → idle). */
  cancelConfiguration(): void {
    if (state.phase !== "configuring") return;
    setState({ phase: "idle" });
  },

  /**
   * Starts a race. While the backend call is in flight the phase is
   * `starting`; a validation or command failure returns to `configuring`
   * with the error so the user keeps their form.
   */
  async start(input: RaceStartInput): Promise<void> {
    if (state.phase === "starting" || state.phase === "running") return;
    // Defensive dedupe/filter — the form already blocks duplicates upstream.
    const agents = [...new Set(input.agents.map((a) => a.trim()).filter(Boolean))];
    generation += 1;
    const gen = generation;
    stopPolling();
    // A new race never inherits the previous race's cockpit/adopt/cleanup
    // state.
    setState({ ...INITIAL_STATE, phase: "starting" });
    try {
      const raw = await raceStart(input.directory.trim(), input.taskPrompt, agents);
      if (gen !== generation) return;
      const parsed = RaceHandleSchema.safeParse(raw);
      if (!parsed.success) {
        setState({ phase: "configuring", error: parsed.error.message });
        return;
      }
      setState({ phase: "running", handle: parsed.data });
      startPolling(parsed.data);
    } catch (e: unknown) {
      if (gen !== generation) return;
      setState({ phase: "configuring", error: toMessage(e) });
    }
  },

  /**
   * Cancels the running race (kills agent processes backend-side). A
   * best-effort final snapshot fills the columns with the killed/exit states;
   * if it is unavailable the cancelled banner alone is enough.
   */
  async cancel(): Promise<void> {
    if (state.phase !== "running" || state.cancelling || !state.handle) return;
    const handle = state.handle;
    setState({ cancelling: true, error: null });
    try {
      await raceCancel(handle);
    } catch (e: unknown) {
      if (state.handle !== handle) return;
      // Still running: let the user retry the cancel.
      setState({ cancelling: false, error: toMessage(e) });
      return;
    }
    // A reset (or a new configuration) during the cancel call must not be
    // overwritten by this stale completion.
    if (state.handle !== handle) return;
    stopPolling();
    generation += 1;
    const finalGen = generation;
    try {
      const raw = await raceStatus(handle);
      if (finalGen === generation) {
        const parsed = RaceSnapshotSchema.safeParse(raw);
        if (parsed.success) {
          setState({ snapshot: parsed.data, phase: "cancelled", cancelling: false });
          return;
        }
      }
    } catch {
      /* fall through to the banner-only terminal state */
    }
    if (finalGen === generation) {
      setState({ phase: "cancelled", cancelling: false });
    }
  },

  /**
   * Restarts the poll cadence for a race that is already running — e.g. the
   * surface remounted after an unmount mid-race. No-op outside a running
   * race. Reuses the current generation and clears any existing timer first,
   * so a repeated call never duplicates the interval.
   */
  resumePolling(): void {
    if (state.phase !== "running" || !state.handle) return;
    startPolling(state.handle);
  },

  /**
   * Loads one agent's diff for the Cockpit (v23.2c). Requests for the same
   * agent are deduplicated while in flight; repeated calls once settled fetch
   * fresh data (an agent may still be working), and the RacePage effect skips
   * agents whose report is already cached. A failure degrades to `diffError`
   * and keeps previously loaded reports.
   */
  async loadDiff(agent: string): Promise<void> {
    const handle = state.handle;
    if (!handle || state.diffLoading === agent) return;
    if (
      state.phase === "idle" ||
      state.phase === "configuring" ||
      state.phase === "starting"
    ) {
      return;
    }
    setState({ diffLoading: agent, diffError: null });
    try {
      const raw = await raceDiff(handle, agent);
      if (state.handle !== handle) return;
      const parsed = DiffReportSchema.safeParse(raw);
      if (!parsed.success) {
        setState({
          diffLoading: null,
          diffError: { agent, message: parsed.error.message },
        });
        return;
      }
      setState({
        diffLoading: null,
        diffError: null,
        diffs: { ...state.diffs, [agent]: parsed.data },
      });
    } catch (e: unknown) {
      if (state.handle !== handle) return;
      setState({ diffLoading: null, diffError: { agent, message: toMessage(e) } });
    }
  },

  /**
   * Adopts one agent's result (v23.2c). `branch` (default) points an adoption
   * branch at the race tip without touching the working tree; `apply` patches
   * the main tree and fails atomically — a conflict comes back as a report
   * (`adoptReport.ok === false`), not as a thrown error, so the UI can list
   * it per file. On success the race lands on the `adopted` phase and any
   * in-flight polling is stopped.
   */
  async adopt(agent: string, mode: RaceAdoptMode): Promise<void> {
    const handle = state.handle;
    if (!handle || state.adopting) return;
    if (
      state.phase === "idle" ||
      state.phase === "configuring" ||
      state.phase === "starting"
    ) {
      return;
    }
    setState({ adopting: { agent, mode }, adoptError: null, adoptReport: null });
    try {
      const raw = await raceAdopt(handle, agent, mode);
      if (state.handle !== handle) return;
      const parsed = AdoptReportSchema.safeParse(raw);
      if (!parsed.success) {
        setState({ adopting: null, adoptError: parsed.error.message });
        return;
      }
      const report = parsed.data;
      if (!report.ok) {
        setState({ adopting: null, adoptReport: report });
        return;
      }
      // Successful adoption flips the race to its terminal "adopted" status;
      // the generation bump invalidates polls still in flight.
      generation += 1;
      stopPolling();
      setState({
        adopting: null,
        adoptReport: report,
        snapshot: state.snapshot
          ? { ...state.snapshot, status: "adopted" }
          : null,
        phase: "adopted",
      });
    } catch (e: unknown) {
      if (state.handle !== handle) return;
      setState({ adopting: null, adoptError: toMessage(e) });
    }
  },

  /**
   * Removes the race worktrees and branches (`race_cleanup`, v23.2c). The
   * backend only removes them after the retention window (`keepDays`, default
   * 7); inside the window it returns a skipped report, which the UI shows
   * verbatim — nothing is invented client-side.
   */
  async cleanup(keepDays: number = 7): Promise<void> {
    const handle = state.handle;
    if (!handle || state.cleanupRunning) return;
    setState({ cleanupRunning: true, cleanupError: null });
    try {
      const raw = await raceCleanup(handle, keepDays);
      if (state.handle !== handle) return;
      const parsed = RaceCleanupReportSchema.safeParse(raw);
      if (!parsed.success) {
        setState({ cleanupRunning: false, cleanupError: parsed.error.message });
        return;
      }
      const report = parsed.data;
      setState({
        cleanupRunning: false,
        cleanupReport: report,
        snapshot:
          report.skipped_reason === null && state.snapshot
            ? { ...state.snapshot, status: "cleaned" }
            : state.snapshot,
      });
    } catch (e: unknown) {
      if (state.handle !== handle) return;
      setState({ cleanupRunning: false, cleanupError: toMessage(e) });
    }
  },

  /** Full teardown back to idle ("New race" / tests). */
  reset(): void {
    generation += 1;
    stopPolling();
    state = INITIAL_STATE;
    emit();
  },

  /**
   * Clears the poll interval on unmount without mutating state, so a
   * component teardown never leaves a timer behind.
   */
  dispose(): void {
    stopPolling();
  },

  // --- Graveyard + crash recovery (23.2d) ----------------------------------

  /**
   * Loads the terminal race records for the "Corridas anteriores" section.
   * Contract drift degrades to `historyError` instead of rendering
   * unvalidated records.
   */
  async loadHistory(): Promise<void> {
    setState({ historyLoading: true, historyError: null });
    try {
      const raw = await raceListHistory();
      const parsed = z.array(RaceHistoryEntrySchema).safeParse(raw);
      if (!parsed.success) {
        // Contract drift: nothing from this response is rendered, not even
        // the previously loaded records.
        setState({ history: [], historyLoading: false, historyError: parsed.error.message });
        return;
      }
      setState({ history: parsed.data, historyLoading: false });
    } catch (e: unknown) {
      setState({ historyLoading: false, historyError: toMessage(e) });
    }
  },

  /**
   * Reopens a graveyard race. With the worktrees still on disk the full
   * cockpit is restored: the handle is rebuilt from the record and a fresh
   * `race_status` snapshot feeds the columns (diffs remain consultable).
   * Otherwise the race is archived: only the read-only record view opens —
   * no handle, no diffs, nothing invented. No-op while a race is starting or
   * running.
   */
  async restoreFromHistory(entry: RaceHistoryEntry): Promise<void> {
    if (state.phase === "starting" || state.phase === "running") return;
    const archived = entry.status === "cleaned" || !entry.worktrees_present;
    if (archived) {
      generation += 1;
      stopPolling();
      setState({
        ...INITIAL_STATE,
        phase: TERMINAL_PHASES[entry.status] ?? "finished",
        archivedEntry: entry,
      });
      return;
    }
    const handle = handleFromRecord(entry);
    setState({ historyError: null });
    try {
      const raw = await raceStatus(handle);
      const parsed = RaceSnapshotSchema.safeParse(raw);
      if (!parsed.success) {
        setState({ historyError: parsed.error.message });
        return;
      }
      generation += 1;
      stopPolling();
      setState({
        ...INITIAL_STATE,
        phase: TERMINAL_PHASES[parsed.data.status] ?? "finished",
        handle,
        snapshot: parsed.data,
      });
    } catch (e: unknown) {
      setState({ historyError: toMessage(e) });
    }
  },

  /**
   * "Limpar agora" on a graveyard race: `race_cleanup` with `keepDays = 0`
   * removes the worktrees and branches immediately. The report lands in
   * `historyReport` and the section reloads afterwards.
   */
  async cleanupFromHistory(entry: RaceHistoryEntry): Promise<void> {
    if (state.historyBusy) return;
    setState({ historyBusy: entry.race_id, historyError: null, historyReport: null });
    try {
      const raw = await raceCleanup(handleFromRecord(entry), 0);
      const parsed = RaceCleanupReportSchema.safeParse(raw);
      if (!parsed.success) {
        setState({ historyBusy: null, historyError: parsed.error.message });
        return;
      }
      setState({ historyBusy: null, historyReport: parsed.data });
      await raceStore.loadHistory();
    } catch (e: unknown) {
      setState({ historyBusy: null, historyError: toMessage(e) });
    }
  },

  /**
   * Boot-time orphan scan: races recorded as "running" whose runtime died
   * with a previous app session. Cheap (one local JSON read), so the Race
   * surface runs it on every mount.
   */
  async scanOrphans(): Promise<void> {
    if (state.orphanScanning) return;
    setState({ orphanScanning: true, orphanError: null });
    try {
      const raw = await raceScanOrphans();
      const parsed = OrphanScanReportSchema.safeParse(raw);
      if (!parsed.success) {
        setState({ orphanScanning: false, orphanError: parsed.error.message });
        return;
      }
      setState({ orphans: parsed.data.orphans, orphanScanning: false });
    } catch (e: unknown) {
      setState({ orphanScanning: false, orphanError: toMessage(e) });
    }
  },

  /**
   * Recovers one orphaned race: the backend kills the persisted agent pids
   * and immediately cleans the worktrees/branches up. The orphan leaves the
   * banner right away (the scan is a boot-time snapshot, not polled) and the
   * graveyard reloads with the new "cleaned" record.
   */
  async recoverOrphan(orphan: RaceOrphan): Promise<void> {
    if (state.recovering) return;
    setState({ recovering: orphan.race_id, orphanError: null, historyReport: null });
    try {
      const raw = await raceRecover(handleFromRecord(orphan));
      const parsed = RaceCleanupReportSchema.safeParse(raw);
      if (!parsed.success) {
        setState({ recovering: null, orphanError: parsed.error.message });
        return;
      }
      setState({
        recovering: null,
        historyReport: parsed.data,
        inspectedOrphan: null,
        orphans: state.orphans.filter((o) => o.race_id !== orphan.race_id),
      });
      await raceStore.loadHistory();
    } catch (e: unknown) {
      setState({ recovering: null, orphanError: toMessage(e) });
    }
  },

  /** Expands/collapses the inline orphan details ("Inspecionar"). */
  inspectOrphan(raceId: string | null): void {
    setState({ inspectedOrphan: raceId });
  },
};
