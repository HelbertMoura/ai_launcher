import { beforeEach, describe, expect, it } from "vitest";
import type { Runbook } from "../../domain/types";
import {
  finishRunbookExecution,
  getRunbookExecutions,
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
    expect(execution.steps[0]).toMatchObject({
      stepId: "step-1",
      label: "Check Node",
      status: "pending",
    });
    expect(getRunbookExecutions("rb-1")).toHaveLength(1);
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
