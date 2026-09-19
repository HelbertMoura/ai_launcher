import { invokeOrFallback } from "../../../lib/tauri";

/**
 * Generic catalog store factory shared by the launcher (CLIs) and tools
 * (IDEs) features. Both stores are structural twins: a session-cached
 * snapshot of catalog items + install checks, merged with user-defined
 * custom entries that sync same-tab via a CustomEvent.
 */

export interface CatalogCheckResult {
  name: string;
  installed: boolean;
  version: string | null;
  install_command: string | null;
}

export interface CatalogSnapshot<TItem, TCustomEntry> {
  items: TItem[];
  checks: Record<string, CatalogCheckResult>;
  custom: TCustomEntry[];
  loading: boolean;
  error: string | null;
}

export interface CatalogStoreConfig<TCustomEntry> {
  /** sessionStorage cache key (legacy value must be preserved). */
  cacheKey: string;
  /** Field name of the item list inside the cached payload (legacy value). */
  cacheItemsKey: string;
  /** Tauri command listing the catalog items. */
  listCommand: string;
  /** Tauri command checking install state for the catalog items. */
  checkCommand: string;
  /** Reads user-defined custom entries from localStorage. */
  loadCustomEntries: () => TCustomEntry[];
  /** Same-tab event fired when custom entries change in the Admin panel. */
  customChangedEvent: string;
}

type Listener<TItem, TCustomEntry> = (
  snap: CatalogSnapshot<TItem, TCustomEntry>,
) => void;

export function createCatalogStore<TItem, TCustomEntry>(
  config: CatalogStoreConfig<TCustomEntry>,
) {
  const TTL_MS = 10 * 60 * 1000; // 10 min

  interface CachedPayload {
    checks: Record<string, CatalogCheckResult>;
    savedAt: number;
  }

  let state: CatalogSnapshot<TItem, TCustomEntry> = {
    items: [],
    checks: {},
    custom: [],
    loading: true,
    error: null,
  };

  const listeners = new Set<Listener<TItem, TCustomEntry>>();
  let inflight: Promise<void> | null = null;
  let hydrated = false;

  function readCache(): {
    items: TItem[];
    checks: Record<string, CatalogCheckResult>;
  } | null {
    try {
      const raw = sessionStorage.getItem(config.cacheKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CachedPayload & Record<string, unknown>;
      if (Date.now() - parsed.savedAt > TTL_MS) return null;
      const items = parsed[config.cacheItemsKey];
      if (!Array.isArray(items)) return null;
      return { items: items as TItem[], checks: parsed.checks };
    } catch {
      return null;
    }
  }

  function writeCache(
    items: TItem[],
    checks: Record<string, CatalogCheckResult>,
  ): void {
    try {
      const payload = {
        [config.cacheItemsKey]: items,
        checks,
        savedAt: Date.now(),
      };
      sessionStorage.setItem(config.cacheKey, JSON.stringify(payload));
    } catch {
      /* quota errors are non-fatal */
    }
  }

  function clearCache(): void {
    try {
      sessionStorage.removeItem(config.cacheKey);
    } catch {
      /* ignore */
    }
  }

  function emit(): void {
    for (const fn of listeners) fn(state);
  }

  function setState(partial: Partial<CatalogSnapshot<TItem, TCustomEntry>>): void {
    state = { ...state, ...partial };
    emit();
  }

  /** Reload custom entries from localStorage and merge into snapshot. */
  function mergeCustomEntries(): void {
    state = { ...state, custom: config.loadCustomEntries() };
    emit();
  }

  /** Listen for same-tab custom entry changes from the Admin panel. */
  function setupCustomEntryListener(): () => void {
    const handler = () => mergeCustomEntries();
    window.addEventListener(config.customChangedEvent, handler);
    return () => window.removeEventListener(config.customChangedEvent, handler);
  }

  // Start listening once at module load
  const cleanupCustomEntryListener = setupCustomEntryListener();

  async function load(force = false): Promise<void> {
    if (inflight) return inflight;
    if (!force) {
      const cached = readCache();
      if (cached) {
        state = {
          items: cached.items,
          checks: cached.checks,
          custom: config.loadCustomEntries(),
          loading: false,
          error: null,
        };
        hydrated = true;
        emit();
        return;
      }
    }
    setState({ loading: true, error: null });
    inflight = (async () => {
      try {
        const items = await invokeOrFallback<TItem[]>(
          config.listCommand,
          undefined,
          [],
        );
        const results = await invokeOrFallback<CatalogCheckResult[]>(
          config.checkCommand,
          undefined,
          [],
        );
        const checks: Record<string, CatalogCheckResult> = {};
        for (const r of results) checks[r.name] = r;
        state = {
          items,
          checks,
          custom: config.loadCustomEntries(),
          loading: false,
          error: null,
        };
        hydrated = true;
        writeCache(items, checks);
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

  return {
    getSnapshot(): CatalogSnapshot<TItem, TCustomEntry> {
      return state;
    },
    isHydrated(): boolean {
      return hydrated;
    },
    subscribe(listener: Listener<TItem, TCustomEntry>): () => void {
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
    /** Cleanup the custom entry event listener (for tests). */
    destroy(): void {
      cleanupCustomEntryListener();
    },
  };
}
