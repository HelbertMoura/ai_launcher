import { describe, it, expect, beforeEach } from 'vitest';
import { exportConfig, importConfig } from './configIO';
import { readKey, writeKey, STORAGE_KEYS } from './storage';

describe('importConfig — validation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('rejects non-JSON input', () => {
    const result = importConfig('not json', 'replace');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/JSON/);
  });

  it('rejects empty object (missing version)', () => {
    const result = importConfig('{}', 'replace');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/invalido|version/i);
  });

  it('rejects missing version', () => {
    const result = importConfig(
      JSON.stringify({ exportedAt: '2026-04-23', providers: {} }),
      'replace',
    );
    expect(result.ok).toBe(false);
  });

  it('rejects wrong type for providers', () => {
    const result = importConfig(
      JSON.stringify({
        version: '13',
        exportedAt: '2026-04-23',
        providers: 'not an object',
      }),
      'replace',
    );
    expect(result.ok).toBe(false);
  });

  it('error message mentions invalid field path', () => {
    const result = importConfig(
      JSON.stringify({ version: 123, exportedAt: '2026', providers: {} }),
      'replace',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/version/i);
  });
});

describe('importConfig — legacy backup compatibility', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('accepts a minimal legacy dump', () => {
    const result = importConfig(
      JSON.stringify({ version: '13.5', exportedAt: '2026-04-23T10:00:00Z', providers: {} }),
      'replace',
    );
    expect(result.ok).toBe(true);
  });

  it('restores legacy top-level providers/presets/config/settings onto registry keys', () => {
    const dump = {
      version: '14.0',
      exportedAt: '2026-04-23T10:00:00Z',
      providers: { profiles: [{ id: 'p1' }], activeId: 'p1' },
      presets: [{ id: 'preset-1' }],
      config: { theme: 'dark' },
      settings: { displayFont: 'JetBrains Mono' },
    };
    const result = importConfig(JSON.stringify(dump), 'replace');
    expect(result.ok).toBe(true);

    expect(localStorage.getItem(STORAGE_KEYS.providers)).toContain('p1');
    expect(localStorage.getItem(STORAGE_KEYS.presets)).toContain('preset-1');
    expect(localStorage.getItem(STORAGE_KEYS.config)).toContain('dark');
    // raw string entry — not JSON-wrapped
    expect(localStorage.getItem(STORAGE_KEYS.displayFont)).toBe('JetBrains Mono');
  });
});

describe('exportConfig / importConfig — registry round-trip', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trip preserves every populated registry key', () => {
    // Seed a representative spread of keys across serialize modes / shapes.
    writeKey('profiles', [
      {
        id: 'pr1',
        name: 'Prof',
        cliKeys: ['claude'],
        toolKeys: [],
        tags: ['x'],
        pinned: true,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ] as never);
    writeKey('workspaces', [
      {
        id: 'ws1',
        name: 'Work',
        directory: '/tmp',
        cliKeys: [],
        envVars: { FOO: 'bar' },
        tags: [],
        pinned: false,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ] as never);
    writeKey('activeWorkspace', 'ws1');
    writeKey('budget', { limits: [{ providerKey: 'anthropic', limitUsd: 50, periodDays: 30, alertAtPercent: 80 }] });
    writeKey('runbooks', { runbooks: [{ id: 'rb1', name: 'Run', steps: [], tags: [], createdAt: 'a', updatedAt: 'b' }] });
    writeKey('cliOrder', ['claude', 'codex']);
    writeKey('cliOverrides', { claude: { name: 'Claude X' } });
    writeKey('theme', 'midnight');
    writeKey('accent', 'blue');
    writeKey('locale', 'pt-BR');
    writeKey('lastDir', { default: '/home/user' });
    writeKey('recentDirs', { default: ['/a', '/b'] });

    const json = exportConfig('16.0.0');

    // The dump must carry a registry-driven `keys` map containing what we wrote.
    const dump = JSON.parse(json) as { keys: Record<string, unknown> };
    for (const id of [
      'profiles',
      'workspaces',
      'activeWorkspace',
      'budget',
      'runbooks',
      'cliOrder',
      'cliOverrides',
      'theme',
      'accent',
      'locale',
      'lastDir',
      'recentDirs',
    ]) {
      expect(dump.keys[id]).toBeDefined();
    }

    // Wipe and re-import into a clean store.
    localStorage.clear();
    const result = importConfig(json, 'replace');
    expect(result.ok).toBe(true);

    // Every key should read back identical to what we wrote.
    expect(readKey('profiles')).toHaveLength(1);
    expect((readKey('profiles')[0] as { id: string }).id).toBe('pr1');
    expect(readKey('workspaces')).toHaveLength(1);
    expect(readKey('activeWorkspace')).toBe('ws1');
    expect(readKey('budget').limits).toHaveLength(1);
    expect(readKey('runbooks').runbooks).toHaveLength(1);
    expect(readKey('cliOrder')).toEqual(['claude', 'codex']);
    expect(readKey('cliOverrides').claude).toEqual({ name: 'Claude X' });
    expect(readKey('theme')).toBe('midnight');
    expect(readKey('accent')).toBe('blue');
    expect(readKey('locale')).toBe('pt-BR');
    expect(readKey('lastDir')).toEqual({ default: '/home/user' });
    expect(readKey('recentDirs')).toEqual({ default: ['/a', '/b'] });
  });

  it('redacts provider apiKey on export and preserves it on merge re-import', () => {
    writeKey('providers', {
      profiles: [{ id: 'p1', apiKey: 'sk-super-secret', extraEnv: { OPENAI_API_KEY: 'leak' } }],
    } as never);

    const json = exportConfig('16.0.0');
    expect(json).not.toContain('sk-super-secret');
    expect(json).not.toContain('leak');
    expect(json).toContain('{{REDACTED}}');

    // Merge import should keep the local secret (placeholder must not overwrite it).
    const result = importConfig(json, 'merge');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.redactedCount).toBeGreaterThan(0);

    const providers = readKey('providers') as { profiles: Array<{ apiKey: string }> };
    expect(providers.profiles[0].apiKey).toBe('sk-super-secret');
  });

  it('does NOT export machine-local flags (onboarding / migrated)', () => {
    writeKey('onboardingDone', 'true');
    writeKey('profilesMigrated', 'true');
    const dump = JSON.parse(exportConfig('16.0.0')) as { keys: Record<string, unknown> };
    expect(dump.keys.onboardingDone).toBeUndefined();
    expect(dump.keys.profilesMigrated).toBeUndefined();
  });
});

describe('storage helpers — corruption resilience', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('corrupt JSON falls back to the registry default without throwing', () => {
    localStorage.setItem(STORAGE_KEYS.profiles, '{not valid json');
    expect(() => readKey('profiles')).not.toThrow();
    expect(readKey('profiles')).toEqual([]);
  });

  it('schema mismatch falls back to default without throwing', () => {
    // profiles expects an array; store an object instead.
    localStorage.setItem(STORAGE_KEYS.profiles, JSON.stringify({ nope: true }));
    expect(() => readKey('profiles')).not.toThrow();
    expect(readKey('profiles')).toEqual([]);
  });

  it('importing a backup with one corrupt key leaves other keys intact', () => {
    const json = JSON.stringify({
      version: '16.0.0',
      exportedAt: '2026-06-10T00:00:00Z',
      keys: {
        theme: 'midnight',
        // budget shape is wrong, but import persists raw; the next readKey defaults it.
        budget: 'totally-not-a-budget',
      },
    });
    const result = importConfig(json, 'replace');
    expect(result.ok).toBe(true);
    expect(readKey('theme')).toBe('midnight');
    // Corrupt budget value -> readKey returns the default without throwing.
    expect(() => readKey('budget')).not.toThrow();
    expect(readKey('budget')).toEqual({ limits: [] });
  });
});
