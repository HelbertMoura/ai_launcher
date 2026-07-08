// ==============================================================================
// AI Launcher Pro - Runbook Runner
// Execute runbook steps in sequence with progress tracking and logging.
// ==============================================================================

import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { invokeOrFallback } from '../../lib/tauri';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Toggle } from '../../ui/Toggle';
import type { Runbook, RunbookCondition, RunbookStep } from '../../domain/types';
import {
  finishRunbookExecution,
  getRunbookExecutions,
  startRunbookExecution,
  updateRunbookExecutionStep,
  type RunbookExecution,
} from './runbookExecutionStore';
import './Runbook.css';

// --- Types -------------------------------------------------------------------

export type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

export interface StepLog {
  stepId: string;
  status: StepStatus;
  output: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
}

// --- Helpers -----------------------------------------------------------------

function isoNow(): string {
  return new Date().toISOString();
}

function timestamp(): string {
  return new Date().toLocaleTimeString();
}

function durationMs(startedAt?: string, finishedAt?: string): number | undefined {
  if (!startedAt || !finishedAt) return undefined;
  const start = Date.parse(startedAt);
  const finish = Date.parse(finishedAt);
  if (Number.isNaN(start) || Number.isNaN(finish)) return undefined;
  return Math.max(0, finish - start);
}

function formatDuration(ms?: number): string {
  if (ms == null) return '';
  if (ms < 1000) return `${ms}ms`;
  const sec = Math.round(ms / 100) / 10;
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rest = Math.round(sec % 60);
  return `${min}m ${rest}s`;
}

function formatExecutionTime(iso: string): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return '';
  return new Date(parsed).toLocaleString();
}

/** Structured result returned by the Rust `run_runbook_step` command. */
interface BackendStepResult {
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

/** Raw (snake_case) shape coming from the Tauri backend. */
interface RawStepResult {
  ok: boolean;
  exit_code: number | null;
  stdout: string;
  stderr: string;
  timed_out: boolean;
}

interface ConditionResult {
  ok: boolean;
  message: string;
}

/**
 * Execute one runbook step by invoking the Tauri backend. Steps without a
 * command (pure manual/check steps) are treated as a no-op success so the
 * sequence can continue.
 */
async function executeStep(
  step: RunbookStep,
  cwd: string | undefined,
): Promise<BackendStepResult> {
  const cmd = step.command?.trim();
  if (!cmd) {
    return {
      ok: true,
      exitCode: 0,
      stdout: `[${timestamp()}] ${step.label}: no command (${step.type})`,
      stderr: '',
      timedOut: false,
    };
  }
  const raw = await invoke<RawStepResult>('run_runbook_step', {
    command: cmd,
    cwd: cwd && cwd.trim() ? cwd : null,
    timeoutSecs: null,
  });
  return {
    ok: raw.ok,
    exitCode: raw.exit_code,
    stdout: raw.stdout,
    stderr: raw.stderr,
    timedOut: raw.timed_out,
  };
}

/** Compose a human-readable output block from a backend result. */
function formatStepOutput(label: string, result: BackendStepResult): string {
  const parts: string[] = [];
  const code = result.exitCode === null ? '—' : String(result.exitCode);
  parts.push(`[${timestamp()}] ${label} · exit ${code}`);
  if (result.timedOut) parts.push('(timed out)');
  if (result.stdout.trim()) parts.push(result.stdout.trimEnd());
  if (result.stderr.trim()) parts.push(`stderr:\n${result.stderr.trimEnd()}`);
  return parts.join('\n');
}

function formatCondition(condition: RunbookCondition | undefined): string {
  if (!condition || condition.type === 'always') return 'always';
  const value = condition.value ? ` ${condition.value}` : '';
  return `${condition.negate ? 'not ' : ''}${condition.type}${value}`;
}

async function evaluateStepCondition(
  step: RunbookStep,
  previousSucceeded: boolean,
  cwd: string | undefined,
): Promise<ConditionResult> {
  const condition = step.condition;
  if (!condition || condition.type === 'always') {
    return { ok: true, message: 'always' };
  }
  if (condition.type === 'previousSucceeded') {
    const ok = condition.negate ? !previousSucceeded : previousSucceeded;
    return {
      ok,
      message: formatCondition(condition),
    };
  }
  return invokeOrFallback<ConditionResult>(
    'evaluate_runbook_condition',
    {
      condition,
      cwd: cwd && cwd.trim() ? cwd : null,
    },
    { ok: true, message: 'condition skipped outside Tauri' },
  );
}

// --- Step Row ----------------------------------------------------------------

interface StepRowProps {
  step: RunbookStep;
  log: StepLog | undefined;
}

const STATUS_LABELS: Record<StepStatus, string> = {
  pending: '○',
  running: '◎',
  success: '●',
  failed: '✕',
  skipped: '—',
};

const STATUS_COLORS: Record<StepStatus, string> = {
  pending: 'var(--text-muted)',
  running: '#4299e1',
  success: '#48bb78',
  failed: '#e53e3e',
  skipped: 'var(--text-dim)',
};

function StepRow({ step, log }: StepRowProps) {
  const status = log?.status ?? 'pending';
  return (
    <Card className="cd-rb-run__step">
      <div className="cd-rb-run__step-header">
        <span className="cd-rb-run__step-icon" style={{ color: STATUS_COLORS[status] }}>
          {STATUS_LABELS[status]}
        </span>
        <span className="cd-rb-run__step-label">{step.label}</span>
        <span className="cd-rb-run__step-type">{step.type}</span>
        {step.condition && (
          <span className="cd-rb-run__step-condition">{formatCondition(step.condition)}</span>
        )}
        {log?.durationMs != null && (
          <span className="cd-rb-run__step-duration">{formatDuration(log.durationMs)}</span>
        )}
        <span className="cd-rb-run__step-auto">{step.auto ? 'auto' : 'manual'}</span>
      </div>
      {log?.output && (
        <pre className="cd-rb-run__output">{log.output}</pre>
      )}
    </Card>
  );
}

// --- Main Runner -------------------------------------------------------------

interface RunbookRunnerProps {
  runbook: Runbook;
  onClose: () => void;
  /** Working directory passed to each command (e.g. active workspace dir). */
  cwd?: string;
}

export function RunbookRunner({ runbook, onClose, cwd }: RunbookRunnerProps) {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<Map<string, StepLog>>(new Map());
  const [executions, setExecutions] = useState<RunbookExecution[]>(() =>
    getRunbookExecutions(runbook.id),
  );
  const [running, setRunning] = useState(false);
  const [currentStepId, setCurrentStepId] = useState<string | null>(null);
  const [stopOnFailure, setStopOnFailure] = useState(true);
  const [completed, setCompleted] = useState(false);
  // Cancellation flag read inside the async loop. A plain state value would be
  // captured stale by the closure (the original `if (!running) break` broke on
  // the first iteration because `running` was still false from before setState).
  const cancelRef = useRef(false);

  const refreshExecutions = useCallback(() => {
    setExecutions(getRunbookExecutions(runbook.id));
  }, [runbook.id]);

  const updateLog = useCallback((stepId: string, patch: Partial<StepLog>) => {
    setLogs((prev) => {
      const next = new Map(prev);
      const existing = next.get(stepId);
      const startedAt = patch.startedAt ?? existing?.startedAt;
      const finishedAt = patch.finishedAt ?? existing?.finishedAt;
      next.set(stepId, {
        stepId,
        status: 'pending',
        output: '',
        ...existing,
        ...patch,
        durationMs: patch.durationMs ?? durationMs(startedAt, finishedAt) ?? existing?.durationMs,
      });
      return next;
    });
  }, []);

  const handleRun = useCallback(async () => {
    cancelRef.current = false;
    setRunning(true);
    setCompleted(false);
    setLogs(new Map());
    const execution = startRunbookExecution(runbook, cwd);
    refreshExecutions();

    const skipReason = t('runbook.run.skippedFailure');
    let previousSucceeded = true;
    let runFailed = false;
    let runStopped = false;

    for (let i = 0; i < runbook.steps.length; i += 1) {
      if (cancelRef.current) {
        runStopped = true;
        break;
      }
      const step = runbook.steps[i];

      setCurrentStepId(step.id);
      const startedAt = isoNow();
      updateLog(step.id, { status: 'running', startedAt });
      updateRunbookExecutionStep(execution.id, step.id, { status: 'running', startedAt });
      refreshExecutions();

      try {
        const condition = await evaluateStepCondition(step, previousSucceeded, cwd);
        if (!condition.ok) {
          const finishedAt = isoNow();
          const output = `[${timestamp()}] ${t('runbook.run.conditionSkipped')}: ${condition.message}`;
          updateLog(step.id, {
            status: 'skipped',
            output,
            finishedAt,
          });
          updateRunbookExecutionStep(execution.id, step.id, {
            status: 'skipped',
            output,
            finishedAt,
          });
          refreshExecutions();
          continue;
        }
        const result = await executeStep(step, cwd);
        previousSucceeded = result.ok;
        runFailed = runFailed || !result.ok;
        const finishedAt = isoNow();
        const output = formatStepOutput(step.label, result);
        updateLog(step.id, {
          status: result.ok ? 'success' : 'failed',
          output,
          finishedAt,
        });
        updateRunbookExecutionStep(execution.id, step.id, {
          status: result.ok ? 'success' : 'failed',
          output,
          finishedAt,
        });
        refreshExecutions();

        if (!result.ok && stopOnFailure) {
          for (const r of runbook.steps.slice(i + 1)) {
            updateLog(r.id, { status: 'skipped', output: skipReason });
            updateRunbookExecutionStep(execution.id, r.id, {
              status: 'skipped',
              output: skipReason,
              finishedAt: isoNow(),
            });
          }
          break;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        previousSucceeded = false;
        runFailed = true;
        const finishedAt = isoNow();
        const output = `[${timestamp()}] ${t('runbook.run.error')}: ${msg}`;
        updateLog(step.id, {
          status: 'failed',
          output,
          finishedAt,
        });
        updateRunbookExecutionStep(execution.id, step.id, {
          status: 'failed',
          output,
          finishedAt,
        });
        refreshExecutions();

        if (stopOnFailure) {
          for (const r of runbook.steps.slice(i + 1)) {
            updateLog(r.id, { status: 'skipped', output: skipReason });
            updateRunbookExecutionStep(execution.id, r.id, {
              status: 'skipped',
              output: skipReason,
              finishedAt: isoNow(),
            });
          }
          break;
        }
      }
    }

    finishRunbookExecution(
      execution.id,
      runStopped ? 'stopped' : runFailed ? 'failed' : 'success',
    );
    refreshExecutions();
    setCurrentStepId(null);
    setRunning(false);
    setCompleted(true);
  }, [cwd, refreshExecutions, runbook, stopOnFailure, updateLog, t]);

  const handleStop = useCallback(() => {
    cancelRef.current = true;
    setRunning(false);
    if (currentStepId) {
      const finishedAt = isoNow();
      updateLog(currentStepId, { status: 'skipped', output: t('runbook.run.stopped'), finishedAt });
    }
  }, [currentStepId, updateLog, t]);

  const successCount = [...logs.values()].filter((l) => l.status === 'success').length;
  const failedCount = [...logs.values()].filter((l) => l.status === 'failed').length;

  return (
    <div className="cd-rb-run">
      <header className="cd-rb-run__header">
        <div className="cd-rb-run__title-row">
          <h2 className="cd-costs__section">{t('runbook.run.running', { name: runbook.name })}</h2>
          <Button size="sm" variant="ghost" onClick={onClose}>{t('common.close')}</Button>
        </div>
        <div className="cd-rb-run__controls">
          <label className="cd-rb-run__toggle">
            <Toggle
              checked={stopOnFailure}
              onChange={setStopOnFailure}
              label={t('runbook.run.stopOnFailure')}
            />
          </label>
          {!running && !completed && (
            <Button size="sm" onClick={handleRun}>{t('runbook.run.start')}</Button>
          )}
          {running && (
            <Button size="sm" variant="danger" onClick={handleStop}>{t('runbook.run.stop')}</Button>
          )}
          {completed && (
            <div className="cd-rb-run__summary">
              <span style={{ color: '#48bb78' }}>{t('runbook.run.passed', { count: successCount })}</span>
              {failedCount > 0 && <span style={{ color: '#e53e3e' }}>{t('runbook.run.failed', { count: failedCount })}</span>}
              <Button size="sm" onClick={handleRun}>{t('runbook.run.rerun')}</Button>
            </div>
          )}
        </div>
      </header>

      <div className="cd-rb-run__steps">
        {runbook.steps.map((step) => (
          <StepRow
            key={step.id}
            step={step}
            log={logs.get(step.id)}
          />
        ))}
      </div>

      <section className="cd-rb-run__history">
        <div className="cd-rb-run__history-head">
          <h3>{t('runbook.history.title')}</h3>
          <span>{t('runbook.history.count', { count: executions.length })}</span>
        </div>
        {executions.length === 0 ? (
          <p className="cd-rb-run__history-empty">{t('runbook.history.empty')}</p>
        ) : (
          <ol className="cd-rb-run__timeline">
            {executions.slice(0, 5).map((execution) => (
              <li key={execution.id} className={`cd-rb-run__timeline-item cd-rb-run__timeline-item--${execution.status}`}>
                <span className="cd-rb-run__timeline-dot" />
                <div className="cd-rb-run__timeline-main">
                  <strong>{t(`runbook.history.status.${execution.status}`)}</strong>
                  <small>{formatExecutionTime(execution.startedAt)}</small>
                </div>
                <span className="cd-rb-run__timeline-meta">
                  {formatDuration(execution.durationMs)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
