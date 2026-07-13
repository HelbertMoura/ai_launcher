// ==============================================================================

import { readKey, writeKey, type RegistryId } from './storage';
// AI Launcher Pro - CLI/IDE Overrides (v7.1)
// Per-key override for built-in CLI + IDE display name and icon.
// Storage is separated from custom CLIs — built-ins are merged on top of
// their hardcoded definitions at render time. Empty override entries are
// removed from storage to avoid stub keys accumulating.
// ==============================================================================

export interface CliOverride {
  name?: string;
  iconEmoji?: string;
  iconDataUrl?: string;
}

export type CliOverrides = Record<string, CliOverride>;

// Same-tab sync bus — mirrors the pattern used by customClis/customIdes.
export const CLI_OVERRIDES_CHANGED_EVENT = 'ai-launcher:cli-overrides-changed';
export const IDE_OVERRIDES_CHANGED_EVENT = 'ai-launcher:ide-overrides-changed';

function loadFrom(key: Extract<RegistryId, 'cliOverrides' | 'ideOverrides'>): CliOverrides {
    const parsed: unknown = readKey(key);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    // Shallow shape-check: keep only plain object entries with name/icon strings.
    const result: CliOverrides = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v !== 'object' || v === null) continue;
      const item = v as Record<string, unknown>;
      const entry: CliOverride = {};
      if (typeof item.name === 'string') entry.name = item.name;
      if (typeof item.iconEmoji === 'string') entry.iconEmoji = item.iconEmoji;
      if (typeof item.iconDataUrl === 'string') entry.iconDataUrl = item.iconDataUrl;
      if (entry.name || entry.iconEmoji || entry.iconDataUrl) result[k] = entry;
    }
    return result;
}

function saveTo(key: Extract<RegistryId, 'cliOverrides' | 'ideOverrides'>, overrides: CliOverrides, eventName: string): void {
  if (writeKey(key, overrides)) {
    try {
      window.dispatchEvent(new CustomEvent(eventName, { detail: overrides }));
    } catch {
      /* ignore */
    }
  }
}

export const loadCliOverrides = (): CliOverrides => loadFrom('cliOverrides');
export const loadIdeOverrides = (): CliOverrides => loadFrom('ideOverrides');

export const saveCliOverrides = (o: CliOverrides): void =>
  saveTo('cliOverrides', o, CLI_OVERRIDES_CHANGED_EVENT);
export const saveIdeOverrides = (o: CliOverrides): void =>
  saveTo('ideOverrides', o, IDE_OVERRIDES_CHANGED_EVENT);

export function setCliOverride(
  all: CliOverrides,
  key: string,
  override: CliOverride
): CliOverrides {
  const cleaned: CliOverride = {
    name: override.name?.trim() || undefined,
    iconEmoji: override.iconEmoji?.trim() || undefined,
    iconDataUrl: override.iconDataUrl?.trim() || undefined,
  };
  if (!cleaned.name && !cleaned.iconEmoji && !cleaned.iconDataUrl) {
    // Empty override → remove entry entirely.
    const next = { ...all };
    delete next[key];
    return next;
  }
  return { ...all, [key]: cleaned };
}

export function clearCliOverride(all: CliOverrides, key: string): CliOverrides {
  const next = { ...all };
  delete next[key];
  return next;
}

export function getEffectiveName(
  key: string,
  builtinName: string,
  overrides: CliOverrides
): string {
  return overrides[key]?.name?.trim() || builtinName;
}

export function getEffectiveIcon(
  key: string,
  overrides: CliOverrides
): { emoji?: string; dataUrl?: string } | null {
  const dataUrl = overrides[key]?.iconDataUrl?.trim();
  const emoji = overrides[key]?.iconEmoji?.trim();
  if (!emoji && !dataUrl) return null;
  return {
    emoji: emoji || undefined,
    dataUrl: dataUrl || undefined,
  };
}
