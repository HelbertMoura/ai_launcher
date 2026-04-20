// ==============================================================================
// AI Launcher Pro - Providers (storage)
// Persiste em localStorage sob a chave 'ai-launcher-providers' (separado do
// config principal pra facilitar export/import e reset isolado).
// ==============================================================================

import type { ProviderProfile, ProvidersState } from './types';
import { DEFAULT_ACTIVE_ID, DEFAULT_PROFILES } from './seeds';

const STORAGE_KEY = 'ai-launcher-providers';

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
      byId.set(seed.id, { ...existing, builtin: true });
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

export function saveProviders(state: ProvidersState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('[providers] falha ao salvar', e);
  }
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
 * Constrói o HashMap<String,String> de env vars que vai para `launch_cli`.
 * Retorna `undefined` quando é Anthropic padrão (sem injeção).
 */
export function buildLaunchEnv(state: ProvidersState): Record<string, string> | undefined {
  const profile = state.profiles.find(p => p.id === state.activeId);
  if (!profile) return undefined;
  if (profile.kind === 'anthropic' && !profile.baseUrl && !profile.apiKey) {
    // perfil oficial sem override — não injeta nada.
    return undefined;
  }
  const env: Record<string, string> = {};
  if (profile.baseUrl) env.ANTHROPIC_BASE_URL = profile.baseUrl;
  // Anthropic-compatible providers aceitam APENAS UM dos dois — setar ambos
  // gera `Auth conflict` no Claude Code. Usamos AUTH_TOKEN (padrão da spec MiniMax/Z.AI).
  if (profile.apiKey) {
    env.ANTHROPIC_AUTH_TOKEN = profile.apiKey;
  }
  const main = state.overrideMainModel || profile.mainModel;
  const fast = state.overrideFastModel || profile.fastModel;
  if (main) env.ANTHROPIC_MODEL = main;
  if (fast) env.ANTHROPIC_SMALL_FAST_MODEL = fast;

  // Envs recomendados pela doc oficial para providers Anthropic-compatible
  // (https://platform.minimax.io/docs/token-plan/claude-code). Sem eles,
  // Claude Code tenta resolver sonnet/opus/haiku em endpoints que não existem.
  if (profile.kind !== 'anthropic' && main) {
    const haiku = fast || main;
    env.ANTHROPIC_DEFAULT_SONNET_MODEL = main;
    env.ANTHROPIC_DEFAULT_OPUS_MODEL = main;
    env.ANTHROPIC_DEFAULT_HAIKU_MODEL = haiku;
    env.API_TIMEOUT_MS = '3000000';
    env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = '1';
  }

  // extraEnv do perfil pode sobrescrever tudo acima (escape hatch do usuário).
  if (profile.extraEnv) {
    for (const [k, v] of Object.entries(profile.extraEnv)) {
      if (k && v) env[k] = v;
    }
  }
  return Object.keys(env).length > 0 ? env : undefined;
}

/** Versão redacted das envs pra log/toast (sem vazar chave). */
export function redactEnv(env: Record<string, string> | undefined): Record<string, string> {
  if (!env) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    if (/KEY|TOKEN|SECRET/i.test(k)) {
      out[k] = v.length > 8 ? `${v.slice(0, 4)}…${v.slice(-4)}` : '••••';
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function exportProfiles(state: ProvidersState): string {
  // Export inclui chaves — é "backup privado". Usuário assume risco ao salvar.
  return JSON.stringify({ version: 1, ...state }, null, 2);
}

export function importProfiles(raw: string): ProvidersState {
  const parsed = JSON.parse(raw) as Partial<ProvidersState> & { version?: number };
  if (!parsed.profiles || !Array.isArray(parsed.profiles)) {
    throw new Error('JSON inválido: campo "profiles" ausente ou não é array.');
  }
  const profiles = ensureBuiltins(parsed.profiles);
  const activeId = profiles.find(p => p.id === parsed.activeId) ? parsed.activeId! : DEFAULT_ACTIVE_ID;
  const next: ProvidersState = { profiles, activeId };
  saveProviders(next);
  return next;
}
