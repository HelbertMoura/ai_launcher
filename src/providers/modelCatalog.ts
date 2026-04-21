// ==============================================================================
// AI Launcher Pro - Model Catalog
// Sugestões de autocomplete pra modelos principais e fast/small por kind.
// ==============================================================================

import type { ProviderKind } from './types';

interface ModelHints {
  main: string[];
  fast: string[];
}

export const MODEL_CATALOG: Record<ProviderKind, ModelHints> = {
  anthropic: {
    main: ['claude-opus-4-7', 'claude-opus-4-6', 'claude-sonnet-4-6', 'claude-sonnet-4-5'],
    fast: ['claude-haiku-4-5', 'claude-haiku-4-5-20251001'],
  },
  zai: {
    main: ['glm-5.1', 'glm-4.6', 'glm-4.5-air', 'glm-4.7'],
    fast: ['glm-4.7', 'glm-4.5-air'],
  },
  minimax: {
    main: ['MiniMax-M2.7', 'MiniMax-M2', 'MiniMax-abab6.5', 'MiniMax-Text-01'],
    fast: ['MiniMax-M2.7', 'MiniMax-M2', 'MiniMax-abab6.5-s'],
  },
  moonshot: {
    main: ['kimi-k2-0905-preview', 'kimi-k2-turbo-preview', 'kimi-k2'],
    fast: ['kimi-k2-turbo-preview', 'kimi-k2'],
  },
  qwen: {
    main: ['qwen3-coder-plus', 'qwen3-coder', 'qwen-max', 'qwen-plus'],
    fast: ['qwen-plus', 'qwen-turbo', 'qwen-flash'],
  },
  openrouter: {
    main: [
      'anthropic/claude-sonnet-4',
      'anthropic/claude-opus-4',
      'moonshotai/kimi-k2',
      'zhipuai/glm-4-plus',
      'qwen/qwen3-coder-plus',
    ],
    fast: [
      'anthropic/claude-haiku-4-5',
      'moonshotai/kimi-k2-turbo',
      'qwen/qwen-plus',
    ],
  },
  custom: {
    main: [],
    fast: [],
  },
};

export function hintsFor(kind: ProviderKind, which: 'main' | 'fast'): string[] {
  return MODEL_CATALOG[kind]?.[which] ?? [];
}
