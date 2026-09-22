import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const raceStartMock = vi.hoisted(() => vi.fn());
const raceStatusMock = vi.hoisted(() => vi.fn());
const raceCancelMock = vi.hoisted(() => vi.fn());
const raceDiffMock = vi.hoisted(() => vi.fn());
const raceAdoptMock = vi.hoisted(() => vi.fn());
const raceCleanupMock = vi.hoisted(() => vi.fn());
const raceScanOrphansMock = vi.hoisted(() => vi.fn());
const raceRecoverMock = vi.hoisted(() => vi.fn());
const raceListHistoryMock = vi.hoisted(() => vi.fn());

vi.mock("../../lib/tauri", () => ({
  raceStart: raceStartMock,
  raceStatus: raceStatusMock,
  raceCancel: raceCancelMock,
  raceDiff: raceDiffMock,
  raceAdopt: raceAdoptMock,
  raceCleanup: raceCleanupMock,
  raceScanOrphans: raceScanOrphansMock,
  raceRecover: raceRecoverMock,
  raceListHistory: raceListHistoryMock,
}));

import {
  RACE_POLL_INTERVAL_MS,
  isRetentionExpired,
  raceStore,
} from "./raceStore";
import type {
  AdoptReport,
  DiffReport,
  RaceCleanupReport,
  RaceHandle,
  RaceHistoryEntry,
  RaceOrphan,
  RaceSnapshot,
} from "./types";

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

const DIFF: DiffReport = {
  agent: "claude",
  files: [
    { path: "src/parser.ts", adds: 12, dels: 3 },
    { path: "assets/logo.png", adds: null, dels: null },
  ],
  total_adds: 12,
  total_dels: 3,
  patch: "diff --git a/src/parser.ts b/src/parser.ts\n@@ -1,2 +1,3 @@\n-old\n+new\n ctx\n",
  truncated: false,
};

const ADOPT_OK: AdoptReport = {
  mode: "branch",
  ok: true,
  branch: "race-adopted/claude-race-1",
  conflicts: [],
  message: "Branch criada com o resultado do agente claude.",
};

const ADOPT_CONFLICT: AdoptReport = {
  mode: "apply",
  ok: false,
  branch: null,
  conflicts: [{ path: "src/parser.ts", reason: "o arquivo já existe na árvore principal" }],
  message: "Aplicação bloqueada: o patch conflita com o estado atual do repositório.",
};

const CLEANUP: RaceCleanupReport = {
  race_id: "race-1",
  removed_worktrees: ["C:/races/race-1/claude", "C:/races/race-1/codex"],
  removed_branches: ["race/race-1/claude", "race/race-1/codex"],
  pruned: true,
  skipped_reason: null,
  unverified_processes: [],
};

/** Starts a race and drives it to the terminal "completed" state. */
async function startFinishedRace(): Promise<void> {
  raceStartMock.mockResolvedValue(HANDLE);
  raceStatusMock.mockResolvedValue(
    snapshot({
      status: "completed",
      agents: HANDLE.agents.map((agent) => ({
        agent,
        status: "completed",
        pid: null,
        exit_code: 0,
        duration_secs: 12,
        last_log_lines: [],
      })),
    }),
  );
  await raceStore.start({ directory: "C:/proj", taskPrompt: "x", agents: ["claude", "codex"] });
}

// --- v23.2d fixtures: graveyard + crash recovery -----------------------------

const HISTORY_RESTOREABLE: RaceHistoryEntry = {
  race_id: "race-old-1",
  directory: "C:/proj-antiga",
  base_sha: "old1base",
  status: "completed",
  started_at: "2026-09-20T10:00:00.000Z",
  finished_at: "2026-09-20T10:05:00.000Z",
  agents: ["claude", "codex"],
  branches: ["race/race-old-1/claude", "race/race-old-1/codex"],
  worktrees: ["C:/races/race-old-1/claude", "C:/races/race-old-1/codex"],
  worktrees_present: true,
};

const HISTORY_ARCHIVED: RaceHistoryEntry = {
  ...HISTORY_RESTOREABLE,
  race_id: "race-old-2",
  status: "cleaned",
  worktrees_present: false,
};

const ORPHAN: RaceOrphan = {
  race_id: "race-orfa-1",
  directory: "C:/proj-orfa",
  started_at: "2026-09-22T08:00:00.000Z",
  agents: ["claude", "codex"],
  worktree_root: "C:/races/race-orfa-1",
  base_sha: "orfa1base",
  branches: ["race/race-orfa-1/claude", "race/race-orfa-1/codex"],
  worktrees: ["C:/races/race-orfa-1/claude", "C:/races/race-orfa-1/codex"],
};

const RECOVER_REPORT: RaceCleanupReport = {
  race_id: ORPHAN.race_id,
  removed_worktrees: ORPHAN.worktrees,
  removed_branches: ORPHAN.branches,
  pruned: true,
  skipped_reason: null,
  unverified_processes: [],
};

beforeEach(() => {
  vi.useFakeTimers();
  raceStartMock.mockReset();
  raceStatusMock.mockReset();
  raceCancelMock.mockReset();
  raceDiffMock.mockReset();
  raceAdoptMock.mockReset();
  raceCleanupMock.mockReset();
  raceScanOrphansMock.mockReset();
  raceRecoverMock.mockReset();
  raceListHistoryMock.mockReset();
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

  // --- v23.2c: diff / adopt / cleanup --------------------------------------

  it("loadDiff caches the validated report per agent and clears the error", async () => {
    await startFinishedRace();
    raceDiffMock.mockResolvedValue(DIFF);

    await raceStore.loadDiff("claude");

    expect(raceDiffMock).toHaveBeenCalledWith(HANDLE, "claude");
    const s = raceStore.getSnapshot();
    expect(s.diffError).toBeNull();
    expect(s.diffs.claude).toEqual(DIFF);

    // Concurrent requests for the same agent are deduplicated in flight…
    let resolveDiff!: (value: DiffReport) => void;
    raceDiffMock.mockReturnValue(
      new Promise<DiffReport>((resolve) => {
        resolveDiff = resolve;
      }),
    );
    const first = raceStore.loadDiff("claude");
    await raceStore.loadDiff("claude");
    resolveDiff(DIFF);
    await first;
    await flush();
    expect(raceDiffMock).toHaveBeenCalledTimes(2);

    // …while settled calls fetch fresh data (the agent may still be working).
    raceDiffMock.mockResolvedValue(DIFF);
    await raceStore.loadDiff("claude");
    expect(raceDiffMock).toHaveBeenCalledTimes(3);
  });

  it("loadDiff surfaces backend failures as a per-agent error", async () => {
    await startFinishedRace();
    raceDiffMock.mockRejectedValue(new Error("worktree sumiu"));

    await raceStore.loadDiff("claude");

    const s = raceStore.getSnapshot();
    expect(s.diffLoading).toBeNull();
    expect(s.diffError).toEqual({ agent: "claude", message: "worktree sumiu" });
    expect(s.diffs.claude).toBeUndefined();
  });

  it("loadDiff fails with the zod message when the report breaks the contract", async () => {
    await startFinishedRace();
    raceDiffMock.mockResolvedValue({ agent: "claude" }); // missing fields

    await raceStore.loadDiff("claude");

    const s = raceStore.getSnapshot();
    expect(s.diffError?.agent).toBe("claude");
    expect(s.diffError?.message).toContain("files");
  });

  it("adopt(branch) lands the race on the adopted phase and stops polling", async () => {
    await startFinishedRace();
    raceAdoptMock.mockResolvedValue(ADOPT_OK);
    raceStatusMock.mockClear();

    await raceStore.adopt("claude", "branch");

    expect(raceAdoptMock).toHaveBeenCalledWith(HANDLE, "claude", "branch");
    const s = raceStore.getSnapshot();
    expect(s.phase).toBe("adopted");
    expect(s.adopting).toBeNull();
    expect(s.adoptReport).toEqual(ADOPT_OK);
    expect(s.snapshot?.status).toBe("adopted");

    // Terminal after adopt: no poll resumes.
    await vi.advanceTimersByTimeAsync(RACE_POLL_INTERVAL_MS * 2);
    expect(raceStatusMock).not.toHaveBeenCalled();
  });

  it("adopt(apply) keeps the race running when the report lists conflicts", async () => {
    await startFinishedRace();
    raceAdoptMock.mockResolvedValue(ADOPT_CONFLICT);

    await raceStore.adopt("claude", "apply");

    const s = raceStore.getSnapshot();
    expect(s.phase).toBe("finished"); // conflict report ≠ race failure
    expect(s.adoptReport?.ok).toBe(false);
    expect(s.adoptReport?.conflicts[0]).toEqual({
      path: "src/parser.ts",
      reason: "o arquivo já existe na árvore principal",
    });
    expect(s.adoptError).toBeNull();
  });

  it("adopt surfaces thrown backend errors and allows a retry", async () => {
    await startFinishedRace();
    raceAdoptMock.mockRejectedValue(new Error("árvore suja"));

    await raceStore.adopt("claude", "branch");
    expect(raceStore.getSnapshot()).toMatchObject({
      adopting: null,
      adoptError: "árvore suja",
      phase: "finished",
    });

    raceAdoptMock.mockResolvedValue(ADOPT_OK);
    await raceStore.adopt("claude", "branch");
    const s = raceStore.getSnapshot();
    expect(s.adoptError).toBeNull();
    expect(s.adoptReport).toEqual(ADOPT_OK);
    expect(s.phase).toBe("adopted");
  });

  it("cleanup stores the report and flips the snapshot to cleaned", async () => {
    await startFinishedRace();
    raceCleanupMock.mockResolvedValue(CLEANUP);

    await raceStore.cleanup(); // default keepDays = 7

    expect(raceCleanupMock).toHaveBeenCalledWith(HANDLE, 7);
    const s = raceStore.getSnapshot();
    expect(s.cleanupRunning).toBe(false);
    expect(s.cleanupReport).toEqual(CLEANUP);
    expect(s.snapshot?.status).toBe("cleaned");
  });

  it("cleanup keeps the snapshot when the retention window skips the removal", async () => {
    await startFinishedRace();
    raceCleanupMock.mockResolvedValue({
      ...CLEANUP,
      removed_worktrees: [],
      removed_branches: [],
      pruned: false,
      skipped_reason: "Janela de retenção não expirada — faltam 7 dia(s)",
    });

    await raceStore.cleanup();

    const s = raceStore.getSnapshot();
    expect(s.cleanupReport?.skipped_reason).toContain("retenção");
    expect(s.snapshot?.status).toBe("completed");
  });

  it("cleanup surfaces backend errors", async () => {
    await startFinishedRace();
    raceCleanupMock.mockRejectedValue(new Error("git falhou"));

    await raceStore.cleanup();

    const s = raceStore.getSnapshot();
    expect(s.cleanupRunning).toBe(false);
    expect(s.cleanupError).toBe("git falhou");
  });

  it("reset and a new start clear the diff/adopt/cleanup state", async () => {
    await startFinishedRace();
    raceDiffMock.mockResolvedValue(DIFF);
    raceAdoptMock.mockResolvedValue(ADOPT_OK);
    await raceStore.loadDiff("claude");
    await raceStore.adopt("claude", "branch");

    raceStore.beginConfiguration();

    expect(raceStore.getSnapshot()).toMatchObject({
      diffs: {},
      diffLoading: null,
      diffError: null,
      adopting: null,
      adoptReport: null,
      adoptError: null,
      cleanupReport: null,
      cleanupError: null,
    });
  });

  it("ignores diff/adopt calls outside a race", async () => {
    raceStore.beginConfiguration();
    await raceStore.loadDiff("claude");
    await raceStore.adopt("claude", "branch");

    expect(raceDiffMock).not.toHaveBeenCalled();
    expect(raceAdoptMock).not.toHaveBeenCalled();
  });

  // --- v23.2d: graveyard + crash recovery ----------------------------------

  it("loadHistory stores validated terminal records; drift degrades to an error", async () => {
    raceListHistoryMock.mockResolvedValue([HISTORY_RESTOREABLE, HISTORY_ARCHIVED]);
    await raceStore.loadHistory();

    expect(raceListHistoryMock).toHaveBeenCalledTimes(1);
    const s = raceStore.getSnapshot();
    expect(s.historyLoading).toBe(false);
    expect(s.historyError).toBeNull();
    expect(s.history).toEqual([HISTORY_RESTOREABLE, HISTORY_ARCHIVED]);

    raceListHistoryMock.mockResolvedValue([{ race_id: "quebrado" }]);
    await raceStore.loadHistory();
    expect(raceStore.getSnapshot().historyError).toContain("base_sha");
    expect(raceStore.getSnapshot().history).toEqual([]); // nothing rendered unvalidated
  });

  it("restoreFromHistory with live worktrees reopens the cockpit via race_status", async () => {
    raceListHistoryMock.mockResolvedValue([HISTORY_RESTOREABLE]);
    raceStatusMock.mockResolvedValue(
      snapshot({
        race_id: HISTORY_RESTOREABLE.race_id,
        directory: HISTORY_RESTOREABLE.directory,
        base_sha: HISTORY_RESTOREABLE.base_sha,
        started_at: HISTORY_RESTOREABLE.started_at,
        status: "completed",
      }),
    );
    await raceStore.loadHistory();
    await raceStore.restoreFromHistory(HISTORY_RESTOREABLE);

    expect(raceStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({
        race_id: HISTORY_RESTOREABLE.race_id,
        base_sha: HISTORY_RESTOREABLE.base_sha,
        agents: HISTORY_RESTOREABLE.agents,
        branches: HISTORY_RESTOREABLE.branches,
        worktrees: HISTORY_RESTOREABLE.worktrees,
      }),
    );
    const s = raceStore.getSnapshot();
    expect(s.phase).toBe("finished");
    expect(s.handle?.race_id).toBe(HISTORY_RESTOREABLE.race_id);
    expect(s.snapshot?.status).toBe("completed");
    expect(s.archivedEntry).toBeNull();

    // Restored cockpit keeps loading real diffs from the live worktrees.
    raceDiffMock.mockResolvedValue(DIFF);
    await raceStore.loadDiff("claude");
    expect(raceStore.getSnapshot().diffs.claude).toEqual(DIFF);
  });

  it("restoreFromHistory of a cleaned race is read-only and never calls race_status", async () => {
    raceListHistoryMock.mockResolvedValue([HISTORY_ARCHIVED]);
    await raceStore.loadHistory();
    await raceStore.restoreFromHistory(HISTORY_ARCHIVED);

    expect(raceStatusMock).not.toHaveBeenCalled();
    const s = raceStore.getSnapshot();
    expect(s.phase).toBe("finished");
    expect(s.archivedEntry?.race_id).toBe(HISTORY_ARCHIVED.race_id);
    expect(s.handle).toBeNull();
    expect(s.snapshot).toBeNull();
  });

  it("restoreFromHistory of a race with missing worktrees is archived even when not cleaned", async () => {
    const broken: RaceHistoryEntry = { ...HISTORY_RESTOREABLE, worktrees_present: false };
    raceListHistoryMock.mockResolvedValue([broken]);
    await raceStore.loadHistory();
    await raceStore.restoreFromHistory(broken);

    expect(raceStatusMock).not.toHaveBeenCalled();
    expect(raceStore.getSnapshot().archivedEntry?.race_id).toBe(broken.race_id);
  });

  it("restoreFromHistory is a no-op while a race is starting or running", async () => {
    raceStartMock.mockResolvedValue(HANDLE);
    raceStatusMock.mockResolvedValue(snapshot());
    const startPromise = raceStore.start({ directory: "C:/proj", taskPrompt: "x", agents: ["claude"] });
    await flush();

    await raceStore.restoreFromHistory(HISTORY_RESTOREABLE);
    expect(raceStatusMock).toHaveBeenCalledTimes(1); // only the live poll, no restore status
    expect(raceStore.getSnapshot().archivedEntry).toBeNull();
    await startPromise;

    // Same guard while running.
    raceStatusMock.mockClear();
    await raceStore.restoreFromHistory(HISTORY_RESTOREABLE);
    expect(raceStatusMock).not.toHaveBeenCalled();
  });

  it("cleanupFromHistory clears a graveyard race immediately (keepDays = 0)", async () => {
    raceListHistoryMock.mockResolvedValue([HISTORY_RESTOREABLE]);
    raceCleanupMock.mockResolvedValue({ ...CLEANUP, race_id: HISTORY_RESTOREABLE.race_id });
    await raceStore.loadHistory();

    await raceStore.cleanupFromHistory(HISTORY_RESTOREABLE);

    expect(raceCleanupMock).toHaveBeenCalledWith(
      expect.objectContaining({ race_id: HISTORY_RESTOREABLE.race_id }),
      0,
    );
    expect(raceStore.getSnapshot().historyReport?.removed_worktrees.length).toBe(2);
    // The section reloads after the removal.
    expect(raceListHistoryMock).toHaveBeenCalledTimes(2);
  });

  it("cleanupFromHistory surfaces backend errors and releases the busy flag", async () => {
    raceListHistoryMock.mockResolvedValue([HISTORY_RESTOREABLE]);
    raceCleanupMock.mockRejectedValue(new Error("git falhou"));
    await raceStore.loadHistory();

    await raceStore.cleanupFromHistory(HISTORY_RESTOREABLE);

    const s = raceStore.getSnapshot();
    expect(s.historyBusy).toBeNull();
    expect(s.historyError).toBe("git falhou");
  });

  it("scanOrphans validates the report and recoverOrphan clears the banner", async () => {
    raceScanOrphansMock.mockResolvedValue({ orphans: [ORPHAN] });
    await raceStore.scanOrphans();
    expect(raceStore.getSnapshot().orphans).toEqual([ORPHAN]);

    raceRecoverMock.mockResolvedValue(RECOVER_REPORT);
    await raceStore.recoverOrphan(ORPHAN);

    expect(raceRecoverMock).toHaveBeenCalledWith(
      expect.objectContaining({ race_id: ORPHAN.race_id, base_sha: ORPHAN.base_sha }),
    );
    const s = raceStore.getSnapshot();
    expect(s.recovering).toBeNull();
    expect(s.orphans).toEqual([]); // banner empties without a rescan
    expect(s.historyReport).toEqual(RECOVER_REPORT);
    // The graveyard reloads with the recovered record.
    expect(raceListHistoryMock).toHaveBeenCalledTimes(1);
  });

  it("recoverOrphan surfaces unverified (spared) processes in the report", async () => {
    raceScanOrphansMock.mockResolvedValue({ orphans: [ORPHAN] });
    await raceStore.scanOrphans();
    raceRecoverMock.mockResolvedValue({
      ...RECOVER_REPORT,
      unverified_processes: [
        "claude: identidade do pid 4200 não confere — processo não verificado, não finalizado",
      ],
    });
    await raceStore.recoverOrphan(ORPHAN);

    const s = raceStore.getSnapshot();
    expect(s.recovering).toBeNull();
    expect(s.orphans).toEqual([]);
    expect(s.historyReport?.unverified_processes).toHaveLength(1);
    expect(s.historyReport?.unverified_processes[0]).toContain("não verificado");
    expect(raceListHistoryMock).toHaveBeenCalledTimes(1);
  });

  it("scanOrphans surfaces backend failures; recover errors keep the banner", async () => {
    raceScanOrphansMock.mockRejectedValue(new Error("varredura falhou"));
    await raceStore.scanOrphans();
    expect(raceStore.getSnapshot().orphanError).toBe("varredura falhou");

    raceScanOrphansMock.mockResolvedValue({ orphans: [ORPHAN] });
    await raceStore.scanOrphans();
    raceRecoverMock.mockRejectedValue(new Error("pid inatingível"));
    await raceStore.recoverOrphan(ORPHAN);

    const s = raceStore.getSnapshot();
    expect(s.recovering).toBeNull();
    expect(s.orphans).toEqual([ORPHAN]);
    expect(s.orphanError).toBe("pid inatingível");
  });

  it("inspectOrphan toggles the expanded orphan details", async () => {
    raceStore.inspectOrphan(ORPHAN.race_id);
    expect(raceStore.getSnapshot().inspectedOrphan).toBe(ORPHAN.race_id);
    raceStore.inspectOrphan(null);
    expect(raceStore.getSnapshot().inspectedOrphan).toBeNull();
  });

  it("isRetentionExpired flags only races past the 7-day window", () => {
    const now = Date.parse("2026-09-22T12:00:00.000Z");
    const fresh: Pick<RaceHistoryEntry, "started_at" | "finished_at"> = {
      started_at: "2026-09-22T10:00:00.000Z",
      finished_at: "2026-09-22T11:00:00.000Z",
    };
    const stale: Pick<RaceHistoryEntry, "started_at" | "finished_at"> = {
      started_at: "2026-09-14T10:00:00.000Z",
      finished_at: "2026-09-14T11:00:00.000Z",
    };
    expect(isRetentionExpired(fresh, now)).toBe(false);
    expect(isRetentionExpired(stale, now)).toBe(true);
    // Falls back to started_at without finished_at; invalid dates never expire.
    expect(isRetentionExpired({ started_at: "2026-09-14T10:00:00.000Z", finished_at: null }, now)).toBe(true);
    expect(isRetentionExpired({ started_at: "não é data", finished_at: null }, now)).toBe(false);
  });
});
