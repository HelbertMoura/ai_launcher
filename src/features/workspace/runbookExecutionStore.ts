import type { Runbook } from "../../domain/types";
import { readKey, writeKey } from "../../lib/storage";
import type { RunbookRunMode } from "./runbookMachine";
const MAX_EXECUTIONS = 50;
const MAX_OUTPUT_CHARS = 20_000;

export type RunbookExecutionStatus = "running" | "success" | "validated" | "failed" | "stopped";
export type RunbookStepExecutionStatus = "pending" | "running" | "ready" | "success" | "failed" | "skipped";

export interface RunbookStepExecution {
  stepId: string;
  label: string;
  status: RunbookStepExecutionStatus;
  output: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
}

export interface RunbookExecution {
  id: string;
  runbookId: string;
  runbookName: string;
  runbookUpdatedAt: string;
  cwd?: string;
  workspaceId?: string;
  mode: RunbookRunMode;
  status: RunbookExecutionStatus;
  nextStepIndex: number;
  attempt: number;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  steps: RunbookStepExecution[];
}

interface RunbookExecutionStore {
  executions: RunbookExecution[];
}

function isoNow(): string {
  return new Date().toISOString();
}

function generateRunId(): string {
  return `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function capOutput(output: string): string {
  if (output.length <= MAX_OUTPUT_CHARS) return output;
  return `${output.slice(0, MAX_OUTPUT_CHARS)}\n... (output truncated)`;
}

function duration(startedAt?: string, finishedAt?: string): number | undefined {
  if (!startedAt || !finishedAt) return undefined;
  const start = Date.parse(startedAt);
  const finish = Date.parse(finishedAt);
  if (Number.isNaN(start) || Number.isNaN(finish)) return undefined;
  return Math.max(0, finish - start);
}

function loadStore(): RunbookExecutionStore {
  const parsed = readKey("runbookExecutions") as Partial<RunbookExecutionStore>;
  if (!Array.isArray(parsed.executions)) return { executions: [] };
  return {
    executions: parsed.executions.map((execution) => ({
      ...execution,
      runbookUpdatedAt: execution.runbookUpdatedAt ?? "",
      mode: execution.mode ?? "execute",
      nextStepIndex: Number.isInteger(execution.nextStepIndex) ? execution.nextStepIndex : 0,
      attempt: Number.isInteger(execution.attempt) ? execution.attempt : 1,
      steps: Array.isArray(execution.steps) ? execution.steps : [],
    })),
  };
}

function saveStore(store: RunbookExecutionStore): void {
  writeKey("runbookExecutions", {
        executions: store.executions
          .slice()
          .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
          .slice(0, MAX_EXECUTIONS),
      });
}

export function getRunbookExecutions(runbookId?: string): RunbookExecution[] {
  const executions = loadStore().executions;
  const scoped = runbookId
    ? executions.filter((execution) => execution.runbookId === runbookId)
    : executions;
  return scoped.slice().sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
}

interface StartRunbookExecutionOptions {
  mode?: RunbookRunMode;
  workspaceId?: string;
}

export function startRunbookExecution(
  runbook: Runbook,
  cwd?: string,
  options: StartRunbookExecutionOptions = {},
): RunbookExecution {
  const store = loadStore();
  const execution: RunbookExecution = {
    id: generateRunId(),
    runbookId: runbook.id,
    runbookName: runbook.name,
    runbookUpdatedAt: runbook.updatedAt,
    cwd,
    workspaceId: options.workspaceId,
    mode: options.mode ?? "execute",
    status: "running",
    nextStepIndex: 0,
    attempt: 1,
    startedAt: isoNow(),
    steps: runbook.steps.map((step) => ({
      stepId: step.id,
      label: step.label,
      status: "pending",
      output: "",
    })),
  };
  store.executions = [execution, ...store.executions];
  saveStore(store);
  return execution;
}

export function updateRunbookExecutionStep(
  executionId: string,
  stepId: string,
  patch: Partial<Omit<RunbookStepExecution, "stepId">>,
): RunbookExecution | null {
  const store = loadStore();
  let updated: RunbookExecution | null = null;
  store.executions = store.executions.map((execution) => {
    if (execution.id !== executionId) return execution;
    const steps = execution.steps.map((step) => {
      if (step.stepId !== stepId) return step;
      const finishedAt = patch.finishedAt ?? step.finishedAt;
      const startedAt = patch.startedAt ?? step.startedAt;
      return {
        ...step,
        ...patch,
        output: patch.output == null ? step.output : capOutput(patch.output),
        durationMs: patch.durationMs ?? duration(startedAt, finishedAt) ?? step.durationMs,
      };
    });
    updated = { ...execution, steps };
    return updated;
  });
  saveStore(store);
  return updated;
}

export function setRunbookExecutionCursor(
  executionId: string,
  nextStepIndex: number,
): RunbookExecution | null {
  const store = loadStore();
  let updated: RunbookExecution | null = null;
  store.executions = store.executions.map((execution) => {
    if (execution.id !== executionId) return execution;
    updated = { ...execution, nextStepIndex: Math.max(0, nextStepIndex) };
    return updated;
  });
  saveStore(store);
  return updated;
}

export function resumeRunbookExecution(
  executionId: string,
  stepIndex: number,
): RunbookExecution | null {
  const store = loadStore();
  let updated: RunbookExecution | null = null;
  store.executions = store.executions.map((execution) => {
    if (execution.id !== executionId) return execution;
    const safeIndex = Math.min(Math.max(0, stepIndex), execution.steps.length);
    updated = {
      ...execution,
      status: "running",
      finishedAt: undefined,
      durationMs: undefined,
      nextStepIndex: safeIndex,
      attempt: (execution.attempt ?? 1) + 1,
      steps: execution.steps.map((step, index) => index < safeIndex
        ? step
        : { ...step, status: "pending", output: "", startedAt: undefined, finishedAt: undefined, durationMs: undefined }),
    };
    return updated;
  });
  saveStore(store);
  return updated;
}

export function getResumableRunbookExecution(runbook: Runbook): RunbookExecution | null {
  return getRunbookExecutions(runbook.id).find((execution) =>
    execution.mode === "execute"
    && execution.runbookUpdatedAt === runbook.updatedAt
    && execution.nextStepIndex < execution.steps.length
    && execution.status !== "success"
    && execution.status !== "validated",
  ) ?? null;
}

export function finishRunbookExecution(
  executionId: string,
  status: Exclude<RunbookExecutionStatus, "running">,
): RunbookExecution | null {
  const store = loadStore();
  let updated: RunbookExecution | null = null;
  store.executions = store.executions.map((execution) => {
    if (execution.id !== executionId) return execution;
    const finishedAt = isoNow();
    updated = {
      ...execution,
      status,
      nextStepIndex: status === "success" || status === "validated"
        ? execution.steps.length
        : execution.nextStepIndex,
      finishedAt,
      durationMs: duration(execution.startedAt, finishedAt),
    };
    return updated;
  });
  saveStore(store);
  return updated;
}
