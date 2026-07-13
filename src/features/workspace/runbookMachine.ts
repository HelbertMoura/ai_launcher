export type RunbookRunMode = 'execute' | 'dry-run';

export type RunbookRunPhase =
  | 'idle'
  | 'planning'
  | 'awaiting-approval'
  | 'running'
  | 'stopping'
  | 'completed'
  | 'failed'
  | 'stopped';

export interface RunbookRunState {
  phase: RunbookRunPhase;
  mode: RunbookRunMode;
  executionId: string | null;
  stepIndex: number;
  error?: string;
}

export type RunbookRunAction =
  | { type: 'begin'; executionId: string; mode: RunbookRunMode; stepIndex?: number }
  | { type: 'plan-ready'; approvalRequired: boolean }
  | { type: 'approval-granted' }
  | { type: 'approval-rejected' }
  | { type: 'step-finished'; ok: boolean; nextStepIndex: number; hasMore: boolean; stopOnFailure: boolean }
  | { type: 'stop-requested' }
  | { type: 'stopped' }
  | { type: 'complete' }
  | { type: 'failed'; error: string }
  | { type: 'reset' };

export const INITIAL_RUNBOOK_RUN_STATE: RunbookRunState = {
  phase: 'idle',
  mode: 'execute',
  executionId: null,
  stepIndex: 0,
};

/** Pure lifecycle used by the runner and covered independently from React. */
export function runbookRunReducer(
  state: RunbookRunState,
  action: RunbookRunAction,
): RunbookRunState {
  switch (action.type) {
    case 'begin':
      return {
        phase: 'planning',
        mode: action.mode,
        executionId: action.executionId,
        stepIndex: action.stepIndex ?? 0,
      };
    case 'plan-ready':
      if (state.phase !== 'planning') return state;
      return { ...state, phase: action.approvalRequired ? 'awaiting-approval' : 'running' };
    case 'approval-granted':
      return state.phase === 'awaiting-approval' ? { ...state, phase: 'running' } : state;
    case 'approval-rejected':
      return state.phase === 'awaiting-approval' ? { ...state, phase: 'stopped' } : state;
    case 'step-finished':
      if (state.phase !== 'running') return state;
      if (!action.ok && action.stopOnFailure) {
        return { ...state, phase: 'failed', stepIndex: action.nextStepIndex };
      }
      if (!action.hasMore) {
        return { ...state, phase: action.ok ? 'completed' : 'failed', stepIndex: action.nextStepIndex };
      }
      return { ...state, phase: 'planning', stepIndex: action.nextStepIndex };
    case 'stop-requested':
      return state.phase === 'running' || state.phase === 'planning' || state.phase === 'awaiting-approval'
        ? { ...state, phase: 'stopping' }
        : state;
    case 'stopped':
      return state.phase === 'stopping' ? { ...state, phase: 'stopped' } : state;
    case 'complete':
      return { ...state, phase: 'completed' };
    case 'failed':
      return { ...state, phase: 'failed', error: action.error };
    case 'reset':
      return INITIAL_RUNBOOK_RUN_STATE;
  }
}

export function isRunbookRunActive(phase: RunbookRunPhase): boolean {
  return phase === 'planning' || phase === 'awaiting-approval' || phase === 'running' || phase === 'stopping';
}
