import { useCallback, useEffect, useState } from "react";
import { readKey, writeKey, STORAGE_KEYS } from "../../lib/storage";

export type SessionStatus =
  | "starting"
  | "running"
  | "completed"
  | "failed"
  | "detached"
  | "unknown";

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

const CONFIG_KEY = STORAGE_KEYS.config;

// A "starting" session that began more than this long ago almost certainly
// never reached the running state (the app was closed mid-launch, the spawn
// failed silently, etc.). On load we demote such stale sessions to "unknown"
// so the timeline stops claiming a launch is still in progress. 6 hours is a
// generous upper bound for how long a real launch handshake could take.
const STALE_STARTING_MS = 6 * 60 * 60 * 1000;

/** Migrate legacy items that lack the new session-lifecycle fields. */
function migrateItem(item: Record<string, unknown>): HistoryItem {
  const status = item.status as string | undefined;
  // Map old status values to new ones
  let migratedStatus: SessionStatus;
  if (
    status === "starting" ||
    status === "running" ||
    status === "completed" ||
    status === "failed" ||
    status === "detached" ||
    status === "unknown"
  ) {
    migratedStatus = status;
  } else if (status === "finished") {
    migratedStatus = "completed";
  } else if (status === "error") {
    migratedStatus = "failed";
  } else {
    migratedStatus = "unknown";
  }

  const startedAt = (item.startedAt as string) ?? (item.timestamp as string) ?? new Date().toISOString();

  // Demote stale "starting" sessions: if a session has been "starting" for
  // longer than STALE_STARTING_MS, it is stuck and should not keep reporting
  // an in-progress launch. Leaving it as "starting" makes the timeline lie.
  if (migratedStatus === "starting") {
    const startedMs = Date.parse(startedAt);
    if (!Number.isNaN(startedMs) && Date.now() - startedMs > STALE_STARTING_MS) {
      migratedStatus = "unknown";
    }
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
    startedAt,
    completedAt: item.completedAt as string | undefined,
    duration: item.duration as number | undefined,
    exitCode: item.exitCode as number | null | undefined,
    errorMessage: item.errorMessage as string | undefined,
    providerId: item.providerId as string | undefined,
  };
}

function readItems(): HistoryItem[] {
    const cfg = readKey("config");
    if (!Array.isArray(cfg.history)) return [];
    return (cfg.history as Record<string, unknown>[]).map(migrateItem);
}

// In-tab change notifier. The browser `storage` event only fires across tabs,
// so same-tab mutations (e.g. a session-ended listener calling markSessionEnded)
// would not refresh React state. Subscribers registered here are notified on
// every write so the history UI updates live.
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  listeners.forEach((l) => l());
}

function writeItems(items: HistoryItem[]): void {
    const cfg = readKey("config");
    cfg.history = items;
    writeKey("config", cfg);
  notify();
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
  outcome: {
    status: "completed" | "failed";
    exitCode?: number | null;
    errorMessage?: string;
    /** Real process duration in ms (from the backend), preferred when present. */
    durationMs?: number;
  },
): void {
  const completedAt = new Date().toISOString();
  const items = readItems();
  const idx = items.findIndex((it) => it.sessionId === sessionId);
  if (idx === -1) return;
  const item = items[idx];
  const { durationMs, ...rest } = outcome;
  // Prefer the backend-measured duration; fall back to wall clock since start.
  let duration = durationMs;
  if (duration === undefined) {
    const startedMs = Date.parse(item.startedAt);
    duration = Number.isNaN(startedMs) ? undefined : Date.now() - startedMs;
  }
  items[idx] = { ...item, ...rest, completedAt, duration };
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
    // Also refresh on same-tab writes (e.g. the session-ended listener).
    const unsub = subscribe(refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      unsub();
    };
  }, [refresh]);

  return { items, clear, refresh, updateItem, removeItem };
}

export function getLastDir(cliKey: string): string {
  return readKey("lastDir")[cliKey] ?? "";
}

export function saveLastDir(cliKey: string, dir: string): void {
  writeKey("lastDir", { ...readKey("lastDir"), [cliKey]: dir });
}

const MAX_RECENT_DIRS = 10;

export function getRecentDirs(cliKey: string): string[] {
  return readKey("recentDirs")[cliKey] ?? [];
}

export function addRecentDir(cliKey: string, dir: string): void {
    const map = readKey("recentDirs");
    const list = (map[cliKey] ?? []).filter((d) => d !== dir);
    map[cliKey] = [dir, ...list].slice(0, MAX_RECENT_DIRS);
    writeKey("recentDirs", map);
}
