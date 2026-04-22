// ==============================================================================
// AI Launcher Pro - App Settings (v7.0 Preferences)
// Persists three user-tunable preferences in localStorage:
//   - maxHistory      (default 50)  — max entries kept in launch history
//   - refreshInterval (default 0)   — seconds; 0 = manual-only CLI refresh
//   - commandTimeout  (default 30)  — seconds; reserved for v7.1 Tauri wiring
// ==============================================================================

import { DEFAULT_ACCENT_PRESET, isAccentPresetId, type AccentPresetId } from './appearance';

export interface AppSettings {
  maxHistory: number;
  refreshInterval: number;   // seconds; 0 = manual
  commandTimeout: number;    // seconds; reserved for v7.1 wiring
  accentPreset: AccentPresetId;
}

export const DEFAULT_SETTINGS: AppSettings = {
  maxHistory: 50,
  refreshInterval: 0,
  commandTimeout: 30,
  accentPreset: DEFAULT_ACCENT_PRESET,
};

const STORAGE_KEY = 'ai-launcher:app-settings';

// Custom DOM event for same-tab sync. The native `storage` event only fires in
// OTHER tabs, so changes made inside the same window (e.g. AdminPanel saving
// preferences) require this bus for live updates.
export const SETTINGS_CHANGED_EVENT = 'ai-launcher:settings-changed';

export function loadAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      maxHistory:
        typeof parsed.maxHistory === 'number' && parsed.maxHistory > 0
          ? Math.floor(parsed.maxHistory)
          : DEFAULT_SETTINGS.maxHistory,
      refreshInterval:
        typeof parsed.refreshInterval === 'number' && parsed.refreshInterval >= 0
          ? Math.floor(parsed.refreshInterval)
          : DEFAULT_SETTINGS.refreshInterval,
      commandTimeout:
        typeof parsed.commandTimeout === 'number' && parsed.commandTimeout > 0
          ? Math.floor(parsed.commandTimeout)
          : DEFAULT_SETTINGS.commandTimeout,
      accentPreset: isAccentPresetId(parsed.accentPreset)
        ? parsed.accentPreset
        : DEFAULT_SETTINGS.accentPreset,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveAppSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    try {
      window.dispatchEvent(new CustomEvent(SETTINGS_CHANGED_EVENT, { detail: settings }));
    } catch {
      /* ignore — non-DOM environments (SSR/tests) */
    }
  } catch (e) {
    console.error('[settings]', e);
  }
}

export function resetAppSettings(): AppSettings {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  const defaults: AppSettings = { ...DEFAULT_SETTINGS };
  try {
    window.dispatchEvent(new CustomEvent(SETTINGS_CHANGED_EVENT, { detail: defaults }));
  } catch {
    /* ignore */
  }
  return defaults;
}
