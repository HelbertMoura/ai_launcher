import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface UsageEntry {
  date: string;
  cli: string;
  model: string | null;
  tokens_in: number;
  tokens_out: number;
  cost_estimate_usd: number;
  project?: string | null;
}

export interface UsageReport {
  entries: UsageEntry[];
  total_tokens_in?: number;
  total_tokens_out?: number;
  total_cost_usd?: number;
  warnings?: string[];
}

export function useUsage(): { report: UsageReport | null; loading: boolean; error: string | null } {
  const [report, setReport] = useState<UsageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await invoke<UsageReport>("read_usage_stats");
        setReport(r);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { report, loading, error };
}
