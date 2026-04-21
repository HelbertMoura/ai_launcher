// ==============================================================================
// AI Launcher Pro - Config IO
// Export/import da config em JSON, com redaction de secrets (apiKey + extraEnv
// cujas chaves batam com /token|key|secret|bearer|password/i).
//
// Chaves de localStorage reais (verificadas em src/):
//   - ai-launcher-providers    (providers/storage.ts STORAGE_KEY)
//   - ai-launcher-presets      (presets/storage.ts STORAGE_KEY)
//   - ai-launcher-config       (App.tsx: theme, hideWelcome, directory, etc.)
//   - ai-launcher:display-font (AppearanceSection.tsx FONT_STORAGE_KEY)
// ==============================================================================

const PROVIDERS_KEY = 'ai-launcher-providers';
const PRESETS_KEY = 'ai-launcher-presets';
const CONFIG_KEY = 'ai-launcher-config';
const FONT_KEY = 'ai-launcher:display-font';

const REDACTED = '{{REDACTED}}';
const SECRET_RE = /token|key|secret|bearer|password/i;

interface ConfigDump {
  version: string;
  exportedAt: string;
  providers: Record<string, unknown>;
  presets: unknown;
  config: Record<string, unknown>;
  settings: Record<string, unknown>;
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function redactEnv(env: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(env)) {
    out[k] = SECRET_RE.test(k) ? REDACTED : v;
  }
  return out;
}

function redactProviderProfile(p: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = { ...p };
  if (typeof redacted.apiKey === 'string' && redacted.apiKey.length > 0) {
    redacted.apiKey = REDACTED;
  }
  if (redacted.extraEnv && typeof redacted.extraEnv === 'object') {
    redacted.extraEnv = redactEnv(redacted.extraEnv as Record<string, unknown>);
  }
  return redacted;
}

function redactProvidersState(state: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...state };
  if (Array.isArray(next.profiles)) {
    next.profiles = (next.profiles as Array<Record<string, unknown>>).map(redactProviderProfile);
  }
  return next;
}

export function exportConfig(appVersion: string): string {
  const providersRaw = safeParse<Record<string, unknown>>(
    localStorage.getItem(PROVIDERS_KEY),
    {},
  );
  const presets = safeParse<unknown>(localStorage.getItem(PRESETS_KEY), []);
  const mainConfig = safeParse<Record<string, unknown>>(
    localStorage.getItem(CONFIG_KEY),
    {},
  );

  const settings: Record<string, unknown> = {
    displayFont: localStorage.getItem(FONT_KEY),
  };

  const dump: ConfigDump = {
    version: appVersion,
    exportedAt: new Date().toISOString(),
    providers: redactProvidersState(providersRaw),
    presets,
    config: mainConfig,
    settings,
  };
  return JSON.stringify(dump, null, 2);
}

export type ImportResult =
  | { ok: true; redactedCount: number }
  | { ok: false; error: string };

function countRedacted(providers: unknown): number {
  if (!providers || typeof providers !== 'object') return 0;
  const profiles = (providers as Record<string, unknown>).profiles;
  if (!Array.isArray(profiles)) return 0;
  let count = 0;
  for (const raw of profiles) {
    if (!raw || typeof raw !== 'object') continue;
    const p = raw as Record<string, unknown>;
    if (p.apiKey === REDACTED) count++;
    if (p.extraEnv && typeof p.extraEnv === 'object') {
      for (const v of Object.values(p.extraEnv as Record<string, unknown>)) {
        if (v === REDACTED) count++;
      }
    }
  }
  return count;
}

export function importConfig(raw: string, mode: 'merge' | 'replace'): ImportResult {
  let dump: ConfigDump;
  try {
    dump = JSON.parse(raw) as ConfigDump;
  } catch {
    return { ok: false, error: 'Arquivo nao e JSON valido.' };
  }
  if (!dump.version || !dump.providers || typeof dump.providers !== 'object') {
    return { ok: false, error: 'Formato de config desconhecido.' };
  }

  const redactedCount = countRedacted(dump.providers);

  if (mode === 'replace') {
    localStorage.setItem(PROVIDERS_KEY, JSON.stringify(dump.providers));
    if (dump.presets !== undefined) {
      localStorage.setItem(PRESETS_KEY, JSON.stringify(dump.presets));
    }
  } else {
    const existingProviders = safeParse<Record<string, unknown>>(
      localStorage.getItem(PROVIDERS_KEY),
      {},
    );
    const existingProfiles = Array.isArray(existingProviders.profiles)
      ? (existingProviders.profiles as Array<Record<string, unknown>>)
      : [];
    const incomingProfiles = Array.isArray(
      (dump.providers as Record<string, unknown>).profiles,
    )
      ? ((dump.providers as Record<string, unknown>).profiles as Array<
          Record<string, unknown>
        >)
      : [];
    const byId = new Map<string, Record<string, unknown>>();
    for (const p of existingProfiles) {
      const id = typeof p.id === 'string' ? p.id : '';
      if (id) byId.set(id, p);
    }
    for (const p of incomingProfiles) {
      const id = typeof p.id === 'string' ? p.id : '';
      if (!id) continue;
      const prev = byId.get(id) ?? {};
      // preserva apiKey existente se a importacao trouxe REDACTED
      const merged: Record<string, unknown> = { ...prev, ...p };
      if (p.apiKey === REDACTED && typeof prev.apiKey === 'string') {
        merged.apiKey = prev.apiKey;
      }
      byId.set(id, merged);
    }
    const mergedState = {
      ...existingProviders,
      ...(dump.providers as Record<string, unknown>),
      profiles: Array.from(byId.values()),
    };
    localStorage.setItem(PROVIDERS_KEY, JSON.stringify(mergedState));

    if (Array.isArray(dump.presets)) {
      const existingPresets = safeParse<unknown[]>(
        localStorage.getItem(PRESETS_KEY),
        [],
      );
      const base = Array.isArray(existingPresets) ? existingPresets : [];
      localStorage.setItem(
        PRESETS_KEY,
        JSON.stringify([...base, ...(dump.presets as unknown[])]),
      );
    }
  }

  if (dump.config && typeof dump.config === 'object') {
    const existingConfig = safeParse<Record<string, unknown>>(
      localStorage.getItem(CONFIG_KEY),
      {},
    );
    const nextConfig =
      mode === 'replace'
        ? dump.config
        : { ...existingConfig, ...(dump.config as Record<string, unknown>) };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(nextConfig));
  }

  const s = dump.settings ?? {};
  if (typeof s.displayFont === 'string') {
    localStorage.setItem(FONT_KEY, s.displayFont);
  }

  return { ok: true, redactedCount };
}

export function downloadConfigJson(appVersion: string): void {
  const json = exportConfig(appVersion);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ai-launcher-config-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
