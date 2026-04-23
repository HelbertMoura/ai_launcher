import { useCallback, useEffect, useState } from "react";

export type SessionStatus = "running" | "finished" | "error";

export interface HistoryItem {
  cli: string;
  cliKey: string;
  directory: string;
  args: string;
  timestamp: string;
  description?: string;
  status?: SessionStatus;
  duration?: number; // seconds
}

const CONFIG_KEY = "ai-launcher-config";
const LAST_DIR_KEY = "ai-launcher:last-dir";

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

function writeItems(items: HistoryItem[]): void {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    const cfg = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    cfg.history = items;
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  } catch {
    /* ignore */
  }
}

export function useHistory(): {
  items: HistoryItem[];
  clear: () => void;
  refresh: () => void;
  updateItem: (index: number, patch: Partial<HistoryItem>) => void;
  removeItem: (index: number) => void;
} {
  const [items, setItems] = useState<HistoryItem[]>(() => readItems());

  const refresh = useCallback(() => setItems(readItems()), []);

  const clear = useCallback(() => {
    writeItems([]);
    setItems([]);
  }, []);

  const updateItem = useCallback((index: number, patch: Partial<HistoryItem>) => {
    setItems((prev) => {
      const next = prev.map((item, i) => (i === index ? { ...item, ...patch } : item));
      writeItems(next);
      return next;
    });
  }, []);

  const removeItem = useCallback((index: number) => {
    setItems((prev) => {
      const next = prev.filter((_, i) => i !== index);
      writeItems(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === CONFIG_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  return { items, clear, refresh, updateItem, removeItem };
}

export function getLastDir(cliKey: string): string {
  try {
    const raw = localStorage.getItem(LAST_DIR_KEY);
    if (!raw) return "";
    const map = JSON.parse(raw) as Record<string, string>;
    return map[cliKey] ?? "";
  } catch {
    return "";
  }
}

export function saveLastDir(cliKey: string, dir: string): void {
  try {
    const raw = localStorage.getItem(LAST_DIR_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    map[cliKey] = dir;
    localStorage.setItem(LAST_DIR_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}
