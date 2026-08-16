import { useCallback, useEffect, useSyncExternalStore } from "react";
import { environmentStore } from "./environmentStore";

export interface PrereqCheck {
  /** Canonical key used by install_prerequisite (e.g. "node", "git", "vscode"). */
  key: string;
  name: string;
  installed: boolean;
  version: string | null;
  install_command: string | null;
}

export function usePrerequisites() {
  const snap = useSyncExternalStore(
    environmentStore.subscribe,
    environmentStore.getSnapshot,
    environmentStore.getSnapshot,
  );

  useEffect(() => {
    void environmentStore.ensureLoaded();
  }, []);

  const refresh = useCallback(() => environmentStore.refresh(), []);

  return { ...snap, refresh };
}
