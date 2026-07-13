import { beforeEach, describe, expect, it } from 'vitest';
import type { Runbook } from '../../domain/types';
import { appendAuditEvent } from '../../lib/auditLog';
import { writeKey } from '../../lib/storage';
import { startRunbookExecution } from './runbookExecutionStore';
import { getWorkspaceTimeline } from './workspaceActivityModel';

const runbook: Runbook = {
  id: 'rb-1', name: 'Setup', tags: [], createdAt: '2026-07-13T00:00:00.000Z',
  updatedAt: '2026-07-13T00:00:00.000Z', steps: [],
};

describe('workspace timeline', () => {
  beforeEach(() => localStorage.clear());

  it('normalizes sessions, runbooks and scoped audited events without command payloads', () => {
    writeKey('config', {
      history: [{ cli: 'Codex', directory: 'C:\\dev\\app', args: '--token secret-value', timestamp: '2026-07-13T10:00:00.000Z', status: 'completed' }],
    });
    startRunbookExecution(runbook, 'C:\\dev\\app', { workspaceId: 'ws-1' });
    appendAuditEvent({ action: 'mcp.server.add', outcome: 'confirmed', mode: 'safe', workspaceId: 'ws-1', detail: 'github token=secret-value' });
    appendAuditEvent({ action: 'runbook.execute.complete', outcome: 'allowed', mode: 'safe', workspaceId: 'ws-1', detail: 'duplicate' });
    appendAuditEvent({ action: 'mcp.server.add', outcome: 'confirmed', mode: 'safe', workspaceId: 'ws-other' });

    const events = getWorkspaceTimeline({ workspaceId: 'ws-1', directory: 'c:/dev/app' });

    expect(events.map((event) => event.kind)).toEqual(expect.arrayContaining(['session', 'runbook', 'mcp']));
    expect(events.some((event) => event.id.includes('ws-other'))).toBe(false);
    expect(JSON.stringify(events)).not.toContain('--token');
    expect(JSON.stringify(events)).not.toContain('secret-value');
    expect(JSON.stringify(events)).not.toContain('runbook.execute.complete');
  });

  it('bounds the result to 200 newest events', () => {
    writeKey('config', {
      history: Array.from({ length: 250 }, (_, index) => ({
        cli: `CLI ${index}`, directory: 'C:\\dev\\app', timestamp: new Date(1_700_000_000_000 + index).toISOString(), status: 'completed',
      })),
    });
    const events = getWorkspaceTimeline({ workspaceId: 'ws-1', directory: 'C:\\dev\\app', limit: 999 });
    expect(events).toHaveLength(200);
    expect(events[0].title).toBe('CLI 249');
  });
});
