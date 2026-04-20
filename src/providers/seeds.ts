// ==============================================================================
// AI Launcher Pro - Providers (seeds built-in)
// Pré-cadastra Anthropic oficial, Z.AI e MiniMax. Usuário pode editar.
// ==============================================================================

import type { ProviderProfile } from './types';

const zaiKeySeed = (import.meta.env.VITE_ZAI_API_KEY as string | undefined) || '';
const mmKeySeed = (import.meta.env.VITE_MINIMAX_API_KEY as string | undefined) || '';

export const DEFAULT_PROFILES: ProviderProfile[] = [
  {
    id: 'anthropic',
    name: 'Anthropic (oficial)',
    kind: 'anthropic',
    baseUrl: '',
    apiKey: '',
    mainModel: 'claude-opus-4-7',
    fastModel: 'claude-haiku-4-5',
    contextWindow: 1_000_000,
    priceInPerM: 15.0,
    priceOutPerM: 75.0,
    builtin: true,
    note: 'API oficial Anthropic. Não injeta env vars — usa a config padrão do seu Claude Code.',
  },
  {
    id: 'zai',
    name: 'Z.AI (GLM)',
    kind: 'zai',
    baseUrl: 'https://api.z.ai/api/anthropic',
    apiKey: zaiKeySeed,
    mainModel: 'glm-5.1',
    fastModel: 'glm-4.7',
    contextWindow: 200_000,
    priceInPerM: 0.6,
    priceOutPerM: 2.2,
    builtin: true,
    note: 'Z.AI mapeia "opus/sonnet" → glm-5.1 e "haiku" → glm-4.7. Context cap: 200k.',
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    kind: 'minimax',
    baseUrl: 'https://api.minimaxi.chat/v1/anthropic',
    apiKey: mmKeySeed,
    mainModel: 'MiniMax-M2',
    fastModel: 'MiniMax-M2',
    contextWindow: 200_000,
    priceInPerM: 0.3,
    priceOutPerM: 1.2,
    builtin: true,
    note: 'MiniMax com endpoint Anthropic-compatible. Ajuste o modelo conforme seu plano.',
  },
];

export const DEFAULT_ACTIVE_ID = 'anthropic';
