import { invoke } from "@tauri-apps/api/core";
import type { CheckResult, ToolInfo } from "./useTools";
import {
  loadCustomIdes,
  CUSTOM_IDES_CHANGED_EVENT,
  type CustomIde,
} from "../../lib/customIdes";

const CACHE_KEY = "ai-launcher:tools-cache";
const TTL_MS = 10 * 60 * 1000; // 10 min

interface CachedPayload {
  tools: ToolInfo[];
  checks: Record<string, CheckResult>;
  savedAt: number;
}

interface Snapshot {
  tools: ToolInfo[];
  checks: Record<string, CheckResult>;
  customIdes: CustomIde[];
  loading: boolean;
  error: string | null;
}

type Listener = (snap: Snapshot) => void;

let state: Snapshot = {
  tools: [],
  checks: {},
  customIdes: [],
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

function writeCache(tools: ToolInfo[], checks: Record<string, CheckResult>): void {
  try {
    const payload: CachedPayload = { tools, checks, savedAt: Date.now() };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* quota errors are non-fatal */
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

/** Reload custom IDEs from localStorage and merge into snapshot. */
function mergeCustomIdes(): void {
  const customIdes = loadCustomIdes();
  state = { ...state, customIdes };
  emit();
}

/** Listen for same-tab custom IDE changes from the Admin panel. */
function setupCustomIdeListener(): () => void {
  const handler = () => mergeCustomIdes();
  window.addEventListener(CUSTOM_IDES_CHANGED_EVENT, handler);
  return () => window.removeEventListener(CUSTOM_IDES_CHANGED_EVENT, handler);
}

// Start listening once at module load
const cleanupCustomIdeListener = setupCustomIdeListener();

async function load(force = false): Promise<void> {
  if (inflight) return inflight;
  if (!force) {
    const cached = readCache();
    if (cached) {
      const customIdes = loadCustomIdes();
      state = { tools: cached.tools, checks: cached.checks, customIdes, loading: false, error: null };
      hydrated = true;
      emit();
      return;
    }
  }
  setState({ loading: true, error: null });
  inflight = (async () => {
    try {
      const tools = await invoke<ToolInfo[]>("get_all_tools");
      const results = await invoke<CheckResult[]>("check_tools");
      const checks: Record<string, CheckResult> = {};
      for (const r of results) checks[r.name] = r;
      const customIdes = loadCustomIdes();
      state = { tools, checks, customIdes, loading: false, error: null };
      hydrated = true;
      writeCache(tools, checks);
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

export const toolsStore = {
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
  /** Cleanup the custom IDE event listener (for tests). */
  destroy(): void {
    cleanupCustomIdeListener();
  },
};
