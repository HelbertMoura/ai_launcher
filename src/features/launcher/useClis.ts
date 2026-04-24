import { useCallback, useEffect, useSyncExternalStore } from "react";
import { clisStore } from "./clisStore";
import type { CustomCli } from "../../lib/customClis";

export interface CliInfo {
  key: string;
  name: string;
  command: string;
  flag: string | null;
  install_cmd: string;
  version_cmd: string;
  npm_pkg: string | null;
  pip_pkg: string | null;
  install_method: string;
  install_url: string | null;
}

export interface CheckResult {
  name: string;
  installed: boolean;
  version: string | null;
  install_command: string | null;
}

interface State {
  clis: CliInfo[];
  checks: Record<string, CheckResult>;
  customClis: CustomCli[];
  loading: boolean;
  error: string | null;
}

export function useClis(): State & { refresh: () => Promise<void> } {
  const snapshot = useSyncExternalStore(
    (listener) => clisStore.subscribe(listener),
    () => clisStore.getSnapshot(),
    () => clisStore.getSnapshot(),
  );

  useEffect(() => {
    void clisStore.ensureLoaded();
  }, []);

  const refresh = useCallback(() => clisStore.refresh(), []);

  return { ...snapshot, refresh };
}
