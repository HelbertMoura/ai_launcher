import type { ExecutionMode } from '../domain/executionMode';
import { readKey, writeKey } from './storage';

export interface AuditEvent {
  id: string;
  at: string;
  action: string;
  outcome: 'allowed' | 'confirmed' | 'blocked' | 'failed';
  mode: ExecutionMode;
  workspaceId?: string;
  detail?: string;
}

const MAX_EVENTS = 200;
const SECRET_LIKE = /(?:sk-[a-z0-9_-]{8,}|bearer\s+\S+|(?:token|secret|password|api[_-]?key)\s*[:=]\s*\S+)/gi;

function redact(detail: string | undefined): string | undefined {
  if (!detail) return undefined;
  return detail.replace(SECRET_LIKE, '[redacted]').slice(0, 240);
}

export function appendAuditEvent(event: Omit<AuditEvent, 'id' | 'at'>): AuditEvent {
  const complete: AuditEvent = {
    ...event,
    detail: redact(event.detail),
    id: `audit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
  };
  writeKey('auditLog', [complete, ...readKey('auditLog')].slice(0, MAX_EVENTS));
  return complete;
}

export function readAuditLog(): AuditEvent[] {
  return readKey('auditLog') as AuditEvent[];
}

export function clearAuditLog(): void {
  writeKey('auditLog', []);
}
