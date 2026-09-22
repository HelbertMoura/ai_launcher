import { useCallback, useSyncExternalStore } from "react";
import { raceStore, type RaceStartInput, type RaceState } from "./raceStore";
import type { RaceAdoptMode, RaceHistoryEntry, RaceOrphan } from "./types";

/**
 * React binding for `raceStore` (useSyncExternalStore), mirroring `useMcp`.
 * Actions are the stable module-level store methods, so they are safe to
 * spread into effect dependencies.
 */
export function useRace(): RaceState & {
  beginConfiguration: () => void;
  start: (input: RaceStartInput) => Promise<void>;
  cancel: () => Promise<void>;
  resumePolling: () => void;
  reset: () => void;
  loadDiff: (agent: string) => Promise<void>;
  adopt: (agent: string, mode: RaceAdoptMode) => Promise<void>;
  cleanup: (keepDays?: number) => Promise<void>;
  loadHistory: () => Promise<void>;
  restoreFromHistory: (entry: RaceHistoryEntry) => Promise<void>;
  cleanupFromHistory: (entry: RaceHistoryEntry) => Promise<void>;
  scanOrphans: () => Promise<void>;
  recoverOrphan: (orphan: RaceOrphan) => Promise<void>;
  inspectOrphan: (raceId: string | null) => void;
} {
  const state = useSyncExternalStore(
    (listener) => raceStore.subscribe(listener),
    () => raceStore.getSnapshot(),
    () => raceStore.getSnapshot(),
  );

  const beginConfiguration = useCallback(() => raceStore.beginConfiguration(), []);
  const start = useCallback((input: RaceStartInput) => raceStore.start(input), []);
  const cancel = useCallback(() => raceStore.cancel(), []);
  const resumePolling = useCallback(() => raceStore.resumePolling(), []);
  const reset = useCallback(() => raceStore.reset(), []);
  const loadDiff = useCallback((agent: string) => raceStore.loadDiff(agent), []);
  const adopt = useCallback(
    (agent: string, mode: RaceAdoptMode) => raceStore.adopt(agent, mode),
    [],
  );
  const cleanup = useCallback((keepDays?: number) => raceStore.cleanup(keepDays), []);
  const loadHistory = useCallback(() => raceStore.loadHistory(), []);
  const restoreFromHistory = useCallback(
    (entry: RaceHistoryEntry) => raceStore.restoreFromHistory(entry),
    [],
  );
  const cleanupFromHistory = useCallback(
    (entry: RaceHistoryEntry) => raceStore.cleanupFromHistory(entry),
    [],
  );
  const scanOrphans = useCallback(() => raceStore.scanOrphans(), []);
  const recoverOrphan = useCallback((orphan: RaceOrphan) => raceStore.recoverOrphan(orphan), []);
  const inspectOrphan = useCallback(
    (raceId: string | null) => raceStore.inspectOrphan(raceId),
    [],
  );

  return {
    ...state,
    beginConfiguration,
    start,
    cancel,
    resumePolling,
    reset,
    loadDiff,
    adopt,
    cleanup,
    loadHistory,
    restoreFromHistory,
    cleanupFromHistory,
    scanOrphans,
    recoverOrphan,
    inspectOrphan,
  };
}
