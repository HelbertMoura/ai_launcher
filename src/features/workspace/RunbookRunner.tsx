// ==============================================================================
// AI Launcher Pro - Runbook Runner
// Execute runbook steps in sequence with progress tracking and logging.
// ==============================================================================

import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Toggle } from '../../ui/Toggle';
import type { Runbook, RunbookStep } from '../../domain/types';
import './Runbook.css';

// --- Types -------------------------------------------------------------------

export type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

export interface StepLog {
  stepId: string;
  status: StepStatus;
  output: string;
  startedAt?: string;
  finishedAt?: string;
}

// --- Helpers -----------------------------------------------------------------

function isoNow(): string {
  return new Date().toISOString();
}

function timestamp(): string {
  return new Date().toLocaleTimeString();
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
  const [running, setRunning] = useState(false);
  const [currentStepId, setCurrentStepId] = useState<string | null>(null);
  const [stopOnFailure, setStopOnFailure] = useState(true);
  const [completed, setCompleted] = useState(false);
  // Cancellation flag read inside the async loop. A plain state value would be
  // captured stale by the closure (the original `if (!running) break` broke on
  // the first iteration because `running` was still false from before setState).
  const cancelRef = useRef(false);

  const updateLog = useCallback((stepId: string, patch: Partial<StepLog>) => {
    setLogs((prev) => {
      const next = new Map(prev);
      const existing = next.get(stepId);
      next.set(stepId, { stepId, status: 'pending', output: '', ...existing, ...patch });
      return next;
    });
  }, []);

  const handleRun = useCallback(async () => {
    cancelRef.current = false;
    setRunning(true);
    setCompleted(false);
    setLogs(new Map());

    const skipReason = t('runbook.run.skippedFailure');

    for (let i = 0; i < runbook.steps.length; i += 1) {
      if (cancelRef.current) break; // user requested stop
      const step = runbook.steps[i];

      setCurrentStepId(step.id);
      updateLog(step.id, { status: 'running', startedAt: isoNow() });

      try {
        const result = await executeStep(step, cwd);
        updateLog(step.id, {
          status: result.ok ? 'success' : 'failed',
          output: formatStepOutput(step.label, result),
          finishedAt: isoNow(),
        });

        if (!result.ok && stopOnFailure) {
          for (const r of runbook.steps.slice(i + 1)) {
            updateLog(r.id, { status: 'skipped', output: skipReason });
          }
          break;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        updateLog(step.id, {
          status: 'failed',
          output: `[${timestamp()}] ${t('runbook.run.error')}: ${msg}`,
          finishedAt: isoNow(),
        });

        if (stopOnFailure) {
          for (const r of runbook.steps.slice(i + 1)) {
            updateLog(r.id, { status: 'skipped', output: skipReason });
          }
          break;
        }
      }
    }

    setCurrentStepId(null);
    setRunning(false);
    setCompleted(true);
  }, [runbook.steps, stopOnFailure, updateLog, cwd, t]);

  const handleStop = useCallback(() => {
    cancelRef.current = true;
    setRunning(false);
    if (currentStepId) {
      updateLog(currentStepId, { status: 'skipped', output: t('runbook.run.stopped') });
    }
  }, [currentStepId, updateLog, t]);

  const successCount = [...logs.values()].filter((l) => l.status === 'success').length;
  const failedCount = [...logs.values()].filter((l) => l.status === 'failed').length;

  return (
    <div className="cd-rb-run">
      <header className="cd-rb-run__header">
        <div className="cd-rb-run__title-row">
          <h3 className="cd-costs__section">{t('runbook.run.running', { name: runbook.name })}</h3>
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
    </div>
  );
}
