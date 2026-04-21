// ==============================================================================
// AI Launcher Pro - App Settings (v7.0 Preferences)
// Persists three user-tunable preferences in localStorage:
//   - maxHistory      (default 50)  — max entries kept in launch history
//   - refreshInterval (default 0)   — seconds; 0 = manual-only CLI refresh
//   - commandTimeout  (default 30)  — seconds; reserved for v7.1 Tauri wiring
// ==============================================================================

export interface AppSettings {
  maxHistory: number;
  refreshInterval: number;   // seconds; 0 = manual
  commandTimeout: number;    // seconds; reserved for v7.1 wiring
}

export const DEFAULT_SETTINGS: AppSettings = {
  maxHistory: 50,
  refreshInterval: 0,
  commandTimeout: 30,
};

const STORAGE_KEY = 'ai-launcher:app-settings';

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
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveAppSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
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
  return { ...DEFAULT_SETTINGS };
}
