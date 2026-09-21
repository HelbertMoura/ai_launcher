import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { z } from "zod";
import type { PrereqCheck } from "./usePrerequisites";
import { invokeOrFallback, isTauriRuntime } from "../../lib/tauri";

const CACHE_KEY = "ai-launcher:environment-cache";
const TTL_MS = 10 * 60 * 1000; // 10 min

/** Event emitted by `check_environment` as each individual check finishes. */
const ENV_CHECK_RESULT_EVENT = "env-check-result";

const envCheckResultSchema = z.object({
  key: z.string().min(1),
  name: z.string(),
  installed: z.boolean(),
  version: z.string().nullable().optional(),
  install_command: z.string().nullable().optional(),
});

interface CachedPayload {
  items: PrereqCheck[];
  savedAt: number;
}

interface Snapshot {
  items: PrereqCheck[];
  loading: boolean;
  error: string | null;
}

type Listener = (snap: Snapshot) => void;

let state: Snapshot = {
  items: [],
  loading: true,
  error: null,
};

const listeners = new Set<Listener>();
let inflight: Promise<void> | null = null;
let hydrated = false;

function readCache(): CachedPayload | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPayload;
    if (Date.now() - parsed.savedAt > TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(items: PrereqCheck[]): void {
  try {
    const payload: CachedPayload = { items, savedAt: Date.now() };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* quota errors non-fatal */
  }
}

function clearCache(): void {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}

function emit(): void {
  for (const fn of listeners) fn(state);
}

function setState(partial: Partial<Snapshot>): void {
  state = { ...state, ...partial };
  emit();
}

/**
 * Merges a single streamed check result into the snapshot. Unchanged items
 * keep their object identity so memoized rows skip re-render.
 */
function upsertItem(item: PrereqCheck): void {
  const idx = state.items.findIndex((it) => it.key === item.key);
  const items = state.items.slice();
  if (idx === -1) items.push(item);
  else items[idx] = item;
  state = { ...state, items };
  emit();
}

/**
 * Subscribes to per-check results while a (re)check is in flight so the UI
 * fills in progressively. Returns an unlisten no-op outside the Tauri
 * runtime. The final `check_environment` resolve remains authoritative.
 */
async function streamResults(): Promise<() => void> {
  if (!isTauriRuntime()) return () => {};
  try {
    const unlisten: UnlistenFn = await listen<unknown>(
      ENV_CHECK_RESULT_EVENT,
      (event) => {
        const parsed = envCheckResultSchema.safeParse(event.payload);
        if (!parsed.success) return;
        upsertItem({
          key: parsed.data.key,
          name: parsed.data.name,
          installed: parsed.data.installed,
          version: parsed.data.version ?? null,
          install_command: parsed.data.install_command ?? null,
        });
      },
    );
    return unlisten;
  } catch {
    return () => {};
  }
}

async function load(force = false): Promise<void> {
  if (inflight) return inflight;
  if (!force) {
    const cached = readCache();
    if (cached) {
      state = { items: cached.items, loading: false, error: null };
      hydrated = true;
      emit();
      return;
    }
  }
  setState({ loading: state.items.length === 0, error: null });
  inflight = (async () => {
    // Register the listener BEFORE invoking so no streamed result is missed.
    const unlisten = await streamResults();
    try {
      const items = await invokeOrFallback<PrereqCheck[]>("check_environment", undefined, []);
      state = { items, loading: false, error: null };
      hydrated = true;
      writeCache(items);
      emit();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setState({ loading: false, error: message });
    } finally {
      unlisten();
      inflight = null;
    }
  })();
  return inflight;
}

export const environmentStore = {
  getSnapshot(): Snapshot {
    return state;
  },
  isHydrated(): boolean {
    return hydrated;
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  ensureLoaded(): Promise<void> {
    return load(false);
  },
  refresh(): Promise<void> {
    clearCache();
    return load(true);
  },
  invalidate(): void {
    clearCache();
    hydrated = false;
  },
};
