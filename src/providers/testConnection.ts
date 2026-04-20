// ==============================================================================
// AI Launcher Pro - Providers (test de conexão)
// Dispara um ping mínimo no endpoint Anthropic-compatible pra validar token +
// baseUrl. Sem gastar tokens (usa max_tokens=1).
// ==============================================================================

import type { ProviderProfile, ProviderTestResult } from './types';

const DEFAULT_TIMEOUT_MS = 8000;

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
  const url = profile.baseUrl.replace(/\/+$/, '') + '/v1/messages';
  const body = {
    model: profile.mainModel,
    max_tokens: 1,
    messages: [{ role: 'user', content: 'ping' }],
  };
  const controller = new AbortController();
  const t0 = performance.now();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': profile.apiKey,
        'authorization': `Bearer ${profile.apiKey}`,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const latencyMs = Math.round(performance.now() - t0);
    const text = await res.text().catch(() => '');
    let modelEcho: string | undefined;
    try {
      const j = JSON.parse(text);
      modelEcho = j.model || j?.response?.model || undefined;
    } catch {/* not json */}
    if (res.ok) {
      return {
        ok: true,
        statusCode: res.status,
        latencyMs,
        modelEcho,
        message: `Conectou em ${latencyMs}ms${modelEcho ? ` · modelo ${modelEcho}` : ''}`,
      };
    }
    // 4xx de auth ainda indica que o endpoint responde — ajuda debug
    const hint = res.status === 401 || res.status === 403
      ? 'Chave inválida ou sem acesso.'
      : res.status === 404
      ? 'Endpoint não encontrado — verifique a baseUrl.'
      : res.status === 429
      ? 'Rate-limited, mas o endpoint responde.'
      : 'Erro do provider.';
    return {
      ok: false,
      statusCode: res.status,
      latencyMs,
      message: `HTTP ${res.status} — ${hint}${text ? ` · ${text.slice(0, 160)}` : ''}`,
    };
  } catch (e: unknown) {
    const latencyMs = Math.round(performance.now() - t0);
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('abort')) {
      return { ok: false, latencyMs, message: `Timeout após ${DEFAULT_TIMEOUT_MS}ms` };
    }
    return { ok: false, latencyMs, message: `Falhou: ${msg.slice(0, 200)}` };
  } finally {
    clearTimeout(timer);
  }
}
