import type { CheckResult, ToolInfo } from "./useTools";
import {
  loadCustomIdes,
  CUSTOM_IDES_CHANGED_EVENT,
  type CustomIde,
} from "../../lib/customIdes";
import { createCatalogStore, type CatalogSnapshot } from "../shared/custom-entry/catalogStore";

/**
 * Thin wrapper over the shared catalog store keeping the legacy snapshot
 * shape (`tools` / `customIdes` field names) consumed by `useTools`.
 */
export interface ToolsSnapshot {
  tools: ToolInfo[];
  checks: Record<string, CheckResult>;
  customIdes: CustomIde[];
  loading: boolean;
  error: string | null;
}

const store = createCatalogStore<ToolInfo, CustomIde>({
  cacheKey: "ai-launcher:tools-cache",
  cacheItemsKey: "tools",
  listCommand: "get_all_tools",
  checkCommand: "check_tools",
  loadCustomEntries: loadCustomIdes,
  customChangedEvent: CUSTOM_IDES_CHANGED_EVENT,
});

let lastRaw: CatalogSnapshot<ToolInfo, CustomIde> | null = null;
let mapped: ToolsSnapshot = {
  tools: [],
  checks: {},
  customIdes: [],
  loading: true,
  error: null,
};

function toPublicSnapshot(raw: CatalogSnapshot<ToolInfo, CustomIde>): ToolsSnapshot {
  if (raw !== lastRaw) {
    lastRaw = raw;
    mapped = {
      tools: raw.items,
      checks: raw.checks,
      customIdes: raw.custom,
      loading: raw.loading,
      error: raw.error,
    };
  }
  return mapped;
}

export const toolsStore = {
  getSnapshot(): ToolsSnapshot {
    return toPublicSnapshot(store.getSnapshot());
  },
  isHydrated: store.isHydrated,
  subscribe: store.subscribe,
  ensureLoaded: store.ensureLoaded,
  refresh: store.refresh,
  invalidate: store.invalidate,
  destroy: store.destroy,
};
