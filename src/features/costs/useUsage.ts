import { useEffect, useState } from "react";
import { invokeOrFallback } from "../../lib/tauri";

export interface UsageEntry {
  date: string;
  cli: string;
  /**
   * Logical provider behind the CLI (e.g. "anthropic" for Claude, "openai" for
   * Codex), sent by the backend (T1). The cli->provider mapping is NOT 1:1 —
   * several providers run through `claude` with env vars — so budgets group by
   * this field. May be null/absent for legacy entries; callers fall back to
   * `cli` as the provider in that case.
   */
  provider?: string | null;
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
        const r = await invokeOrFallback<UsageReport>(
          "read_usage_stats",
          undefined,
          { entries: [] },
        );
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
