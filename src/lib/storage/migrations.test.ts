import { beforeEach, describe, expect, it } from 'vitest';
import { CURRENT_STORAGE_SCHEMA_VERSION, migrateStorage } from './migrations';
import { readKey } from './index';
import { REGISTRY } from './registry';

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

describe('budget registry entry — v15 -> v3 migration for old backups', () => {
  beforeEach(() => localStorage.clear());

  it('migrates a real v15 payload loss-lessly (gate condition 1)', () => {
    const migrate = REGISTRY.budget.migrate;
    expect(migrate).toBeDefined();

    const migrated = migrate!(
      {
        limits: [
          {
            providerKey: 'anthropic',
            limitUsd: 50,
            periodDays: 30,
            alertAtPercent: 80,
            periodAnchor: '2026-01-15',
          },
        ],
      },
      0,
    ) as { limits: Array<Record<string, unknown>> };

    expect(migrated.limits).toHaveLength(1);
    expect(migrated.limits[0]).toMatchObject({
      scope: { kind: 'provider', providerKey: 'anthropic' },
      limitUsd: 50,
      period: { kind: 'rolling', days: 30, anchor: '2026-01-15' },
      alertAtPercent: 80,
    });
    expect(String(migrated.limits[0].id)).toMatch(/^bgt-[0-9a-f]{8}$/);
    expect(String(migrated.limits[0].createdAt)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('is idempotent: already-v3 payloads pass through untouched', () => {
    const migrate = REGISTRY.budget.migrate!;
    const v3 = {
      limits: [
        {
          id: 'bgt-00000001',
          scope: { kind: 'provider', providerKey: 'x' },
          limitUsd: 1,
          period: { kind: 'rolling', days: 7 },
          alertAtPercent: 80,
          createdAt: '2020-01-01',
        },
      ],
    };
    expect(migrate(v3, 0)).toEqual(v3);
  });
});
