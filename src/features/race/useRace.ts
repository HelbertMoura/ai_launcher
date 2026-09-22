import { useCallback, useSyncExternalStore } from "react";
import { raceStore, type RaceStartInput, type RaceState } from "./raceStore";
import type { RaceAdoptMode } from "./types";

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
  };
}
