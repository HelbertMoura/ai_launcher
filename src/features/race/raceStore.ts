import {
  RaceHandleSchema,
  RaceSnapshotSchema,
  isTerminalSnapshotStatus,
  type RaceHandle,
  type RaceSnapshot,
} from "./types";
import { raceCancel, raceStart, raceStatus } from "../../lib/tauri";

// ==============================================================================
// AI Launcher Pro - Race Mode store (v23.2)
//
// Single in-memory state machine for the agent race: idle → configuring →
// running → finished/failed/cancelled. Mirrors the `mcpStore` pattern (one
// snapshot, subscribe/getSnapshot pair for useSyncExternalStore) with two
// race-specific duties:
//   - every command payload is validated with zod HERE (never inside
//     `lib/tauri.ts`), so contract drift degrades to an error state instead
//     of poisoning the UI;
//   - while a race runs, `race_status` is polled every 2s; the interval is
//     cleared on terminal status, on cancel and on unmount (`dispose`).
// A generation counter invalidates in-flight polls once the race is cancelled
// or reset, so stale responses can never resurrect a closed race.
// ==============================================================================

export type RacePhase =
  | "idle"
  | "configuring"
  | "starting"
  | "running"
  | "finished"
  | "failed"
  | "cancelled";

export interface RaceState {
  phase: RacePhase;
  /** Validated handle of the current (or last) race; null outside a race. */
  handle: RaceHandle | null;
  /** Latest validated poll snapshot; null before the first poll lands. */
  snapshot: RaceSnapshot | null;
  /** Last start/cancel/poll error; cleared by the next successful action. */
  error: string | null;
  cancelling: boolean;
}

export interface RaceStartInput {
  directory: string;
  taskPrompt: string;
  agents: string[];
}

/** Backend poll cadence for the live columns (kept light on purpose). */
export const RACE_POLL_INTERVAL_MS = 2000;

/** Snapshot status → UI phase once the race is over. */
const TERMINAL_PHASES: Record<string, "finished" | "failed" | "cancelled"> = {
  completed: "finished",
  adopted: "finished",
  cleaned: "finished",
  failed: "failed",
  cancelled: "cancelled",
};

type Listener = (state: RaceState) => void;

const INITIAL_STATE: RaceState = {
  phase: "idle",
  handle: null,
  snapshot: null,
  error: null,
  cancelling: false,
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
    setState({
      phase: "configuring",
      handle: null,
      snapshot: null,
      error: null,
      cancelling: false,
    });
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
    setState({
      phase: "starting",
      handle: null,
      snapshot: null,
      error: null,
      cancelling: false,
    });
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
};
