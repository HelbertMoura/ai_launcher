import type { PrereqCheck } from "./usePrerequisites";
import { invokeOrFallback } from "../../lib/tauri";

const CACHE_KEY = "ai-launcher:environment-cache";
const TTL_MS = 10 * 60 * 1000; // 10 min

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
