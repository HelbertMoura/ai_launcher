import { useCallback, useMemo, useReducer, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import type { Runbook, RunbookCondition, RunbookStep } from '../../domain/types';
import { approvalFor, getExecutionMode } from '../../domain/executionMode';
import { appendAuditEvent } from '../../lib/auditLog';
import { buildPreview } from '../../lib/commandPreview';
import { invokeOrFallback } from '../../lib/tauri';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { Input } from '../../ui/Input';
import { SafeCommandPreview } from '../../ui/SafeCommandPreview';
import { Toggle } from '../../ui/Toggle';
import { showToast } from '../../ui/toastStore';
import {
  finishRunbookExecution,
  getResumableRunbookExecution,
  getRunbookExecutions,
  resumeRunbookExecution,
  setRunbookExecutionCursor,
  startRunbookExecution,
  updateRunbookExecutionStep,
  type RunbookExecution,
} from './runbookExecutionStore';
import {
  INITIAL_RUNBOOK_RUN_STATE,
  isRunbookRunActive,
  runbookRunReducer,
  type RunbookRunMode,
} from './runbookMachine';
import './Runbook.css';

export type StepStatus = 'pending' | 'running' | 'ready' | 'success' | 'failed' | 'skipped';

export interface StepLog {
  stepId: string;
  status: StepStatus;
  output: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
}

interface BackendStepResult {
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

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

interface RunbookRunnerProps {
  runbook: Runbook;
  onClose: () => void;
  cwd?: string;
  workspaceId?: string;
}

const STATUS_LABELS: Record<StepStatus, string> = {
  pending: '○', running: '◎', ready: '◇', success: '●', failed: '✕', skipped: '—',
};

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
  return Number.isNaN(start) || Number.isNaN(finish) ? undefined : Math.max(0, finish - start);
}

function formatDuration(ms?: number): string {
  if (ms == null) return '';
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 100) / 10;
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

function formatExecutionTime(iso: string): string {
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? '' : new Date(parsed).toLocaleString();
}

function formatCondition(condition: RunbookCondition | undefined): string {
  if (!condition || condition.type === 'always') return 'always';
  return `${condition.negate ? 'not ' : ''}${condition.type}${condition.value ? ` ${condition.value}` : ''}`;
}

function formatStepOutput(label: string, result: BackendStepResult): string {
  const parts = [`[${timestamp()}] ${label} · exit ${result.exitCode ?? '—'}`];
  if (result.timedOut) parts.push('(timed out)');
  if (result.stdout.trim()) parts.push(result.stdout.trimEnd());
  if (result.stderr.trim()) parts.push(`stderr:\n${result.stderr.trimEnd()}`);
  return parts.join('\n');
}

async function executeStep(
  step: RunbookStep,
  cwd: string | undefined,
  executionId: string,
): Promise<BackendStepResult> {
  const command = step.command?.trim();
  if (!command) {
    return {
      ok: true,
      exitCode: 0,
      stdout: `[${timestamp()}] ${step.label}: no command (${step.type})`,
      stderr: '',
      timedOut: false,
    };
  }
  const raw = await invoke<RawStepResult>('run_runbook_step', {
    command,
    cwd: cwd?.trim() || null,
    timeoutSecs: null,
    executionId,
  });
  return {
    ok: raw.ok,
    exitCode: raw.exit_code,
    stdout: raw.stdout,
    stderr: raw.stderr,
    timedOut: raw.timed_out,
  };
}

async function evaluateStepCondition(
  step: RunbookStep,
  previousSucceeded: boolean,
  cwd: string | undefined,
): Promise<ConditionResult> {
  const condition = step.condition;
  if (!condition || condition.type === 'always') return { ok: true, message: 'always' };
  if (condition.type === 'previousSucceeded') {
    const ok = condition.negate ? !previousSucceeded : previousSucceeded;
    return { ok, message: formatCondition(condition) };
  }
  return invokeOrFallback<ConditionResult>(
    'evaluate_runbook_condition',
    { condition, cwd: cwd?.trim() || null },
    { ok: true, message: 'condition skipped outside Tauri' },
  );
}

function executionLogs(execution: RunbookExecution | null): Map<string, StepLog> {
  return new Map((execution?.steps ?? []).map((step) => [step.stepId, { ...step }]));
}

interface StepRowProps {
  step: RunbookStep;
  log?: StepLog;
}

function StepRow({ step, log }: StepRowProps) {
  const status = log?.status ?? 'pending';
  return (
    <Card className={`cd-rb-run__step cd-rb-run__step--${status}`}>
      <div className="cd-rb-run__step-header">
        <span className="cd-rb-run__step-icon" aria-hidden>{STATUS_LABELS[status]}</span>
        <span className="cd-rb-run__step-label">{step.label}</span>
        <span className="cd-rb-run__step-type">{step.type}</span>
        {step.condition && <span className="cd-rb-run__step-condition">{formatCondition(step.condition)}</span>}
        {log?.durationMs != null && <span className="cd-rb-run__step-duration">{formatDuration(log.durationMs)}</span>}
        <span className="cd-rb-run__step-auto">{step.auto ? 'auto' : 'approval'}</span>
      </div>
      {log?.output && <pre className="cd-rb-run__output">{log.output}</pre>}
    </Card>
  );
}

export function RunbookRunner({ runbook, onClose, cwd, workspaceId }: RunbookRunnerProps) {
  const { t } = useTranslation();
  const [machine, dispatch] = useReducer(runbookRunReducer, INITIAL_RUNBOOK_RUN_STATE);
  const [logs, setLogs] = useState<Map<string, StepLog>>(new Map());
  const [executions, setExecutions] = useState(() => getRunbookExecutions(runbook.id));
  const [stopOnFailure, setStopOnFailure] = useState(true);
  const [query, setQuery] = useState('');
  const [approvalStep, setApprovalStep] = useState<RunbookStep | null>(null);
  const [approvalAcknowledged, setApprovalAcknowledged] = useState(false);
  const cancelRef = useRef(false);
  const executionIdRef = useRef<string | null>(null);
  const approvalResolverRef = useRef<((approved: boolean) => void) | null>(null);

  const refreshExecutions = useCallback(() => setExecutions(getRunbookExecutions(runbook.id)), [runbook.id]);

  const resumable = useMemo(
    () => getResumableRunbookExecution(runbook),
    [runbook, executions],
  );

  const updateLog = useCallback((stepId: string, patch: Partial<StepLog>) => {
    setLogs((current) => {
      const next = new Map(current);
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

  const requestApproval = useCallback((step: RunbookStep): Promise<boolean> => {
    setApprovalAcknowledged(false);
    setApprovalStep(step);
    return new Promise((resolve) => {
      approvalResolverRef.current = resolve;
    });
  }, []);

  const resolveApproval = useCallback((approved: boolean) => {
    approvalResolverRef.current?.(approved);
    approvalResolverRef.current = null;
    setApprovalStep(null);
  }, []);

  const runSequence = useCallback(async (
    mode: RunbookRunMode,
    existing?: RunbookExecution,
    requestedIndex?: number,
  ) => {
    cancelRef.current = false;
    const execution = existing
      ? resumeRunbookExecution(existing.id, requestedIndex ?? existing.nextStepIndex)
      : startRunbookExecution(runbook, cwd, { mode, workspaceId });
    if (!execution) return;
    const startIndex = requestedIndex ?? execution.nextStepIndex;
    executionIdRef.current = execution.id;
    setLogs(executionLogs(existing ? execution : null));
    dispatch({ type: 'begin', executionId: execution.id, mode, stepIndex: startIndex });
    refreshExecutions();
    appendAuditEvent({
      action: mode === 'dry-run' ? 'runbook.dry-run' : existing ? 'runbook.resume' : 'runbook.execute',
      outcome: 'allowed',
      mode: getExecutionMode(),
      workspaceId,
      detail: runbook.name,
    });

    let previousSucceeded = startIndex === 0
      || execution.steps.slice(0, startIndex).every((step) => step.status === 'success' || step.status === 'skipped');
    let runFailed = false;
    let runStopped = false;

    for (let index = startIndex; index < runbook.steps.length; index += 1) {
      if (cancelRef.current) { runStopped = true; break; }
      const step = runbook.steps[index];
      setRunbookExecutionCursor(execution.id, index);

      try {
        const condition = await evaluateStepCondition(step, previousSucceeded, cwd);
        if (cancelRef.current) { runStopped = true; break; }
        if (!condition.ok) {
          const finishedAt = isoNow();
          const output = `[${timestamp()}] ${t('runbook.run.conditionSkipped')}: ${condition.message}`;
          updateLog(step.id, { status: 'skipped', output, finishedAt });
          updateRunbookExecutionStep(execution.id, step.id, { status: 'skipped', output, finishedAt });
          setRunbookExecutionCursor(execution.id, index + 1);
          dispatch({ type: 'plan-ready', approvalRequired: false });
          dispatch({ type: 'step-finished', ok: true, nextStepIndex: index + 1, hasMore: index + 1 < runbook.steps.length, stopOnFailure });
          continue;
        }

        if (mode === 'dry-run') {
          const finishedAt = isoNow();
          const output = `[${timestamp()}] ${t('runbook.run.dryRunReady')}: ${formatCondition(step.condition)}`;
          updateLog(step.id, { status: 'ready', output, finishedAt });
          updateRunbookExecutionStep(execution.id, step.id, { status: 'ready', output, finishedAt });
          setRunbookExecutionCursor(execution.id, index + 1);
          dispatch({ type: 'plan-ready', approvalRequired: false });
          dispatch({ type: 'step-finished', ok: true, nextStepIndex: index + 1, hasMore: index + 1 < runbook.steps.length, stopOnFailure });
          continue;
        }

        const modeDecision = approvalFor(getExecutionMode(), 'execute');
        const approvalRequired = !step.auto || modeDecision === 'confirm';
        dispatch({ type: 'plan-ready', approvalRequired });
        if (approvalRequired) {
          const approved = await requestApproval(step);
          if (!approved) {
            cancelRef.current = true;
            runStopped = true;
            dispatch({ type: 'approval-rejected' });
            appendAuditEvent({ action: 'runbook.step.approval', outcome: 'blocked', mode: getExecutionMode(), workspaceId, detail: step.label });
            break;
          }
          appendAuditEvent({ action: 'runbook.step.approval', outcome: 'confirmed', mode: getExecutionMode(), workspaceId, detail: step.label });
          dispatch({ type: 'approval-granted' });
        }

        const startedAt = isoNow();
        updateLog(step.id, { status: 'running', startedAt });
        updateRunbookExecutionStep(execution.id, step.id, { status: 'running', startedAt });
        refreshExecutions();
        const result = await executeStep(step, cwd, execution.id);
        if (cancelRef.current) {
          const finishedAt = isoNow();
          const output = `[${timestamp()}] ${t('runbook.run.stopped')}`;
          updateLog(step.id, { status: 'skipped', output, finishedAt });
          updateRunbookExecutionStep(execution.id, step.id, { status: 'skipped', output, finishedAt });
          runStopped = true;
          break;
        }
        previousSucceeded = result.ok;
        runFailed ||= !result.ok;
        const finishedAt = isoNow();
        const output = formatStepOutput(step.label, result);
        const status = result.ok ? 'success' : 'failed';
        updateLog(step.id, { status, output, finishedAt });
        updateRunbookExecutionStep(execution.id, step.id, { status, output, finishedAt });
        setRunbookExecutionCursor(execution.id, result.ok ? index + 1 : index);
        dispatch({ type: 'step-finished', ok: result.ok, nextStepIndex: result.ok ? index + 1 : index, hasMore: index + 1 < runbook.steps.length, stopOnFailure });
        refreshExecutions();
        if (!result.ok && stopOnFailure) break;
      } catch (error) {
        if (cancelRef.current) { runStopped = true; break; }
        const message = error instanceof Error ? error.message : String(error);
        runFailed = true;
        previousSucceeded = false;
        const finishedAt = isoNow();
        const output = `[${timestamp()}] ${t('runbook.run.error')}: ${message}`;
        updateLog(step.id, { status: 'failed', output, finishedAt });
        updateRunbookExecutionStep(execution.id, step.id, { status: 'failed', output, finishedAt });
        setRunbookExecutionCursor(execution.id, index);
        dispatch({ type: 'failed', error: message });
        if (stopOnFailure) break;
      }
    }

    const status = runStopped ? 'stopped' : mode === 'dry-run' ? 'validated' : runFailed ? 'failed' : 'success';
    finishRunbookExecution(execution.id, status);
    if (status === 'failed') dispatch({ type: 'failed', error: t('runbook.run.failed', { count: 1 }) });
    if (status === 'success' || status === 'validated') dispatch({ type: 'complete' });
    if (runStopped) dispatch({ type: 'stop-requested' });
    if (runStopped) dispatch({ type: 'stopped' });
    executionIdRef.current = null;
    refreshExecutions();
    appendAuditEvent({
      action: mode === 'dry-run' ? 'runbook.dry-run.complete' : 'runbook.execute.complete',
      outcome: status === 'failed' ? 'failed' : status === 'stopped' ? 'blocked' : 'allowed',
      mode: getExecutionMode(), workspaceId, detail: `${runbook.name}: ${status}`,
    });
  }, [cwd, refreshExecutions, requestApproval, runbook, stopOnFailure, t, updateLog, workspaceId]);

  const handleStop = useCallback(async () => {
    cancelRef.current = true;
    dispatch({ type: 'stop-requested' });
    resolveApproval(false);
    const executionId = executionIdRef.current;
    if (!executionId) return;
    try {
      await invoke<boolean>('stop_runbook_execution', { executionId });
    } catch (error) {
      appendAuditEvent({ action: 'runbook.stop', outcome: 'failed', mode: getExecutionMode(), workspaceId, detail: error instanceof Error ? error.message : String(error) });
    }
  }, [resolveApproval, workspaceId]);

  const retryExecution = executions.find((execution) => execution.steps.some((step) => step.status === 'failed'));
  const retryIndex = retryExecution?.steps.findIndex((step) => step.status === 'failed') ?? -1;
  const active = isRunbookRunActive(machine.phase);
  const successCount = [...logs.values()].filter((log) => log.status === 'success').length;
  const readyCount = [...logs.values()].filter((log) => log.status === 'ready').length;
  const failedCount = [...logs.values()].filter((log) => log.status === 'failed').length;
  const filteredSteps = runbook.steps.filter((step) => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return true;
    return `${step.label}\n${logs.get(step.id)?.output ?? ''}`.toLocaleLowerCase().includes(needle);
  });

  const copyOutput = useCallback(async () => {
    const output = runbook.steps
      .map((step) => logs.get(step.id)?.output ? `# ${step.label}\n${logs.get(step.id)?.output}` : '')
      .filter(Boolean)
      .join('\n\n');
    await navigator.clipboard.writeText(output);
    showToast(t('runbook.run.outputCopied'), 'success');
  }, [logs, runbook.steps, t]);

  const approvalPreview = approvalStep?.command
    ? buildPreview(approvalStep.command, cwd ?? '')
    : null;
  const approvalBlocked = approvalPreview?.riskLevel === 'dangerous' && !approvalAcknowledged;

  return (
    <div className="cd-rb-run">
      <header className="cd-rb-run__header">
        <div className="cd-rb-run__title-row">
          <div>
            <span className="cd-rb-run__eyebrow">{t('runbook.run.commandDeck')}</span>
            <h2>{t('runbook.run.running', { name: runbook.name })}</h2>
          </div>
          <span className={`cd-rb-run__phase cd-rb-run__phase--${machine.phase}`}>{t(`runbook.run.phase.${machine.phase}`)}</span>
          <Button size="sm" variant="ghost" onClick={onClose} disabled={active}>{t('common.close')}</Button>
        </div>
        <div className="cd-rb-run__controls">
          <Toggle checked={stopOnFailure} onChange={setStopOnFailure} label={t('runbook.run.stopOnFailure')} />
          {!active && <Button size="sm" variant="ghost" onClick={() => void runSequence('dry-run')}>{t('runbook.run.dryRun')}</Button>}
          {!active && <Button size="sm" onClick={() => void runSequence('execute')}>{t('runbook.run.start')}</Button>}
          {active && <Button size="sm" variant="danger" onClick={() => void handleStop()} disabled={machine.phase === 'stopping'}>{machine.phase === 'stopping' ? t('runbook.run.stopping') : t('runbook.run.stop')}</Button>}
          {!active && resumable && <Button size="sm" onClick={() => void runSequence('execute', resumable)}>{t('runbook.run.resume', { step: resumable.nextStepIndex + 1 })}</Button>}
          {!active && retryExecution && retryIndex >= 0 && <Button size="sm" variant="ghost" onClick={() => void runSequence('execute', retryExecution, retryIndex)}>{t('runbook.run.retryFailed')}</Button>}
        </div>
        {!active && logs.size > 0 && (
          <div className="cd-rb-run__summary">
            <span className="is-ok">
              {machine.mode === 'dry-run'
                ? t('runbook.run.readyCount', { count: readyCount })
                : t('runbook.run.passed', { count: successCount })}
            </span>
            {failedCount > 0 && <span className="is-error">{t('runbook.run.failed', { count: failedCount })}</span>}
          </div>
        )}
      </header>

      <div className="cd-rb-run__output-tools">
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('runbook.run.searchOutput')} aria-label={t('runbook.run.searchOutput')} />
        <Button size="sm" variant="ghost" onClick={() => void copyOutput()} disabled={logs.size === 0}>{t('runbook.run.copyOutput')}</Button>
      </div>

      <div className="cd-rb-run__steps">
        {filteredSteps.map((step) => <StepRow key={step.id} step={step} log={logs.get(step.id)} />)}
        {filteredSteps.length === 0 && <p className="cd-rb-run__no-results">{t('runbook.run.noOutputMatch')}</p>}
      </div>

      <section className="cd-rb-run__history">
        <div className="cd-rb-run__history-head">
          <h3>{t('runbook.history.title')}</h3>
          <span>{t('runbook.history.count', { count: executions.length })}</span>
        </div>
        {executions.length === 0 ? <p className="cd-rb-run__history-empty">{t('runbook.history.empty')}</p> : (
          <ol className="cd-rb-run__timeline">
            {executions.slice(0, 5).map((execution) => (
              <li key={execution.id} className={`cd-rb-run__timeline-item cd-rb-run__timeline-item--${execution.status}`}>
                <span className="cd-rb-run__timeline-dot" />
                <div className="cd-rb-run__timeline-main">
                  <strong>{t(`runbook.history.status.${execution.status}`)}</strong>
                  <small>{formatExecutionTime(execution.startedAt)} · {execution.mode === 'dry-run' ? t('runbook.run.dryRun') : `#${execution.attempt}`}</small>
                </div>
                <span className="cd-rb-run__timeline-meta">{formatDuration(execution.durationMs)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <ConfirmDialog
        open={approvalStep !== null}
        title={t('runbook.run.approvalTitle', { step: approvalStep?.label ?? '' })}
        message={t('runbook.run.approvalMessage')}
        confirmLabel={t('runbook.run.approveStep')}
        confirmDisabled={approvalBlocked}
        onConfirm={() => resolveApproval(true)}
        onCancel={() => resolveApproval(false)}
      >
        {approvalPreview && (
          <SafeCommandPreview
            preview={approvalPreview}
            hideActions
            onConfirm={() => resolveApproval(true)}
            onCancel={() => resolveApproval(false)}
            onAckChange={setApprovalAcknowledged}
          />
        )}
      </ConfirmDialog>
    </div>
  );
}
