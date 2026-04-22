// ==============================================================================
// AI Launcher Pro - Providers (tipos)
// Mapa de "perfis" de provider Anthropic-compatible (Anthropic oficial, Z.AI,
// MiniMax, etc.) que injetam env vars no launch do Claude Code.
// ==============================================================================

export type ProviderKind = 'anthropic' | 'zai' | 'minimax' | 'moonshot' | 'qwen' | 'openrouter' | 'custom';

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
 * Admin mode is now always ON — no user split.
 * ADMIN_STORAGE_KEY is retained as a no-op for backward migration only.
 */
export const ADMIN_STORAGE_KEY = 'ai-launcher:admin-mode';
