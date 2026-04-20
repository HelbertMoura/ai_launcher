// ==============================================================================
// AI Launcher Pro - Budget tracking por provider
// Cruza usage.jsonl (lido via tauri command `read_usage_stats`) com preço do
// perfil pra estimar gasto do dia. Dispara alerta quando passa do limite.
// ==============================================================================

import type { ProviderProfile } from './types';

export interface DailySpend {
  date: string;
  usd: number;
  tokensIn: number;
  tokensOut: number;
}

interface UsageLite {
  date: string;
  cli: string;
  model: string | null;
  tokens_in: number;
  tokens_out: number;
  cost_estimate_usd: number;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Reestima o gasto do dia assumindo o preço do perfil ativo (em vez do preço
 * hardcoded pela tabela do backend). Útil porque perfis Z.AI/MiniMax não são
 * reconhecidos pela tabela padrão.
 */
export function computeTodaySpend(entries: UsageLite[], profile: ProviderProfile): DailySpend {
  const today = todayISO();
  const todayEntries = entries.filter(e => e.date === today && e.cli === 'claude');
  let tokensIn = 0;
  let tokensOut = 0;
  for (const e of todayEntries) {
    tokensIn += e.tokens_in || 0;
    tokensOut += e.tokens_out || 0;
  }
  const pin = profile.priceInPerM ?? 0;
  const pout = profile.priceOutPerM ?? 0;
  const usd = (tokensIn / 1_000_000) * pin + (tokensOut / 1_000_000) * pout;
  return { date: today, usd: Number(usd.toFixed(4)), tokensIn, tokensOut };
}

export function shouldAlert(spend: DailySpend, budget: number | undefined): boolean {
  if (!budget || budget <= 0) return false;
  return spend.usd >= budget;
}
