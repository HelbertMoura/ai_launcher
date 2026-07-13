import { describe, expect, it } from 'vitest';
import { INITIAL_RUNBOOK_RUN_STATE, runbookRunReducer } from './runbookMachine';

describe('runbookRunReducer', () => {
  it('moves an approved step through the explicit lifecycle', () => {
    let state = runbookRunReducer(INITIAL_RUNBOOK_RUN_STATE, {
      type: 'begin', executionId: 'run-1', mode: 'execute',
    });
    state = runbookRunReducer(state, { type: 'plan-ready', approvalRequired: true });
    expect(state.phase).toBe('awaiting-approval');
    state = runbookRunReducer(state, { type: 'approval-granted' });
    expect(state.phase).toBe('running');
    state = runbookRunReducer(state, {
      type: 'step-finished', ok: true, nextStepIndex: 1, hasMore: false, stopOnFailure: true,
    });
    expect(state).toMatchObject({ phase: 'completed', stepIndex: 1 });
  });

  it('keeps dry-run mode and advances deterministically', () => {
    let state = runbookRunReducer(INITIAL_RUNBOOK_RUN_STATE, {
      type: 'begin', executionId: 'run-2', mode: 'dry-run', stepIndex: 2,
    });
    state = runbookRunReducer(state, { type: 'plan-ready', approvalRequired: false });
    state = runbookRunReducer(state, {
      type: 'step-finished', ok: true, nextStepIndex: 3, hasMore: true, stopOnFailure: true,
    });
    expect(state).toMatchObject({ phase: 'planning', mode: 'dry-run', stepIndex: 3 });
  });

  it('has an explicit stopping state', () => {
    let state = runbookRunReducer(INITIAL_RUNBOOK_RUN_STATE, {
      type: 'begin', executionId: 'run-3', mode: 'execute',
    });
    state = runbookRunReducer(state, { type: 'plan-ready', approvalRequired: false });
    state = runbookRunReducer(state, { type: 'stop-requested' });
    expect(state.phase).toBe('stopping');
    expect(runbookRunReducer(state, { type: 'stopped' }).phase).toBe('stopped');
  });

  it('stops after failure when configured', () => {
    let state = runbookRunReducer(INITIAL_RUNBOOK_RUN_STATE, {
      type: 'begin', executionId: 'run-4', mode: 'execute',
    });
    state = runbookRunReducer(state, { type: 'plan-ready', approvalRequired: false });
    state = runbookRunReducer(state, {
      type: 'step-finished', ok: false, nextStepIndex: 1, hasMore: true, stopOnFailure: true,
    });
    expect(state.phase).toBe('failed');
  });

  it('can complete an empty plan without remaining active', () => {
    const planning = runbookRunReducer(INITIAL_RUNBOOK_RUN_STATE, {
      type: 'begin', executionId: 'run-empty', mode: 'dry-run',
    });
    expect(runbookRunReducer(planning, { type: 'complete' }).phase).toBe('completed');
  });
});
