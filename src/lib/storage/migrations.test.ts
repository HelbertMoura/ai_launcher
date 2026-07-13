import { beforeEach, describe, expect, it } from 'vitest';
import { CURRENT_STORAGE_SCHEMA_VERSION, migrateStorage } from './migrations';
import { readKey } from './index';

describe('storage migrations', () => {
  beforeEach(() => localStorage.clear());

  it('creates a recovery manifest without transient secret keys', () => {
    localStorage.setItem('ai-launcher:theme', 'amber');
    localStorage.setItem('ai-launcher-secret:provider-apikey:test', 'must-not-leak');
    expect(migrateStorage()).toMatchObject({ ok: true, from: 0, to: CURRENT_STORAGE_SCHEMA_VERSION });
    const manifest = JSON.parse(localStorage.getItem('ai-launcher:v21:migration-manifest') ?? '{}');
    expect(manifest.backup.theme).toBe('amber');
    expect(JSON.stringify(manifest)).not.toContain('must-not-leak');
  });

  it('is idempotent after the current version is recorded', () => {
    migrateStorage();
    const manifest = localStorage.getItem('ai-launcher:v21:migration-manifest');
    expect(migrateStorage()).toMatchObject({ ok: true, from: CURRENT_STORAGE_SCHEMA_VERSION, to: CURRENT_STORAGE_SCHEMA_VERSION });
    expect(localStorage.getItem('ai-launcher:v21:migration-manifest')).toBe(manifest);
  });

  it('does not expose mutable registry defaults', () => {
    const first = readKey('recentDirs');
    first.claude = ['C:\\mutated'];
    expect(readKey('recentDirs')).toEqual({});
  });
});
