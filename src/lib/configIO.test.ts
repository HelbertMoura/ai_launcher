import { describe, it, expect, beforeEach } from 'vitest';
import { importConfig } from './configIO';

describe('importConfig', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('rejects non-JSON input', () => {
    const result = importConfig('not json', 'replace');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/JSON/);
  });

  it('rejects empty object', () => {
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

  it('accepts minimal valid dump', () => {
    const dump = {
      version: '13.5',
      exportedAt: '2026-04-23T10:00:00Z',
      providers: {},
    };
    const result = importConfig(JSON.stringify(dump), 'replace');
    expect(result.ok).toBe(true);
  });

  it('accepts dump with presets and config', () => {
    const dump = {
      version: '14.0',
      exportedAt: '2026-04-23T10:00:00Z',
      providers: { profiles: [] },
      presets: [],
      config: { theme: 'dark' },
      settings: { displayFont: 'JetBrains Mono' },
    };
    const result = importConfig(JSON.stringify(dump), 'replace');
    expect(result.ok).toBe(true);
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
