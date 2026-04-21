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
    baseUrl: 'https://api.minimax.io/anthropic',
    apiKey: mmKeySeed,
    mainModel: 'MiniMax-M2.7',
    fastModel: 'MiniMax-M2.7',
    contextWindow: 200_000,
    priceInPerM: 0.3,
    priceOutPerM: 1.2,
    builtin: true,
    note: 'Endpoint Anthropic-compatible (internacional). China: troque para https://api.minimaxi.com/anthropic. Modelo conforme doc oficial: https://platform.minimax.io/docs/token-plan/claude-code',
  },
  {
    id: 'moonshot',
    name: 'Moonshot / Kimi (oficial)',
    kind: 'moonshot',
    baseUrl: 'https://api.moonshot.ai/anthropic',
    apiKey: (import.meta.env.VITE_MOONSHOT_API_KEY as string | undefined) || '',
    mainModel: 'kimi-k2-0905-preview',
    fastModel: 'kimi-k2-turbo-preview',
    contextWindow: 256_000,
    priceInPerM: 0.60,
    priceOutPerM: 2.50,
    builtin: true,
    note: 'Endpoint Anthropic-compatible oficial. China: troque para https://api.moonshot.cn/anthropic. Plano "Kimi for Code" disponível. Docs: https://platform.moonshot.ai/docs/guide/anthropic-api',
  },
  {
    id: 'qwen',
    name: 'Qwen / DashScope (Alibaba)',
    kind: 'qwen',
    baseUrl: 'https://dashscope-intl.aliyuncs.com/api/v2/apps/claude-code',
    apiKey: (import.meta.env.VITE_QWEN_API_KEY as string | undefined) || '',
    mainModel: 'qwen3-coder-plus',
    fastModel: 'qwen-plus',
    contextWindow: 256_000,
    priceInPerM: 0.30,
    priceOutPerM: 1.20,
    builtin: true,
    note: '⚠️ Beta — integração Anthropic-compatible do DashScope ainda em validação. Endpoint pode exigir ajuste manual conforme rollout da Alibaba. China: https://dashscope.aliyuncs.com/api/v2/apps/claude-code. Docs: https://help.aliyun.com/zh/model-studio/developer-reference/api-details',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter (aggregator)',
    kind: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: (import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined) || '',
    mainModel: 'anthropic/claude-sonnet-4',
    fastModel: 'anthropic/claude-haiku-4-5',
    contextWindow: 200_000,
    priceInPerM: 3.00,
    priceOutPerM: 15.00,
    builtin: true,
    note: 'Aggregator: 1 chave acessa dezenas de modelos (Anthropic, Moonshot, Qwen, GLM, Gemini, GPT, Llama). Substitua mainModel/fastModel por qualquer slug suportado (ex: moonshotai/kimi-k2, zhipuai/glm-4-plus). Docs: https://openrouter.ai/docs',
  },
];

export const DEFAULT_ACTIVE_ID = 'anthropic';
