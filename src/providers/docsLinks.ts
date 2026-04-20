// ==============================================================================
// AI Launcher Pro - Docs Links por provider kind
// ==============================================================================

import type { ProviderKind } from './types';

export const DOCS_LINKS: Record<ProviderKind, { label: string; url: string }> = {
  anthropic: { label: 'Anthropic docs', url: 'https://docs.anthropic.com/' },
  zai: { label: 'Z.AI docs', url: 'https://docs.z.ai/' },
  minimax: { label: 'MiniMax docs', url: 'https://platform.minimaxi.com/document/home' },
  custom: { label: 'Claude Code env vars', url: 'https://docs.anthropic.com/en/docs/claude-code/settings' },
};
