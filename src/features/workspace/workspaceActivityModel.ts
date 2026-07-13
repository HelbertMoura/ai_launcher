import type { TabId } from '../../app/layout/TabId';
import { readAuditLog } from '../../lib/auditLog';
import { readKey } from '../../lib/storage';
import { getRunbookExecutions } from './runbookExecutionStore';

export type WorkspaceTimelineKind = 'session' | 'runbook' | 'mcp' | 'security';
export type WorkspaceTimelineStatus = 'active' | 'success' | 'warning' | 'failed' | 'blocked' | 'info';

export interface WorkspaceTimelineEvent {
  id: string;
  at: string;
  kind: WorkspaceTimelineKind;
  status: WorkspaceTimelineStatus;
  title: string;
  detail?: string;
  sourceTab: TabId;
  sourceId?: string;
}

interface TimelineOptions {
  workspaceId: string;
  directory: string;
  limit?: number;
}

const MAX_EVENTS = 200;
const SECRET_LIKE = /(?:sk-[a-z0-9_-]{8,}|bearer\s+\S+|(?:token|secret|password|api[_-]?key)\s*[:=]\s*\S+)/gi;

function normalizeDirectory(value: string | undefined): string {
  return (value ?? '').trim().replace(/\\/g, '/').replace(/\/$/, '').toLocaleLowerCase();
}

function safeDetail(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.replace(SECRET_LIKE, '[redacted]').slice(0, 160);
}

function auditKind(action: string): WorkspaceTimelineKind {
  if (action.startsWith('mcp.')) return 'mcp';
  if (action.startsWith('security.') || action.includes('approval') || action.includes('profile.write')) return 'security';
  return 'security';
}

function auditStatus(outcome: string): WorkspaceTimelineStatus {
  if (outcome === 'failed') return 'failed';
  if (outcome === 'blocked') return 'blocked';
  if (outcome === 'confirmed') return 'warning';
  return 'success';
}

function runbookStatus(status: string): WorkspaceTimelineStatus {
  if (status === 'running') return 'active';
  if (status === 'failed') return 'failed';
  if (status === 'stopped') return 'warning';
  return 'success';
}

export function getWorkspaceTimeline({ workspaceId, directory, limit = MAX_EVENTS }: TimelineOptions): WorkspaceTimelineEvent[] {
  const normalizedDirectory = normalizeDirectory(directory);
  const config = readKey('config');
  const history = Array.isArray(config.history) ? config.history as Record<string, unknown>[] : [];

  const sessionEvents: WorkspaceTimelineEvent[] = history
    .filter((item) => normalizeDirectory(item.directory as string | undefined) === normalizedDirectory)
    .map((item, index) => {
      const rawStatus = item.status as string | undefined;
      const status: WorkspaceTimelineStatus = rawStatus === 'running' || rawStatus === 'starting'
        ? 'active'
        : rawStatus === 'failed' ? 'failed' : rawStatus === 'unknown' ? 'warning' : 'success';
      return {
        id: `session-${String(item.sessionId ?? item.timestamp ?? index)}`,
        at: String(item.startedAt ?? item.timestamp ?? ''),
        kind: 'session',
        status,
        title: String(item.cli ?? item.cliKey ?? 'CLI session'),
        detail: safeDetail(item.description as string | undefined),
        sourceTab: 'history',
        sourceId: item.sessionId as string | undefined,
      };
    });

  const runbookEvents: WorkspaceTimelineEvent[] = getRunbookExecutions()
    .filter((execution) => execution.workspaceId === workspaceId
      || (!execution.workspaceId && normalizeDirectory(execution.cwd) === normalizedDirectory))
    .map((execution) => ({
      id: execution.id,
      at: execution.finishedAt ?? execution.startedAt,
      kind: 'runbook',
      status: runbookStatus(execution.status),
      title: execution.runbookName,
      detail: execution.mode === 'dry-run' ? 'dry-run' : `attempt ${execution.attempt ?? 1}`,
      sourceTab: 'workspace',
      sourceId: execution.runbookId,
    }));

  const auditEvents: WorkspaceTimelineEvent[] = readAuditLog()
    .filter((event) => event.workspaceId === workspaceId && (
      event.action.startsWith('mcp.')
      || event.action.startsWith('security.')
      || event.action.includes('approval')
      || event.action.includes('profile.write')
    ))
    .map((event) => {
      const kind = auditKind(event.action);
      return {
        id: event.id,
        at: event.at,
        kind,
        status: auditStatus(event.outcome),
        title: event.action,
        detail: safeDetail(event.detail),
        sourceTab: kind === 'mcp' ? 'mcp' : 'admin',
      };
    });

  return [...sessionEvents, ...runbookEvents, ...auditEvents]
    .filter((event) => !Number.isNaN(Date.parse(event.at)))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, Math.min(Math.max(0, limit), MAX_EVENTS));
}
