import { useCallback, useEffect, useState } from "react";

export type SessionStatus = "starting" | "running" | "completed" | "failed" | "unknown";

export interface HistoryItem {
  cli: string;
  cliKey: string;
  directory: string;
  args: string;
  timestamp: string;
  description?: string;
  status: SessionStatus;
  sessionId?: string;
  startedAt: string;
  completedAt?: string;
  duration?: number; // ms
  exitCode?: number | null;
  errorMessage?: string;
  providerId?: string;
}

const CONFIG_KEY = "ai-launcher-config";
const LAST_DIR_KEY = "ai-launcher:last-dir";

/** Migrate legacy items that lack the new session-lifecycle fields. */
function migrateItem(item: Record<string, unknown>): HistoryItem {
  const status = item.status as string | undefined;
  // Map old status values to new ones
  let migratedStatus: SessionStatus;
  if (status === "starting" || status === "running" || status === "completed" || status === "failed" || status === "unknown") {
    migratedStatus = status;
  } else if (status === "finished") {
    migratedStatus = "completed";
  } else if (status === "error") {
    migratedStatus = "failed";
  } else {
    migratedStatus = "unknown";
  }

  return {
    cli: (item.cli as string) ?? "",
    cliKey: (item.cliKey as string) ?? "",
    directory: (item.directory as string) ?? "",
    args: (item.args as string) ?? "",
    timestamp: (item.timestamp as string) ?? new Date().toISOString(),
    description: item.description as string | undefined,
    status: migratedStatus,
    sessionId: item.sessionId as string | undefined,
    startedAt: (item.startedAt as string) ?? (item.timestamp as string) ?? new Date().toISOString(),
    completedAt: item.completedAt as string | undefined,
    duration: item.duration as number | undefined,
    exitCode: item.exitCode as number | null | undefined,
    errorMessage: item.errorMessage as string | undefined,
    providerId: item.providerId as string | undefined,
  };
}

function readItems(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return [];
    const cfg = JSON.parse(raw) as Record<string, unknown>;
    if (!Array.isArray(cfg.history)) return [];
    return (cfg.history as Record<string, unknown>[]).map(migrateItem);
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

/** Update the status of a history entry by sessionId. */
export function updateSessionStatus(
  sessionId: string,
  patch: { status: SessionStatus; completedAt?: string; duration?: number; exitCode?: number | null; errorMessage?: string },
): void {
  const items = readItems();
  const idx = items.findIndex((it) => it.sessionId === sessionId);
  if (idx === -1) return;
  items[idx] = { ...items[idx], ...patch };
  writeItems(items);
}

/** Mark a session as completed or failed. */
export function markSessionEnded(
  sessionId: string,
  outcome: { status: "completed" | "failed"; exitCode?: number | null; errorMessage?: string },
): void {
  const completedAt = new Date().toISOString();
  const items = readItems();
  const idx = items.findIndex((it) => it.sessionId === sessionId);
  if (idx === -1) return;
  const item = items[idx];
  const startedMs = Date.parse(item.startedAt);
  const duration = Number.isNaN(startedMs) ? undefined : Date.now() - startedMs;
  items[idx] = { ...item, ...outcome, completedAt, duration };
  writeItems(items);
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

const RECENT_DIRS_KEY = "ai-launcher:recent-dirs";
const MAX_RECENT_DIRS = 10;

export function getRecentDirs(cliKey: string): string[] {
  try {
    const raw = localStorage.getItem(RECENT_DIRS_KEY);
    if (!raw) return [];
    const map = JSON.parse(raw) as Record<string, string[]>;
    return map[cliKey] ?? [];
  } catch {
    return [];
  }
}

export function addRecentDir(cliKey: string, dir: string): void {
  try {
    const raw = localStorage.getItem(RECENT_DIRS_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
    const list = (map[cliKey] ?? []).filter((d) => d !== dir);
    map[cliKey] = [dir, ...list].slice(0, MAX_RECENT_DIRS);
    localStorage.setItem(RECENT_DIRS_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}
