import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

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

interface State {
  tools: ToolInfo[];
  checks: Record<string, CheckResult>;
  loading: boolean;
  error: string | null;
}

export function useTools(): State & { refresh: () => Promise<void> } {
  const [state, setState] = useState<State>({
    tools: [],
    checks: {},
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const tools = await invoke<ToolInfo[]>("get_all_tools");
      const results = await invoke<CheckResult[]>("check_tools");
      const checks: Record<string, CheckResult> = {};
      for (const r of results) checks[r.name] = r;
      setState({ tools, checks, loading: false, error: null });
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
