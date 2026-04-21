// ==============================================================================
// AI Launcher Pro - Docs Links por provider kind
// ==============================================================================

import type { ProviderKind } from './types';

export const DOCS_LINKS: Record<ProviderKind, { label: string; url: string }> = {
  anthropic: { label: 'Anthropic docs', url: 'https://docs.anthropic.com/' },
  zai: { label: 'Z.AI docs', url: 'https://docs.z.ai/' },
  minimax: { label: 'MiniMax docs', url: 'https://platform.minimaxi.com/document/home' },
  moonshot: { label: 'Moonshot / Kimi docs', url: 'https://platform.moonshot.ai/docs/guide/anthropic-api' },
  qwen: { label: 'Qwen / DashScope docs', url: 'https://help.aliyun.com/zh/model-studio/developer-reference/api-details' },
  openrouter: { label: 'OpenRouter docs', url: 'https://openrouter.ai/docs' },
  custom: { label: 'Claude Code env vars', url: 'https://docs.anthropic.com/en/docs/claude-code/settings' },
};
