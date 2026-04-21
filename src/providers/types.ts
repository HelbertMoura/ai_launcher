// ==============================================================================
// AI Launcher Pro - Providers (tipos)
// Mapa de "perfis" de provider Anthropic-compatible (Anthropic oficial, Z.AI,
// MiniMax, etc.) que injetam env vars no launch do Claude Code.
// ==============================================================================

export type ProviderKind = 'anthropic' | 'zai' | 'minimax' | 'custom';

export interface ProviderProfile {
  /** ID estável (slug). Ex: "anthropic", "zai", "zai-test". */
  id: string;
  /** Nome exibido na UI. */
  name: string;
  /** Tipo/fabricante — controla ícone, badge e aviso de context cap. */
  kind: ProviderKind;
  /** ANTHROPIC_BASE_URL. Vazio = não injeta (usa default oficial). */
  baseUrl: string;
  /** ANTHROPIC_AUTH_TOKEN (ou ANTHROPIC_API_KEY). Plain text local. */
  apiKey: string;
  /** Modelo principal (vira opus/sonnet via ANTHROPIC_MODEL). */
  mainModel: string;
  /** Modelo fast/small (vira haiku via ANTHROPIC_SMALL_FAST_MODEL). */
  fastModel: string;
  /** Janela de contexto efetiva (tokens). Usado pra mostrar aviso. */
  contextWindow: number;
  /** Envs extras arbitrárias por perfil (Fase 4). */
  extraEnv?: Record<string, string>;
  /** Preço input/output por 1M tokens em USD. Usado no estimador. */
  priceInPerM?: number;
  priceOutPerM?: number;
  /** Limite diário de gasto em USD. 0/undefined = sem limite. */
  dailyBudget?: number;
  /** Built-in (seed). Não pode ser excluído, só editado. */
  builtin?: boolean;
  /** Observação livre mostrada no Admin. */
  note?: string;
}

export interface ProvidersState {
  profiles: ProviderProfile[];
  /** ID do provider ativo pro Claude. 'anthropic' por padrão. */
  activeId: string;
  /** Override de modelo main/fast pra próxima execução (Fase 4). */
  overrideMainModel?: string;
  overrideFastModel?: string;
}

/** Resultado de `testProviderConnection`. */
export interface ProviderTestResult {
  ok: boolean;
  statusCode?: number;
  latencyMs?: number;
  message: string;
  modelEcho?: string;
}

/** Entrada de histórico enriquecida com info do provider usado. */
export interface LaunchProviderInfo {
  providerId: string;
  providerName: string;
  providerKind: ProviderKind;
  mainModel: string;
  fastModel: string;
}

/**
 * Gate admin mode. Precedência:
 *   1. Build-time flag `VITE_ADMIN_MODE=1` (sempre vence — admin-full build)
 *   2. URL query `?admin=1` (liga) / `?admin=0` (desliga) — persistido
 *   3. localStorage `ai-launcher:admin-mode` === '1'
 *   4. Default: false
 */
export const ADMIN_STORAGE_KEY = 'ai-launcher:admin-mode';

function readUrlAdminFlag(): '1' | '0' | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const v = params.get('admin');
    if (v === '1' || v === '0') return v;
  } catch { /* ignore */ }
  return null;
}

export function isAdminMode(): boolean {
  if (import.meta.env.VITE_ADMIN_MODE === '1') return true;
  const url = readUrlAdminFlag();
  if (url !== null) {
    try { localStorage.setItem(ADMIN_STORAGE_KEY, url); } catch { /* ignore */ }
    return url === '1';
  }
  try {
    return localStorage.getItem(ADMIN_STORAGE_KEY) === '1';
  } catch { /* ignore */ }
  return false;
}

export function setAdminMode(enabled: boolean): void {
  try { localStorage.setItem(ADMIN_STORAGE_KEY, enabled ? '1' : '0'); } catch { /* ignore */ }
}

export function toggleAdminMode(): boolean {
  const next = !isAdminMode();
  setAdminMode(next);
  return next;
}
