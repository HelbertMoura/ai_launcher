// ==============================================================================
// AI Launcher Pro - Runbook Runner
// Execute runbook steps in sequence with progress tracking and logging.
// ==============================================================================

import { useCallback, useState } from 'react';
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

/**
 * Simulate step execution. In a real app this would invoke the Tauri backend
 * to run commands. For now it returns a mock result after a brief delay.
 */
function executeStep(step: RunbookStep): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    // Simulated execution — replace with actual Tauri invoke in production
    const cmd = step.command ?? `(no command for ${step.type})`;
    setTimeout(() => {
      resolve({
        ok: true,
        output: `[${timestamp()}] ${step.label}: ${cmd}`,
      });
    }, 300 + Math.random() * 500);
  });
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
}

export function RunbookRunner({ runbook, onClose }: RunbookRunnerProps) {
  const [logs, setLogs] = useState<Map<string, StepLog>>(new Map());
  const [running, setRunning] = useState(false);
  const [currentStepId, setCurrentStepId] = useState<string | null>(null);
  const [stopOnFailure, setStopOnFailure] = useState(true);
  const [completed, setCompleted] = useState(false);

  const updateLog = useCallback((stepId: string, patch: Partial<StepLog>) => {
    setLogs((prev) => {
      const next = new Map(prev);
      const existing = next.get(stepId);
      next.set(stepId, { stepId, status: 'pending', output: '', ...existing, ...patch });
      return next;
    });
  }, []);

  const handleRun = useCallback(async () => {
    setRunning(true);
    setCompleted(false);
    setLogs(new Map());

    for (const step of runbook.steps) {
      if (!running) break; // allow stop

      setCurrentStepId(step.id);
      updateLog(step.id, { status: 'running', startedAt: isoNow() });

      try {
        const result = await executeStep(step);
        updateLog(step.id, {
          status: result.ok ? 'success' : 'failed',
          output: result.output,
          finishedAt: isoNow(),
        });

        if (!result.ok && stopOnFailure) {
          // Mark remaining as skipped
          const remaining = runbook.steps.slice(runbook.steps.indexOf(step) + 1);
          for (const r of remaining) {
            updateLog(r.id, { status: 'skipped', output: 'Skipped due to previous failure.' });
          }
          break;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        updateLog(step.id, {
          status: 'failed',
          output: `[${timestamp()}] Error: ${msg}`,
          finishedAt: isoNow(),
        });

        if (stopOnFailure) {
          const remaining = runbook.steps.slice(runbook.steps.indexOf(step) + 1);
          for (const r of remaining) {
            updateLog(r.id, { status: 'skipped', output: 'Skipped due to previous failure.' });
          }
          break;
        }
      }
    }

    setCurrentStepId(null);
    setRunning(false);
    setCompleted(true);
  }, [runbook.steps, running, stopOnFailure, updateLog]);

  const handleStop = useCallback(() => {
    setRunning(false);
    if (currentStepId) {
      updateLog(currentStepId, { status: 'skipped', output: 'Stopped by user.' });
    }
  }, [currentStepId, updateLog]);

  const successCount = [...logs.values()].filter((l) => l.status === 'success').length;
  const failedCount = [...logs.values()].filter((l) => l.status === 'failed').length;

  return (
    <div className="cd-rb-run">
      <header className="cd-rb-run__header">
        <div className="cd-rb-run__title-row">
          <h3 className="cd-costs__section">Running: {runbook.name}</h3>
          <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
        </div>
        <div className="cd-rb-run__controls">
          <label className="cd-rb-run__toggle">
            <Toggle
              checked={stopOnFailure}
              onChange={setStopOnFailure}
              label="Stop on failure"
            />
          </label>
          {!running && !completed && (
            <Button size="sm" onClick={handleRun}>Start Run</Button>
          )}
          {running && (
            <Button size="sm" variant="danger" onClick={handleStop}>Stop</Button>
          )}
          {completed && (
            <div className="cd-rb-run__summary">
              <span style={{ color: '#48bb78' }}>{successCount} passed</span>
              {failedCount > 0 && <span style={{ color: '#e53e3e' }}>{failedCount} failed</span>}
              <Button size="sm" onClick={handleRun}>Re-run</Button>
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
