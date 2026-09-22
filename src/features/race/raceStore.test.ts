import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const raceStartMock = vi.hoisted(() => vi.fn());
const raceStatusMock = vi.hoisted(() => vi.fn());
const raceCancelMock = vi.hoisted(() => vi.fn());

vi.mock("../../lib/tauri", () => ({
  raceStart: raceStartMock,
  raceStatus: raceStatusMock,
  raceCancel: raceCancelMock,
}));

import { RACE_POLL_INTERVAL_MS, raceStore } from "./raceStore";
import type { RaceHandle, RaceSnapshot } from "./types";

const HANDLE: RaceHandle = {
  race_id: "race-1",
  directory: "C:/proj",
  base_sha: "abc123",
  agents: ["claude", "codex"],
  branches: ["race/race-1/claude", "race/race-1/codex"],
  worktrees: ["C:/races/race-1/claude", "C:/races/race-1/codex"],
  warnings: ["worktree dependencies warning"],
  started_at: "2026-09-22T10:00:00.000Z",
};

function snapshot(overrides: Partial<RaceSnapshot> = {}): RaceSnapshot {
  return {
    race_id: HANDLE.race_id,
    directory: HANDLE.directory,
    status: "running",
    base_sha: HANDLE.base_sha,
    started_at: HANDLE.started_at,
    warnings: HANDLE.warnings,
    agents: HANDLE.agents.map((agent, i) => ({
      agent,
      status: "running",
      pid: 100 + i,
      exit_code: null,
      duration_secs: 3,
      last_log_lines: ["line one", "line two"],
    })),
    ...overrides,
  };
}

async function flush(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

beforeEach(() => {
  vi.useFakeTimers();
  raceStartMock.mockReset();
  raceStatusMock.mockReset();
  raceCancelMock.mockReset();
  raceStore.reset();
});

afterEach(() => {
  raceStore.dispose();
  vi.useRealTimers();
});

describe("raceStore", () => {
  it("moves idle → configuring → starting → running with the validated handle", async () => {
    expect(raceStore.getSnapshot().phase).toBe("idle");
    raceStore.beginConfiguration();
    expect(raceStore.getSnapshot().phase).toBe("configuring");

    raceStartMock.mockResolvedValue(HANDLE);
    raceStatusMock.mockResolvedValue(snapshot());
    const done = raceStore.start({
      directory: "  C:/proj  ",
      taskPrompt: "refactor the parser",
      agents: ["claude", "claude", "codex"],
    });

    expect(raceStore.getSnapshot().phase).toBe("starting");
    await flush();
    await done;

    const s = raceStore.getSnapshot();
    expect(s.phase).toBe("running");
    // Duplicate agents are deduped before reaching the command layer.
    expect(raceStartMock).toHaveBeenCalledWith("C:/proj", "refactor the parser", [
      "claude",
      "codex",
    ]);
    expect(s.handle).toEqual(HANDLE);
    // The immediate first poll landed.
    expect(s.snapshot?.status).toBe("running");
  });

  it("start failure returns to configuring with the backend error", async () => {
    raceStore.beginConfiguration();
    raceStartMock.mockRejectedValue(new Error("boom"));

    await raceStore.start({ directory: "C:/proj", taskPrompt: "x", agents: ["claude"] });

    const s = raceStore.getSnapshot();
    expect(s.phase).toBe("configuring");
    expect(s.error).toBe("boom");
    expect(s.handle).toBeNull();
  });

  it("ignores start while a race is starting or already running", async () => {
    raceStartMock.mockResolvedValue(HANDLE);
    raceStatusMock.mockResolvedValue(snapshot());
    const first = raceStore.start({ directory: "C:/proj", taskPrompt: "x", agents: ["claude"] });
    await flush();

    await raceStore.start({ directory: "C:/other", taskPrompt: "y", agents: ["codex"] });
    await first;

    // Only the first start reached the command layer.
    expect(raceStartMock).toHaveBeenCalledTimes(1);
  });

  it("polls every 2s while running and finishes on a terminal snapshot", async () => {
    raceStartMock.mockResolvedValue(HANDLE);
    raceStatusMock
      .mockResolvedValueOnce(snapshot())
      .mockResolvedValueOnce(snapshot())
      .mockResolvedValue(
        snapshot({
          status: "completed",
          agents: HANDLE.agents.map((agent) => ({
            agent,
            status: "completed",
            pid: null,
            exit_code: 0,
            duration_secs: 42,
            last_log_lines: [],
          })),
        }),
      );

    await raceStore.start({ directory: "C:/proj", taskPrompt: "x", agents: ["claude", "codex"] });
    expect(raceStatusMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(RACE_POLL_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(RACE_POLL_INTERVAL_MS);
    expect(raceStatusMock).toHaveBeenCalledTimes(3);

    const s = raceStore.getSnapshot();
    expect(s.phase).toBe("finished");
    expect(s.snapshot?.agents[0]).toMatchObject({ status: "completed", exit_code: 0 });
    expect(s.error).toBeNull();

    // Terminal state clears the interval: no further polls happen.
    raceStatusMock.mockClear();
    await vi.advanceTimersByTimeAsync(RACE_POLL_INTERVAL_MS * 5);
    expect(raceStatusMock).not.toHaveBeenCalled();
  });

  it("fails the race with the zod message when a snapshot breaks the contract", async () => {
    raceStartMock.mockResolvedValue(HANDLE);
    raceStatusMock.mockResolvedValue({ status: "running" }); // missing fields

    await raceStore.start({ directory: "C:/proj", taskPrompt: "x", agents: ["claude"] });
    await vi.advanceTimersByTimeAsync(RACE_POLL_INTERVAL_MS);

    const s = raceStore.getSnapshot();
    expect(s.phase).toBe("failed");
    expect(s.error).toContain("race_id");
    // The interval stopped: no further polls after the contract failure.
    raceStatusMock.mockClear();
    await vi.advanceTimersByTimeAsync(RACE_POLL_INTERVAL_MS * 3);
    expect(raceStatusMock).not.toHaveBeenCalled();
  });

  it("surfaces a poll failure but keeps polling", async () => {
    raceStartMock.mockResolvedValue(HANDLE);
    raceStatusMock
      .mockRejectedValueOnce(new Error("status unavailable"))
      .mockResolvedValue(snapshot());

    await raceStore.start({ directory: "C:/proj", taskPrompt: "x", agents: ["claude"] });
    expect(raceStore.getSnapshot().error).toBe("status unavailable");

    await vi.advanceTimersByTimeAsync(RACE_POLL_INTERVAL_MS);
    expect(raceStore.getSnapshot()).toMatchObject({ phase: "running", error: null });
  });

  it("cancel stops polling, records the final snapshot and lands on cancelled", async () => {
    raceStartMock.mockResolvedValue(HANDLE);
    raceStatusMock.mockResolvedValue(snapshot());
    raceCancelMock.mockResolvedValue(undefined);

    await raceStore.start({ directory: "C:/proj", taskPrompt: "x", agents: ["claude", "codex"] });
    raceStatusMock.mockResolvedValueOnce(
      snapshot({
        status: "cancelled",
        agents: HANDLE.agents.map((agent) => ({
          agent,
          status: "killed",
          pid: null,
          exit_code: null,
          duration_secs: 7,
          last_log_lines: [],
        })),
      }),
    );
    const cancelling = raceStore.cancel();
    expect(raceStore.getSnapshot().cancelling).toBe(true);
    await cancelling;

    expect(raceCancelMock).toHaveBeenCalledWith(HANDLE);
    const s = raceStore.getSnapshot();
    expect(s.phase).toBe("cancelled");
    expect(s.cancelling).toBe(false);
    expect(s.snapshot?.agents[0].status).toBe("killed");

    raceStatusMock.mockClear();
    await vi.advanceTimersByTimeAsync(RACE_POLL_INTERVAL_MS * 3);
    expect(raceStatusMock).not.toHaveBeenCalled();
  });

  it("cancel failure surfaces the error and keeps the race running", async () => {
    raceStartMock.mockResolvedValue(HANDLE);
    raceStatusMock.mockResolvedValue(snapshot());
    raceCancelMock.mockRejectedValue(new Error("cancel refused"));

    await raceStore.start({ directory: "C:/proj", taskPrompt: "x", agents: ["claude"] });
    await raceStore.cancel();

    const s = raceStore.getSnapshot();
    expect(s.phase).toBe("running");
    expect(s.cancelling).toBe(false);
    expect(s.error).toBe("cancel refused");
  });

  it("resumePolling restarts the cadence after a mid-race dispose", async () => {
    raceStartMock.mockResolvedValue(HANDLE);
    raceStatusMock.mockResolvedValue(snapshot());

    await raceStore.start({ directory: "C:/proj", taskPrompt: "x", agents: ["claude"] });

    // Surface unmounts mid-race: interval cleared, state kept intact.
    raceStore.dispose();
    expect(raceStore.getSnapshot().phase).toBe("running");
    raceStatusMock.mockClear();
    await vi.advanceTimersByTimeAsync(RACE_POLL_INTERVAL_MS * 2);
    expect(raceStatusMock).not.toHaveBeenCalled(); // frozen while disposed

    // Remount resumes the cadence with the same generation counter.
    raceStore.resumePolling();
    expect(raceStatusMock.mock.calls.length).toBe(1); // immediate poll on resume
    raceStore.resumePolling(); // idempotent: must not duplicate the timer
    expect(raceStatusMock.mock.calls.length).toBe(2); // resume re-polls immediately
    const before = raceStatusMock.mock.calls.length;
    await vi.advanceTimersByTimeAsync(RACE_POLL_INTERVAL_MS);
    // Exactly one tick in the window — a duplicated timer would tick twice.
    expect(raceStatusMock.mock.calls.length - before).toBe(1);

    // The resumed race still reaches its terminal state and stops polling.
    raceStatusMock.mockResolvedValue(snapshot({ status: "completed" }));
    await vi.advanceTimersByTimeAsync(RACE_POLL_INTERVAL_MS);
    expect(raceStore.getSnapshot().phase).toBe("finished");
    raceStatusMock.mockClear();
    await vi.advanceTimersByTimeAsync(RACE_POLL_INTERVAL_MS * 2);
    expect(raceStatusMock).not.toHaveBeenCalled();

    // No-op outside a running race.
    raceStore.reset();
    raceStatusMock.mockClear();
    raceStore.resumePolling();
    await vi.advanceTimersByTimeAsync(RACE_POLL_INTERVAL_MS);
    expect(raceStatusMock).not.toHaveBeenCalled();
  });

  it("reset tears the store down to idle and clears the interval", async () => {
    raceStartMock.mockResolvedValue(HANDLE);
    raceStatusMock.mockResolvedValue(snapshot());

    await raceStore.start({ directory: "C:/proj", taskPrompt: "x", agents: ["claude"] });
    raceStore.reset();

    const s = raceStore.getSnapshot();
    expect(s).toMatchObject({ phase: "idle", handle: null, snapshot: null, error: null });

    raceStatusMock.mockClear();
    await vi.advanceTimersByTimeAsync(RACE_POLL_INTERVAL_MS * 3);
    expect(raceStatusMock).not.toHaveBeenCalled();
  });

  it("notifies subscribers on every state transition", async () => {
    const seen: string[] = [];
    const unsubscribe = raceStore.subscribe((s) => seen.push(s.phase));
    raceStartMock.mockResolvedValue(HANDLE);
    raceStatusMock.mockResolvedValue(snapshot({ status: "completed" }));

    raceStore.beginConfiguration();
    await raceStore.start({ directory: "C:/proj", taskPrompt: "x", agents: ["claude"] });
    await vi.advanceTimersByTimeAsync(RACE_POLL_INTERVAL_MS);
    unsubscribe();

    expect(seen).toEqual(["configuring", "starting", "running", "finished"]);
  });
});
