// ==============================================================================
// AI Launcher Pro - Providers (test de conexão)
// Dispara um ping mínimo no endpoint Anthropic-compatible via backend Rust
// (ureq) — evita bloqueio CORS do webview Tauri. Usa max_tokens=1 para
// minimizar custo.
// ==============================================================================

import { invoke } from '@tauri-apps/api/core';
import type { ProviderProfile, ProviderTestResult } from './types';

export async function testProviderConnection(profile: ProviderProfile): Promise<ProviderTestResult> {
  if (!profile.baseUrl) {
    return {
      ok: false,
      message: 'Sem baseUrl — perfil "Anthropic oficial" depende da config local do Claude Code.',
    };
  }
  if (!profile.apiKey) {
    return { ok: false, message: 'Sem apiKey — preencha antes de testar.' };
  }
  try {
    const result = await invoke<ProviderTestResult>('test_provider_connection', {
      baseUrl: profile.baseUrl,
      apiKey: profile.apiKey,
      model: profile.mainModel,
    });
    return result;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      message: `Falhou no backend: ${msg.slice(0, 200)}`,
    };
  }
}
