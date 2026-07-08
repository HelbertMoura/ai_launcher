import type { Runbook } from "../../domain/types";

const STORAGE_KEY = "ai-launcher:v20:runbook-executions";
const MAX_EXECUTIONS = 50;
const MAX_OUTPUT_CHARS = 20_000;

export type RunbookExecutionStatus = "running" | "success" | "failed" | "stopped";
export type RunbookStepExecutionStatus = "pending" | "running" | "success" | "failed" | "skipped";

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
  cwd?: string;
  status: RunbookExecutionStatus;
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
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { executions: [] };
    const parsed = JSON.parse(raw) as Partial<RunbookExecutionStore>;
    return { executions: Array.isArray(parsed.executions) ? parsed.executions : [] };
  } catch {
    return { executions: [] };
  }
}

function saveStore(store: RunbookExecutionStore): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        executions: store.executions
          .slice()
          .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
          .slice(0, MAX_EXECUTIONS),
      }),
    );
  } catch (e) {
    console.error("[runbook-executions] failed to save", e);
  }
}

export function getRunbookExecutions(runbookId?: string): RunbookExecution[] {
  const executions = loadStore().executions;
  const scoped = runbookId
    ? executions.filter((execution) => execution.runbookId === runbookId)
    : executions;
  return scoped.slice().sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
}

export function startRunbookExecution(runbook: Runbook, cwd?: string): RunbookExecution {
  const store = loadStore();
  const execution: RunbookExecution = {
    id: generateRunId(),
    runbookId: runbook.id,
    runbookName: runbook.name,
    cwd,
    status: "running",
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
      finishedAt,
      durationMs: duration(execution.startedAt, finishedAt),
    };
    return updated;
  });
  saveStore(store);
  return updated;
}
