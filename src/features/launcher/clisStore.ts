import type { CheckResult, CliInfo } from "./useClis";
import {
  loadCustomClis,
  CUSTOM_CLIS_CHANGED_EVENT,
  type CustomCli,
} from "../../lib/customClis";
import { createCatalogStore, type CatalogSnapshot } from "../shared/custom-entry/catalogStore";

/**
 * Thin wrapper over the shared catalog store keeping the legacy snapshot
 * shape (`clis` / `customClis` field names) consumed by `useClis`.
 */
export interface ClisSnapshot {
  clis: CliInfo[];
  checks: Record<string, CheckResult>;
  customClis: CustomCli[];
  loading: boolean;
  error: string | null;
}

const store = createCatalogStore<CliInfo, CustomCli>({
  cacheKey: "ai-launcher:clis-cache",
  cacheItemsKey: "clis",
  listCommand: "get_all_clis",
  checkCommand: "check_clis",
  loadCustomEntries: loadCustomClis,
  customChangedEvent: CUSTOM_CLIS_CHANGED_EVENT,
});

let lastRaw: CatalogSnapshot<CliInfo, CustomCli> | null = null;
let mapped: ClisSnapshot = {
  clis: [],
  checks: {},
  customClis: [],
  loading: true,
  error: null,
};

function toPublicSnapshot(raw: CatalogSnapshot<CliInfo, CustomCli>): ClisSnapshot {
  if (raw !== lastRaw) {
    lastRaw = raw;
    mapped = {
      clis: raw.items,
      checks: raw.checks,
      customClis: raw.custom,
      loading: raw.loading,
      error: raw.error,
    };
  }
  return mapped;
}

export const clisStore = {
  getSnapshot(): ClisSnapshot {
    return toPublicSnapshot(store.getSnapshot());
  },
  isHydrated: store.isHydrated,
  subscribe: store.subscribe,
  ensureLoaded: store.ensureLoaded,
  refresh: store.refresh,
  invalidate: store.invalidate,
  destroy: store.destroy,
};
