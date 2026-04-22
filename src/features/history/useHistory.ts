import { useCallback, useEffect, useState } from "react";

export interface HistoryItem {
  cli: string;
  cliKey: string;
  directory: string;
  args: string;
  timestamp: string;
}

const CONFIG_KEY = "ai-launcher-config";

function readItems(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return [];
    const cfg = JSON.parse(raw) as Record<string, unknown>;
    return Array.isArray(cfg.history) ? (cfg.history as HistoryItem[]) : [];
  } catch {
    return [];
  }
}

export function useHistory(): { items: HistoryItem[]; clear: () => void; refresh: () => void } {
  const [items, setItems] = useState<HistoryItem[]>(() => readItems());

  const refresh = useCallback(() => setItems(readItems()), []);

  const clear = useCallback(() => {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      const cfg = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      cfg.history = [];
      localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
    } catch {
      /* ignore */
    }
    setItems([]);
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === CONFIG_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  return { items, clear, refresh };
}
