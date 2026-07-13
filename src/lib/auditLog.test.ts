import { beforeEach, describe, expect, it } from 'vitest';
import { appendAuditEvent, readAuditLog } from './auditLog';

describe('audit log', () => {
  beforeEach(() => localStorage.clear());

  it('redacts secret-like details', () => {
    appendAuditEvent({ action: 'provider.save', outcome: 'confirmed', mode: 'safe', detail: 'apiKey=sk-super-secret-value' });
    expect(readAuditLog()[0].detail).toBe('[redacted]');
  });

  it('keeps a bounded newest-first log', () => {
    for (let index = 0; index < 205; index += 1) appendAuditEvent({ action: `action-${index}`, outcome: 'allowed', mode: 'standard' });
    expect(readAuditLog()).toHaveLength(200);
    expect(readAuditLog()[0].action).toBe('action-204');
  });
});
