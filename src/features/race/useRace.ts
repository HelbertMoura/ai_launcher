import { useCallback, useSyncExternalStore } from "react";
import { raceStore, type RaceStartInput, type RaceState } from "./raceStore";

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

  return { ...state, beginConfiguration, start, cancel, resumePolling, reset };
}
