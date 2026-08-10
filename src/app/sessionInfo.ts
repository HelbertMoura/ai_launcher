//! Helpers that derive chrome (StatusBar) state from local storage and
//! the providers registry. Extracted from `App.tsx` as part of REF-002 so
//! the surface area of `App.tsx` stays focused on routing/layout.
//!
//! All functions are pure except `readHistoryItems` / `readProviderTest`
//! which read from the typed Zod storage registry. See
//! `.wolf/audit-2026-08-10.md`.

import { z } from "zod";

import type { HistoryItem } from "../features/history/useHistory";
import { loadProviders } from "../providers/storage";
import { readKey, readScoped } from "../lib/storage";
import type { LastSessionInfo, ProviderLatency } from "./layout/StatusBar";
import { formatRelative } from "./format";

/** Reads the persisted history array from the typed storage registry. */
export function readHistoryItems(): HistoryItem[] {
  try {
    const cfg = readKey("config");
    if (!Array.isArray(cfg.history)) return [];
    return cfg.history as HistoryItem[];
  } catch {
    return [];
  }
}

/**
 * Walks history newest-first and returns the most recent item whose
 * timestamp is within the 24h relative-format window. Older items are
 * ignored — the StatusBar would render them as a full date instead.
 */
export function computeLastSession(items: HistoryItem[]): LastSessionInfo | undefined {
  if (!items.length) return undefined;
  const mostRecent = items.reduce<HistoryItem | null>((best, cur) => {
    const cand = cur.startedAt || cur.timestamp;
    const bestIso = best ? best.startedAt || best.timestamp : undefined;
    if (!cand) return best;
    if (!bestIso) return cur;
    return Date.parse(cand) > Date.parse(bestIso) ? cur : best;
  }, null);
  if (!mostRecent) return undefined;
  const rel = formatRelative(mostRecent.startedAt || mostRecent.timestamp);
  if (!rel) return undefined;
  return { cli: mostRecent.cli || mostRecent.cliKey || "session", relative: rel };
}

interface StoredProviderTest {
  ok?: boolean;
  testedAt?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Reads the last connectivity test result for a provider, if any. */
export function readProviderTest(providerId: string): StoredProviderTest | null {
  return readScoped(
    `ai-launcher:provider-test:${providerId}`,
    z.object({ ok: z.boolean().optional(), testedAt: z.string().optional() }),
    null as StoredProviderTest | null,
  );
}

/**
 * Maps the active provider and its last test into a `ProviderLatency`
 * suitable for the StatusBar pill (tone + display name). Returns
 * `undefined` when no provider is active.
 */
export function computeProviderLatency(): ProviderLatency | undefined {
  try {
    const state = loadProviders();
    const active = state.profiles.find((p) => p.id === state.activeId);
    if (!active) return undefined;
    const test = readProviderTest(active.id);
    if (!test || !test.testedAt) {
      return { name: active.name, tone: "warn" };
    }
    const age = Date.now() - Date.parse(test.testedAt);
    if (Number.isNaN(age)) return { name: active.name, tone: "warn" };
    if (test.ok === false) return { name: active.name, tone: "err" };
    if (age > DAY_MS) return { name: active.name, tone: "warn" };
    return { name: active.name, tone: "ok" };
  } catch {
    return undefined;
  }
}
