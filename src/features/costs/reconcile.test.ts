import { describe, expect, it } from 'vitest';
import { normalizeDirPath, resolveProjectKey } from './reconcile';
import type { WorkspaceProfile } from '../../domain/types';

function workspace(id: string, name: string, directory: string): WorkspaceProfile {
  return {
    id,
    name,
    directory,
    cliKeys: [],
    envVars: {},
    tags: [],
    pinned: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

const WORKSPACES = [
  workspace('ws1', 'MyApp', 'C:\\Users\\helbe\\MyApp'),
  workspace('ws2', 'Blog', '/home/helbe/blog'),
  workspace('ws3', 'Empty dir', ''),
];

describe('normalizeDirPath', () => {
  it('lowercases, converts separators and strips trailing slashes', () => {
    expect(normalizeDirPath('C:\\Users\\Helbe\\MyApp\\')).toBe('c:/users/helbe/myapp');
    expect(normalizeDirPath('/Home/Helbe/Blog/')).toBe('/home/helbe/blog');
  });
});

describe('resolveProjectKey — precedence (gate condition 2)', () => {
  it('exact normalized path match wins over everything else', () => {
    const resolved = resolveProjectKey(
      { project: 'MyApp', projectPath: 'c:/users/helbe/myapp/' },
      WORKSPACES,
    );
    expect(resolved).toEqual({ key: 'c:/users/helbe/myapp', displayName: 'MyApp' });
  });

  it('exact match is case- and separator-insensitive on both sides', () => {
    const resolved = resolveProjectKey(
      { project: null, projectPath: 'C:\\USERS\\helbe\\MYAPP' },
      WORKSPACES,
    );
    expect(resolved?.key).toBe('c:/users/helbe/myapp');
  });

  it('unambiguous basename fallback matches (entry path differs from workspace dir)', () => {
    const resolved = resolveProjectKey(
      { project: 'MyApp', projectPath: 'D:\\elsewhere\\MyApp' },
      WORKSPACES,
    );
    // Matched -> canonical key becomes the workspace's normalized directory.
    expect(resolved).toEqual({ key: 'c:/users/helbe/myapp', displayName: 'MyApp' });
  });

  it('unambiguous basename fallback matches label-only (Claude-style) entries', () => {
    const resolved = resolveProjectKey({ project: 'myapp', projectPath: null }, WORKSPACES);
    expect(resolved).toEqual({ key: 'c:/users/helbe/myapp', displayName: 'myapp' });
  });

  it('ambiguous basenames NEVER match, falling back to the entry path key', () => {
    const ambiguous = [
      ...WORKSPACES,
      workspace('ws4', 'MyApp Copy', '/mnt/backup/MyApp'),
    ];
    const resolved = resolveProjectKey(
      { project: 'MyApp', projectPath: 'E:\\x\\MyApp' },
      ambiguous,
    );
    expect(resolved).toEqual({ key: 'e:/x/myapp', displayName: 'MyApp' });
  });

  it('ambiguous basenames with label-only entries fall back to the lowercased label', () => {
    const ambiguous = [
      ...WORKSPACES,
      workspace('ws4', 'MyApp Copy', '/mnt/backup/MyApp'),
    ];
    const resolved = resolveProjectKey({ project: 'MyApp', projectPath: null }, ambiguous);
    expect(resolved).toEqual({ key: 'myapp', displayName: 'MyApp' });
  });

  it('no workspace matched with a path: the normalized path is the key', () => {
    const resolved = resolveProjectKey(
      { project: 'Unknown', projectPath: 'F:\\Projects\\unknown-app' },
      WORKSPACES,
    );
    expect(resolved).toEqual({ key: 'f:/projects/unknown-app', displayName: 'Unknown' });
  });

  it('no workspace matched without a path: the lowercased label is the key', () => {
    const resolved = resolveProjectKey({ project: 'Side Project', projectPath: null }, WORKSPACES);
    expect(resolved).toEqual({ key: 'side project', displayName: 'Side Project' });
  });

  it('returns null when the entry has neither label nor path', () => {
    expect(resolveProjectKey({ project: null, projectPath: null }, WORKSPACES)).toBeNull();
    expect(resolveProjectKey({ project: '  ', projectPath: '' }, WORKSPACES)).toBeNull();
    expect(resolveProjectKey({}, [])).toBeNull();
  });

  it('display name falls back to a basename when the label is empty', () => {
    const resolved = resolveProjectKey(
      { project: null, projectPath: 'F:\\Projects\\unknown-app' },
      WORKSPACES,
    );
    expect(resolved).toEqual({ key: 'f:/projects/unknown-app', displayName: 'unknown-app' });
  });

  it('ignores workspaces with empty directories in basename matching', () => {
    const resolved = resolveProjectKey({ project: '', projectPath: null }, [
      workspace('ws3', 'Empty dir', ''),
    ]);
    expect(resolved).toBeNull();
  });
});
