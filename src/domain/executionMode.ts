import { readKey, removeKey, writeKey } from '../lib/storage';

export type PersistentExecutionMode = 'safe' | 'standard';
export type ExecutionMode = PersistentExecutionMode | 'admin';
export type ActionRisk = 'read' | 'write' | 'execute' | 'privileged';
export type ApprovalDecision = 'allow' | 'confirm' | 'block';

export const EXECUTION_MODE_CHANGED_EVENT = 'ai-launcher:execution-mode-changed';
const ADMIN_DURATION_MS = 15 * 60 * 1000;

export function getExecutionMode(now = Date.now()): ExecutionMode {
  const until = Date.parse(readKey('temporaryAdminUntil'));
  if (!Number.isNaN(until) && until > now) return 'admin';
  if (readKey('temporaryAdminUntil')) removeKey('temporaryAdminUntil');
  return readKey('executionMode');
}

function notify(): void {
  window.dispatchEvent(new CustomEvent(EXECUTION_MODE_CHANGED_EVENT));
}

export function setExecutionMode(mode: PersistentExecutionMode): void {
  writeKey('executionMode', mode);
  removeKey('temporaryAdminUntil');
  notify();
}

export function enableTemporaryAdmin(now = Date.now()): string {
  const until = new Date(now + ADMIN_DURATION_MS).toISOString();
  writeKey('temporaryAdminUntil', until);
  notify();
  return until;
}

export function disableTemporaryAdmin(): void {
  removeKey('temporaryAdminUntil');
  notify();
}

export function approvalFor(mode: ExecutionMode, risk: ActionRisk): ApprovalDecision {
  if (risk === 'read') return 'allow';
  if (mode === 'admin') return 'allow';
  if (mode === 'standard') return risk === 'privileged' ? 'confirm' : 'allow';
  if (risk === 'privileged') return 'block';
  return 'confirm';
}
