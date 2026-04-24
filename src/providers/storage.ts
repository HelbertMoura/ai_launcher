// ==============================================================================
// AI Launcher Pro - Providers (storage)
// Persiste em localStorage sob a chave 'ai-launcher-providers' (separado do
// config principal pra facilitar export/import e reset isolado).
//
// API keys are stored via the secure secrets interface (DPAPI on Windows)
// when available. The provider JSON in localStorage contains only a marker
// (__secret__) instead of the actual key.
// Falls back to inline keys in localStorage when secure storage is unavailable.
// ==============================================================================

import type { ProviderProfile, ProvidersState } from './types';
import { DEFAULT_ACTIVE_ID, DEFAULT_PROFILES, SECRET_KEY_MARKER } from './seeds';

// Re-export for convenience
export { SECRET_KEY_MARKER } from './seeds';

import {
  storeSecret,
  getSecret,
  deleteSecret as deleteSecretEntry,
  hasSecureStorage,
  migrateFromLocalStorage,
} from '../lib/secrets';

const STORAGE_KEY = 'ai-launcher-providers';
const LEGACY_SECRET_PREFIX = 'ai-launcher-secret:provider-apikey:';

function secretKeyForProvider(providerId: string): string {
  return `provider-apikey:${providerId}`;
}

function cloneSeed(): ProviderProfile[] {
  return DEFAULT_PROFILES.map(p => ({ ...p, extraEnv: { ...(p.extraEnv || {}) } }));
}

function ensureBuiltins(profiles: ProviderProfile[]): ProviderProfile[] {
  const byId = new Map(profiles.map(p => [p.id, p]));
  for (const seed of DEFAULT_PROFILES) {
    if (!byId.has(seed.id)) {
      byId.set(seed.id, { ...seed, extraEnv: { ...(seed.extraEnv || {}) } });
    } else {
      const existing = byId.get(seed.id)!;
      // Merge protocol/knownModels from seed into existing profile if missing.
      const protocol = existing.protocol ?? seed.protocol;
      const knownModels = existing.knownModels ?? seed.knownModels;
      byId.set(seed.id, { ...existing, builtin: true, protocol, knownModels });
    }
  }
  return Array.from(byId.values());
}

export function loadProviders(): ProvidersState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { profiles: cloneSeed(), activeId: DEFAULT_ACTIVE_ID };
    const parsed = JSON.parse(raw) as Partial<ProvidersState>;
    const profiles = ensureBuiltins(Array.isArray(parsed.profiles) ? parsed.profiles : []);
    const activeId = profiles.find(p => p.id === parsed.activeId) ? parsed.activeId! : DEFAULT_ACTIVE_ID;
    return {
      profiles,
      activeId,
      overrideMainModel: parsed.overrideMainModel,
      overrideFastModel: parsed.overrideFastModel,
    };
  } catch {
    return { profiles: cloneSeed(), activeId: DEFAULT_ACTIVE_ID };
  }
}

/**
 * Save providers state synchronously.
 * API keys are stored inline in localStorage for backward compatibility.
 * Call `migrateApiKeysToSecureStorage()` to move them to secure storage.
 */
export function saveProviders(state: ProvidersState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('[providers] falha ao salvar', e);
  }
}

/**
 * Save providers and move API keys to secure storage (async).
 * Call this from UI save handlers when possible.
 */
export async function saveProvidersSecure(state: ProvidersState): Promise<boolean> {
  const secure = await hasSecureStorage();
  if (!secure) {
    saveProviders(state);
    return false;
  }

  try {
    // Store each API key in secure storage, replace with marker in JSON.
    const sanitizedProfiles = await Promise.all(
      state.profiles.map(async (profile) => {
        if (profile.apiKey && profile.apiKey !== SECRET_KEY_MARKER) {
          const key = secretKeyForProvider(profile.id);
          await storeSecret(key, profile.apiKey);
          return { ...profile, apiKey: SECRET_KEY_MARKER };
        }
        return profile;
      }),
    );
    const sanitizedState = { ...state, profiles: sanitizedProfiles };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizedState));
    return true;
  } catch {
    // Fallback to regular save
    saveProviders(state);
    return false;
  }
}

/**
 * Load a provider's API key from secure storage.
 * Falls back to the inline key if secure storage is unavailable.
 */
export async function loadProviderApiKey(providerId: string, inlineKey?: string): Promise<string> {
  // Try secure storage first
  const key = secretKeyForProvider(providerId);
  const secret = await getSecret(key);
  if (secret) return secret;

  // Check legacy localStorage fallback
  const legacy = localStorage.getItem(`${LEGACY_SECRET_PREFIX}${providerId}`);
  if (legacy) return legacy;

  // Return inline key if present (pre-migration or fallback mode)
  if (inlineKey && inlineKey !== SECRET_KEY_MARKER) return inlineKey;
  return '';
}

/**
 * Resolve all API keys in a ProvidersState from secure storage.
 * Use before building launch env or testing connections.
 */
export async function resolveApiKeys(state: ProvidersState): Promise<ProvidersState> {
  const resolved = await Promise.all(
    state.profiles.map(async (profile) => {
      if (profile.apiKey === SECRET_KEY_MARKER || !profile.apiKey) {
        const resolvedKey = await loadProviderApiKey(profile.id, profile.apiKey);
        return { ...profile, apiKey: resolvedKey };
      }
      return profile;
    }),
  );
  return { ...state, profiles: resolved };
}

/**
 * Delete a provider's API key from secure storage.
 */
export async function deleteProviderApiKey(providerId: string): Promise<void> {
  const key = secretKeyForProvider(providerId);
  await deleteSecretEntry(key);
  localStorage.removeItem(`${LEGACY_SECRET_PREFIX}${providerId}`);
}

export function upsertProfile(state: ProvidersState, profile: ProviderProfile): ProvidersState {
  const idx = state.profiles.findIndex(p => p.id === profile.id);
  const next = [...state.profiles];
  if (idx >= 0) next[idx] = profile;
  else next.push(profile);
  return { ...state, profiles: next };
}

export function removeProfile(state: ProvidersState, id: string): ProvidersState {
  const target = state.profiles.find(p => p.id === id);
  if (!target || target.builtin) return state;
  const profiles = state.profiles.filter(p => p.id !== id);
  const activeId = state.activeId === id ? DEFAULT_ACTIVE_ID : state.activeId;
  return { ...state, profiles, activeId };
}

export function setActive(state: ProvidersState, id: string): ProvidersState {
  return state.profiles.some(p => p.id === id) ? { ...state, activeId: id } : state;
}

export function resetProviders(): ProvidersState {
  localStorage.removeItem(STORAGE_KEY);
  return loadProviders();
}

/**
 * Constroi o HashMap<String,String> de env vars que vai para `launch_cli`.
 * Versao sync — usa apenas as keys inline no state (sem resolver do secure storage).
 * Use `buildLaunchEnvAsync` quando precisar resolver keys do secure storage.
 */
export function buildLaunchEnv(state: ProvidersState): Record<string, string> | undefined {
  return buildLaunchEnvFromState(state);
}

/**
 * Async version of buildLaunchEnv that resolves API keys from secure storage.
 * Use this before launching CLIs to ensure the actual key is injected.
 */
export async function buildLaunchEnvAsync(state: ProvidersState): Promise<Record<string, string> | undefined> {
  const resolved = await resolveApiKeys(state);
  return buildLaunchEnvFromState(resolved);
}

/**
 * Internal: builds launch env from a state where apiKey is expected to be resolved.
 */
function buildLaunchEnvFromState(state: ProvidersState): Record<string, string> | undefined {
  const profile = state.profiles.find(p => p.id === state.activeId);
  if (!profile) return undefined;
  if (profile.kind === 'anthropic' && !profile.baseUrl && !profile.apiKey) {
    // perfil oficial sem override — nao injeta nada.
    return undefined;
  }
  const env: Record<string, string> = {};
  if (profile.baseUrl) env.ANTHROPIC_BASE_URL = profile.baseUrl;
  // Anthropic-compatible providers aceitam APENAS UM dos dois — setar ambos
  // gera `Auth conflict` no Claude Code. Usamos AUTH_TOKEN (padrao da spec MiniMax/Z.AI).
  if (profile.apiKey && profile.apiKey !== SECRET_KEY_MARKER) {
    env.ANTHROPIC_AUTH_TOKEN = profile.apiKey;
  }
  const main = state.overrideMainModel || profile.mainModel;
  const fast = state.overrideFastModel || profile.fastModel;
  if (main) env.ANTHROPIC_MODEL = main;
  if (fast) env.ANTHROPIC_SMALL_FAST_MODEL = fast;

  // Envs recomendados pela doc oficial para providers Anthropic-compatible
  // (https://platform.minimax.io/docs/token-plan/claude-code). Sem eles,
  // Claude Code tenta resolver sonnet/opus/haiku em endpoints que nao existem.
  if (profile.kind !== 'anthropic' && main) {
    const haiku = fast || main;
    env.ANTHROPIC_DEFAULT_SONNET_MODEL = main;
    env.ANTHROPIC_DEFAULT_OPUS_MODEL = main;
    env.ANTHROPIC_DEFAULT_HAIKU_MODEL = haiku;
    env.API_TIMEOUT_MS = '3000000';
    env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = '1';
  }

  // extraEnv do perfil pode sobrescrever tudo acima (escape hatch do usuario).
  if (profile.extraEnv) {
    for (const [k, v] of Object.entries(profile.extraEnv)) {
      if (k && v) env[k] = v;
    }
  }
  return Object.keys(env).length > 0 ? env : undefined;
}

/** Versao redacted das envs pra log/toast (sem vazar chave). */
export function redactEnv(env: Record<string, string> | undefined): Record<string, string> {
  if (!env) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    if (/KEY|TOKEN|SECRET/i.test(k)) {
      out[k] = v.length > 8 ? `${v.slice(0, 4)}…${v.slice(-4)}` : '****';
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Export profiles with API keys REDACTED.
 * Keys are NEVER exported in clear text.
 */
export function exportProfiles(state: ProvidersState): string {
  const redacted = {
    version: 1,
    ...state,
    profiles: state.profiles.map((p) => ({
      ...p,
      apiKey: '',
      _apiKeyRedacted: true,
    })),
  };
  return JSON.stringify(redacted, null, 2);
}

export function importProfiles(raw: string): ProvidersState {
  const parsed = JSON.parse(raw) as Partial<ProvidersState> & { version?: number };
  if (!parsed.profiles || !Array.isArray(parsed.profiles)) {
    throw new Error('JSON invalido: campo "profiles" ausente ou nao e array.');
  }
  // Strip _apiKeyRedacted marker from imported data.
  const profiles = ensureBuiltins(
    parsed.profiles.map((p) => {
      const obj = p as unknown as Record<string, unknown>;
      const { _apiKeyRedacted: _, ...clean } = obj;
      void _;
      return clean as unknown as ProviderProfile;
    }),
  );
  const activeId = profiles.find(p => p.id === parsed.activeId) ? parsed.activeId! : DEFAULT_ACTIVE_ID;
  const next: ProvidersState = { profiles, activeId };
  saveProviders(next);
  return next;
}

/**
 * Run one-time migration of API keys from localStorage to secure storage.
 * Should be called early in app startup.
 * Returns the number of keys migrated.
 */
export async function migrateApiKeysToSecureStorage(): Promise<number> {
  const secure = await hasSecureStorage();
  if (!secure) return 0;

  const state = loadProviders();
  let migrated = 0;

  // Also check for legacy localStorage fallback keys
  const keys: string[] = [];
  for (const profile of state.profiles) {
    keys.push(secretKeyForProvider(profile.id));
  }
  migrated += await migrateFromLocalStorage(keys);

  // Migrate inline API keys from provider JSON to secrets
  for (const profile of state.profiles) {
    if (profile.apiKey && profile.apiKey !== SECRET_KEY_MARKER) {
      const sk = secretKeyForProvider(profile.id);
      await storeSecret(sk, profile.apiKey);
      migrated++;
    }
  }

  // Re-save with markers if any keys were moved
  if (migrated > 0) {
    const sanitizedProfiles = state.profiles.map((p) =>
      p.apiKey && p.apiKey !== SECRET_KEY_MARKER
        ? { ...p, apiKey: SECRET_KEY_MARKER }
        : p,
    );
    saveProviders({ ...state, profiles: sanitizedProfiles });
  }

  return migrated;
}
