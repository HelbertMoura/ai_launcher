// ==============================================================================
// AI Launcher Pro - CLI/IDE Overrides (v7.1)
// Per-key override for built-in CLI + IDE display name and icon.
// Storage is separated from custom CLIs — built-ins are merged on top of
// their hardcoded definitions at render time. Empty override entries are
// removed from storage to avoid stub keys accumulating.
// ==============================================================================

export interface CliOverride {
  name?: string;
  iconEmoji?: string;
}

export type CliOverrides = Record<string, CliOverride>;

const CLI_STORAGE_KEY = 'ai-launcher:cli-overrides';
const IDE_STORAGE_KEY = 'ai-launcher:ide-overrides';

// Same-tab sync bus — mirrors the pattern used by customClis/customIdes.
export const CLI_OVERRIDES_CHANGED_EVENT = 'ai-launcher:cli-overrides-changed';
export const IDE_OVERRIDES_CHANGED_EVENT = 'ai-launcher:ide-overrides-changed';

function loadFrom(key: string): CliOverrides {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    // Shallow shape-check: keep only plain object entries with name/iconEmoji strings.
    const result: CliOverrides = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v !== 'object' || v === null) continue;
      const item = v as Record<string, unknown>;
      const entry: CliOverride = {};
      if (typeof item.name === 'string') entry.name = item.name;
      if (typeof item.iconEmoji === 'string') entry.iconEmoji = item.iconEmoji;
      if (entry.name || entry.iconEmoji) result[k] = entry;
    }
    return result;
  } catch {
    return {};
  }
}

function saveTo(key: string, overrides: CliOverrides, eventName: string): void {
  try {
    localStorage.setItem(key, JSON.stringify(overrides));
    try {
      window.dispatchEvent(new CustomEvent(eventName, { detail: overrides }));
    } catch {
      /* ignore */
    }
  } catch (e) {
    console.error(`[overrides:${key}] save failed`, e);
  }
}

export const loadCliOverrides = (): CliOverrides => loadFrom(CLI_STORAGE_KEY);
export const loadIdeOverrides = (): CliOverrides => loadFrom(IDE_STORAGE_KEY);

export const saveCliOverrides = (o: CliOverrides): void =>
  saveTo(CLI_STORAGE_KEY, o, CLI_OVERRIDES_CHANGED_EVENT);
export const saveIdeOverrides = (o: CliOverrides): void =>
  saveTo(IDE_STORAGE_KEY, o, IDE_OVERRIDES_CHANGED_EVENT);

export function setCliOverride(
  all: CliOverrides,
  key: string,
  override: CliOverride
): CliOverrides {
  const cleaned: CliOverride = {
    name: override.name?.trim() || undefined,
    iconEmoji: override.iconEmoji?.trim() || undefined,
  };
  if (!cleaned.name && !cleaned.iconEmoji) {
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
): string | null {
  const emoji = overrides[key]?.iconEmoji?.trim();
  return emoji ? emoji : null;
}
