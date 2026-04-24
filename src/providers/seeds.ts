// ==============================================================================
// AI Launcher Pro - Providers (seeds built-in)
// Pre-cadastra Anthropic oficial, Z.AI e MiniMax. Usuario pode editar.
//
// API keys are NO LONGER seeded from VITE_* env vars for security reasons.
// Users must configure keys through the UI, which stores them securely
// via the secrets interface (DPAPI on Windows).
// ==============================================================================

import type { ProviderProfile } from './types';

/** Marker indicating the API key is stored in secure secrets. */
export const SECRET_KEY_MARKER = '__secret__';

/** Default protocol for each ProviderKind. */
export const KIND_DEFAULT_PROTOCOL: Record<string, ProviderProfile['protocol']> = {
  anthropic: 'anthropic_messages',
  zai: 'anthropic_messages',
  minimax: 'anthropic_messages',
  moonshot: 'anthropic_messages',
  qwen: 'anthropic_messages',
  openrouter: 'openai_chat',
  custom: 'custom',
};

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
    note: 'API oficial Anthropic. Nao injeta env vars — usa a config padrao do seu Claude Code.',
    protocol: 'anthropic_messages',
    knownModels: ['claude-opus-4-7', 'claude-sonnet-4-5', 'claude-haiku-4-5'],
  },
  {
    id: 'zai',
    name: 'Z.AI (GLM)',
    kind: 'zai',
    baseUrl: 'https://api.z.ai/api/anthropic',
    apiKey: '',
    mainModel: 'glm-5.1',
    fastModel: 'glm-4.7',
    contextWindow: 200_000,
    priceInPerM: 0.6,
    priceOutPerM: 2.2,
    builtin: true,
    note: 'Z.AI mapeia "opus/sonnet" → glm-5.1 e "haiku" → glm-4.7. Context cap: 200k.',
    protocol: 'anthropic_messages',
    knownModels: ['glm-5.1', 'glm-4.7'],
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    kind: 'minimax',
    baseUrl: 'https://api.minimax.io/anthropic',
    apiKey: '',
    mainModel: 'MiniMax-M2.7',
    fastModel: 'MiniMax-M2.7',
    contextWindow: 200_000,
    priceInPerM: 0.3,
    priceOutPerM: 1.2,
    builtin: true,
    note: 'Endpoint Anthropic-compatible (internacional). China: troque para https://api.minimaxi.com/anthropic. Modelo conforme doc oficial: https://platform.minimax.io/docs/token-plan/claude-code',
    protocol: 'anthropic_messages',
    knownModels: ['MiniMax-M2.7'],
  },
  {
    id: 'moonshot',
    name: 'Moonshot / Kimi (oficial)',
    kind: 'moonshot',
    baseUrl: 'https://api.moonshot.ai/anthropic',
    apiKey: '',
    mainModel: 'kimi-k2-0905-preview',
    fastModel: 'kimi-k2-turbo-preview',
    contextWindow: 256_000,
    priceInPerM: 0.60,
    priceOutPerM: 2.50,
    builtin: true,
    note: 'Endpoint Anthropic-compatible oficial. China: troque para https://api.moonshot.cn/anthropic. Plano "Kimi for Code" disponivel. Docs: https://platform.moonshot.ai/docs/guide/anthropic-api',
    protocol: 'anthropic_messages',
    knownModels: ['kimi-k2-0905-preview', 'kimi-k2-turbo-preview'],
  },
  {
    id: 'qwen',
    name: 'Qwen / DashScope (Alibaba)',
    kind: 'qwen',
    baseUrl: 'https://dashscope-intl.aliyuncs.com/api/v2/apps/claude-code',
    apiKey: '',
    mainModel: 'qwen3-coder-plus',
    fastModel: 'qwen-plus',
    contextWindow: 256_000,
    priceInPerM: 0.30,
    priceOutPerM: 1.20,
    builtin: true,
    note: 'Beta — integracao Anthropic-compatible do DashScope ainda em validacao. Endpoint pode exigir ajuste manual conforme rollout da Alibaba. China: https://dashscope.aliyuncs.com/api/v2/apps/claude-code. Docs: https://help.aliyun.com/zh/model-studio/developer-reference/api-details',
    protocol: 'anthropic_messages',
    knownModels: ['qwen3-coder-plus', 'qwen-plus'],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter (aggregator)',
    kind: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: '',
    mainModel: 'anthropic/claude-sonnet-4',
    fastModel: 'anthropic/claude-haiku-4-5',
    contextWindow: 200_000,
    priceInPerM: 3.00,
    priceOutPerM: 15.00,
    builtin: true,
    note: 'Aggregator: 1 chave acessa dezenas de modelos (Anthropic, Moonshot, Qwen, GLM, Gemini, GPT, Llama). Substitua mainModel/fastModel por qualquer slug suportado (ex: moonshotai/kimi-k2, zhipuai/glm-4-plus). Docs: https://openrouter.ai/docs',
    protocol: 'openai_chat',
    knownModels: [
      'anthropic/claude-sonnet-4',
      'anthropic/claude-haiku-4-5',
      'anthropic/claude-opus-4',
      'openai/gpt-4o',
      'google/gemini-2.5-pro',
      'moonshotai/kimi-k2',
      'zhipuai/glm-4-plus',
    ],
  },
];

export const DEFAULT_ACTIVE_ID = 'anthropic';
