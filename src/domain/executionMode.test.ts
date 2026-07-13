import { beforeEach, describe, expect, it } from 'vitest';
import { approvalFor, enableTemporaryAdmin, getExecutionMode, setExecutionMode } from './executionMode';

describe('execution mode policy', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to safe and requires confirmation for mutations', () => {
    expect(getExecutionMode()).toBe('safe');
    expect(approvalFor('safe', 'write')).toBe('confirm');
    expect(approvalFor('safe', 'privileged')).toBe('block');
  });

  it('allows normal work in standard but confirms privileged actions', () => {
    setExecutionMode('standard');
    expect(getExecutionMode()).toBe('standard');
    expect(approvalFor('standard', 'execute')).toBe('allow');
    expect(approvalFor('standard', 'privileged')).toBe('confirm');
  });

  it('expires temporary admin deterministically', () => {
    enableTemporaryAdmin(1_000);
    expect(getExecutionMode(1_001)).toBe('admin');
    expect(getExecutionMode(1_000 + 16 * 60 * 1000)).toBe('safe');
  });
});
