import { beforeEach, describe, expect, it } from "vitest";
import type { Runbook } from "../../domain/types";
import {
  finishRunbookExecution,
  getResumableRunbookExecution,
  getRunbookExecutions,
  resumeRunbookExecution,
  setRunbookExecutionCursor,
  startRunbookExecution,
  updateRunbookExecutionStep,
} from "./runbookExecutionStore";

function runbook(patch: Partial<Runbook> = {}): Runbook {
  return {
    id: "rb-1",
    name: "Setup",
    tags: [],
    createdAt: "2026-07-07T00:00:00.000Z",
    updatedAt: "2026-07-07T00:00:00.000Z",
    steps: [
      {
        id: "step-1",
        label: "Check Node",
        type: "check",
        auto: true,
      },
    ],
    ...patch,
  };
}

describe("runbookExecutionStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts an execution with pending step snapshots", () => {
    const execution = startRunbookExecution(runbook(), "C:\\dev\\app");

    expect(execution.status).toBe("running");
    expect(execution.cwd).toBe("C:\\dev\\app");
    expect(execution).toMatchObject({ mode: "execute", nextStepIndex: 0, attempt: 1 });
    expect(execution.steps[0]).toMatchObject({
      stepId: "step-1",
      label: "Check Node",
      status: "pending",
    });
    expect(getRunbookExecutions("rb-1")).toHaveLength(1);
  });

  it("persists a secret-free resumable cursor and resumes from it", () => {
    const source = runbook({
      steps: [
        { id: "step-1", label: "First", type: "check", auto: true, command: "echo first" },
        { id: "step-2", label: "Second", type: "install", auto: false, command: "echo second" },
      ],
    });
    const execution = startRunbookExecution(source, "C:\\dev\\app", { workspaceId: "ws-1" });
    setRunbookExecutionCursor(execution.id, 1);
    finishRunbookExecution(execution.id, "stopped");

    const resumable = getResumableRunbookExecution(source);
    expect(resumable).toMatchObject({ nextStepIndex: 1, workspaceId: "ws-1" });
    expect(JSON.stringify(resumable)).not.toContain("echo first");

    const resumed = resumeRunbookExecution(execution.id, 1);
    expect(resumed).toMatchObject({ status: "running", nextStepIndex: 1, attempt: 2 });
    expect(resumed?.steps[0].status).toBe("pending");
  });

  it("does not resume after the runbook definition changes", () => {
    const source = runbook();
    startRunbookExecution(source);
    expect(getResumableRunbookExecution({ ...source, updatedAt: "2026-07-08T00:00:00.000Z" })).toBeNull();
  });

  it("updates step status and caps large output", () => {
    const execution = startRunbookExecution(runbook());
    const updated = updateRunbookExecutionStep(execution.id, "step-1", {
      status: "success",
      output: "x".repeat(25_000),
      startedAt: "2026-07-07T00:00:00.000Z",
      finishedAt: "2026-07-07T00:00:01.500Z",
    });

    expect(updated?.steps[0].status).toBe("success");
    expect(updated?.steps[0].output).toContain("output truncated");
    expect(updated?.steps[0].durationMs).toBe(1500);
  });

  it("finishes an execution and scopes by runbook id", () => {
    const first = startRunbookExecution(runbook());
    startRunbookExecution(runbook({ id: "rb-2" }));

    const finished = finishRunbookExecution(first.id, "success");

    expect(finished?.status).toBe("success");
    expect(finished?.durationMs).toBeGreaterThanOrEqual(0);
    expect(getRunbookExecutions("rb-1")).toHaveLength(1);
    expect(getRunbookExecutions("missing")).toEqual([]);
  });
});
