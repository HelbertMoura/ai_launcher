import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

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

  const check = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invoke<UpdatesSummary>("check_all_updates");
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
    } else {
      void check();
    }
  }, [check]);

  const hasUpdates = summary ? summary.total_with_updates > 0 : false;

  return { summary, loading, hasUpdates, refresh: check };
}
