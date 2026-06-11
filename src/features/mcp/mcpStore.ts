import { invoke } from "@tauri-apps/api/core";
import { McpServerListSchema, type McpServer } from "./types";

/**
 * Shared MCP store. Mirrors the `clisStore` pattern: a single in-memory
 * snapshot, a `useSyncExternalStore`-friendly subscribe/getSnapshot pair, and
 * inflight de-duplication so concurrent callers share one backend round-trip.
 *
 * Unlike `clisStore` there is no sessionStorage cache: the MCP config lives in
 * files the user can edit out-of-band, so we always read fresh from the backend
 * and re-list after every mutation.
 */
export interface McpSnapshot {
  servers: McpServer[];
  loading: boolean;
  error: string | null;
}

type Listener = (snap: McpSnapshot) => void;

let state: McpSnapshot = {
  servers: [],
  loading: true,
  error: null,
};

const listeners = new Set<Listener>();
let inflight: Promise<void> | null = null;
let hydrated = false;

function emit(): void {
  for (const fn of listeners) fn(state);
}

function setState(partial: Partial<McpSnapshot>): void {
  state = { ...state, ...partial };
  emit();
}

async function load(): Promise<void> {
  // De-dupe concurrent loads: callers share the single inflight promise.
  if (inflight) return inflight;
  setState({ loading: true, error: null });
  inflight = (async () => {
    try {
      const raw = await invoke<unknown>("list_mcp_servers");
      const servers = McpServerListSchema.parse(raw);
      state = { servers, loading: false, error: null };
      hydrated = true;
      emit();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setState({ loading: false, error: message });
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export const mcpStore = {
  getSnapshot(): McpSnapshot {
    return state;
  },
  isHydrated(): boolean {
    return hydrated;
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** Load once if not already loaded (idempotent thanks to inflight dedup). */
  ensureLoaded(): Promise<void> {
    if (hydrated && !inflight) return Promise.resolve();
    return load();
  },
  /** Force a fresh `list_mcp_servers` (used after a mutation). */
  refresh(): Promise<void> {
    return load();
  },
};
