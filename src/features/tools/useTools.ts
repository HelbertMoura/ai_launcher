import { useCallback, useEffect, useSyncExternalStore } from "react";
import { toolsStore } from "./toolsStore";

export interface ToolInfo {
  key: string;
  name: string;
  command: string;
  install_hint: string;
  install_url: string | null;
}

export interface CheckResult {
  name: string;
  installed: boolean;
  version: string | null;
  install_command: string | null;
}

export function useTools() {
  const snap = useSyncExternalStore(
    toolsStore.subscribe,
    toolsStore.getSnapshot,
    toolsStore.getSnapshot,
  );

  useEffect(() => {
    void toolsStore.ensureLoaded();
  }, []);

  const refresh = useCallback(() => toolsStore.refresh(), []);

  return { ...snap, refresh };
}
