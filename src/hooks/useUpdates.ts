import { useCallback, useEffect, useState } from "react";
import { invokeOrFallback } from "../lib/tauri";

export interface UpdateInfo {
  cli: string;
  current: string | null;
  latest: string | null;
  has_update: boolean;
  method: string;
  no_api: boolean;
  key: string | null;
}

export interface UpdatesSummary {
  cli_updates: UpdateInfo[];
  env_updates: UpdateInfo[];
  tool_updates: UpdateInfo[];
  checked_at: string;
  total_with_updates: number;
}

const CACHE_KEY = "ai-launcher:updates-cache";
const TTL_MS = 60 * 60 * 1000;

interface CachedUpdates {
  data: UpdatesSummary;
  savedAt: number;
}

// Module-level rate limiter: `useUpdates` mounts more than once (App +
// StatusBar), and without this guard each mount fired its own
// `check_all_updates` — doubling ~15 subprocess probes plus network calls.
let lastCheckStartedAt = 0;
const CHECK_DEDUPE_MS = 30_000;

/** Boot-time auto check waits for browser idle so first paint and the first
 * interactions never compete with the subprocess/network scan. */
function scheduleIdleCheck(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  if ("requestIdleCallback" in window) {
    const id = (window as unknown as {
      requestIdleCallback: (cb: () => void, opts: { timeout: number }) => number;
    }).requestIdleCallback(cb, { timeout: 4000 });
    return () =>
      (window as unknown as { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(id);
  }
  const id = globalThis.setTimeout(cb, 2500);
  return () => globalThis.clearTimeout(id);
}

export function useUpdates() {
  const [summary, setSummary] = useState<UpdatesSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const loadCache = (): UpdatesSummary | null => {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const cached = JSON.parse(raw) as CachedUpdates;
      if (Date.now() - cached.savedAt > TTL_MS) return null;
      return cached.data;
    } catch {
      return null;
    }
  };

  const saveCache = (data: UpdatesSummary) => {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, savedAt: Date.now() }));
    } catch { /* quota */ }
  };

  const check = useCallback(async (force = false) => {
    if (!force && Date.now() - lastCheckStartedAt < CHECK_DEDUPE_MS) return;
    lastCheckStartedAt = Date.now();
    setLoading(true);
    try {
      const data = await invokeOrFallback<UpdatesSummary>(
        "check_all_updates",
        undefined,
        {
          cli_updates: [],
          env_updates: [],
          tool_updates: [],
          checked_at: new Date().toISOString(),
          total_with_updates: 0,
        },
      );
      setSummary(data);
      saveCache(data);
    } catch {
      /* silent — updates are non-critical */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cached = loadCache();
    if (cached) {
      setSummary(cached);
      return;
    }
    // Deferred: the update badge is non-critical; don't slow down boot.
    return scheduleIdleCheck(() => void check());
  }, [check]);

  const hasUpdates = summary ? summary.total_with_updates > 0 : false;

  const refresh = useCallback(() => void check(true), [check]);

  return { summary, loading, hasUpdates, refresh };
}
