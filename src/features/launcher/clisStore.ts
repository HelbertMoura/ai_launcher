import { invoke } from "@tauri-apps/api/core";
import type { CheckResult, CliInfo } from "./useClis";
import {
  loadCustomClis,
  CUSTOM_CLIS_CHANGED_EVENT,
  type CustomCli,
} from "../../lib/customClis";

const CACHE_KEY = "ai-launcher:clis-cache";
const TTL_MS = 10 * 60 * 1000; // 10 min

interface CachedPayload {
  clis: CliInfo[];
  checks: Record<string, CheckResult>;
  savedAt: number;
}

interface Snapshot {
  clis: CliInfo[];
  checks: Record<string, CheckResult>;
  customClis: CustomCli[];
  loading: boolean;
  error: string | null;
}

type Listener = (snap: Snapshot) => void;

let state: Snapshot = {
  clis: [],
  checks: {},
  customClis: [],
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

function writeCache(clis: CliInfo[], checks: Record<string, CheckResult>): void {
  try {
    const payload: CachedPayload = { clis, checks, savedAt: Date.now() };
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

/** Reload custom CLIs from localStorage and merge into snapshot. */
function mergeCustomClis(): void {
  const customClis = loadCustomClis();
  state = { ...state, customClis };
  emit();
}

/** Listen for same-tab custom CLI changes from the Admin panel. */
function setupCustomCliListener(): () => void {
  const handler = () => mergeCustomClis();
  window.addEventListener(CUSTOM_CLIS_CHANGED_EVENT, handler);
  return () => window.removeEventListener(CUSTOM_CLIS_CHANGED_EVENT, handler);
}

// Start listening once at module load
const cleanupCustomCliListener = setupCustomCliListener();

async function load(force = false): Promise<void> {
  if (inflight) return inflight;
  if (!force) {
    const cached = readCache();
    if (cached) {
      const customClis = loadCustomClis();
      state = { clis: cached.clis, checks: cached.checks, customClis, loading: false, error: null };
      hydrated = true;
      emit();
      return;
    }
  }
  setState({ loading: true, error: null });
  inflight = (async () => {
    try {
      const clis = await invoke<CliInfo[]>("get_all_clis");
      const results = await invoke<CheckResult[]>("check_clis");
      const checks: Record<string, CheckResult> = {};
      for (const r of results) checks[r.name] = r;
      const customClis = loadCustomClis();
      state = { clis, checks, customClis, loading: false, error: null };
      hydrated = true;
      writeCache(clis, checks);
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

export const clisStore = {
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
  /** Cleanup the custom CLI event listener (for tests). */
  destroy(): void {
    cleanupCustomCliListener();
  },
};
