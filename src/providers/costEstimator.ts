// ==============================================================================
// AI Launcher Pro - Providers (cost estimator)
// Compara estimativa de custo entre perfis pra 1M tokens in / 1M out e pra um
// cenário "sessão típica" (50k in + 10k out).
// ==============================================================================

import type { ProviderProfile } from './types';

export interface CostBreakdown {
  per1MIn: number;
  per1MOut: number;
  perTypicalSession: number; // 50k in + 10k out em USD
}

const TYPICAL_IN = 50_000;
const TYPICAL_OUT = 10_000;

export function estimateCost(profile: ProviderProfile): CostBreakdown {
  const pin = profile.priceInPerM ?? 0;
  const pout = profile.priceOutPerM ?? 0;
  const session = (TYPICAL_IN / 1_000_000) * pin + (TYPICAL_OUT / 1_000_000) * pout;
  return {
    per1MIn: pin,
    per1MOut: pout,
    perTypicalSession: Number(session.toFixed(4)),
  };
}

export function formatUSD(v: number): string {
  if (v === 0) return '—';
  if (v < 0.01) return `$${v.toFixed(4)}`;
  if (v < 1) return `$${v.toFixed(3)}`;
  return `$${v.toFixed(2)}`;
}

/** Retorna um rótulo curto relativo ao Anthropic oficial. Útil pra badge. */
export function savingsVsBaseline(
  profile: ProviderProfile,
  baseline: ProviderProfile | undefined,
): string | undefined {
  if (!baseline || profile.id === baseline.id) return undefined;
  const a = estimateCost(profile).perTypicalSession;
  const b = estimateCost(baseline).perTypicalSession;
  if (b <= 0 || a <= 0) return undefined;
  const pct = Math.round((1 - a / b) * 100);
  if (pct <= 0) return `${Math.abs(pct)}% mais caro`;
  return `${pct}% mais barato`;
}
