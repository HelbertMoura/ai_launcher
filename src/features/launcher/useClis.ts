import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

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
  loading: boolean;
  error: string | null;
}

export function useClis(): State & { refresh: () => Promise<void> } {
  const [state, setState] = useState<State>({
    clis: [],
    checks: {},
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const clis = await invoke<CliInfo[]>("get_all_clis");
      const results = await invoke<CheckResult[]>("check_clis");
      const checks: Record<string, CheckResult> = {};
      for (const r of results) checks[r.name] = r;
      setState({ clis, checks, loading: false, error: null });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setState((s) => ({ ...s, loading: false, error: message }));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, refresh: load };
}
