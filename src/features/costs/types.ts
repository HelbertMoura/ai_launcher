import { z } from "zod";

/**
 * Zod contracts for the usage wire payloads (v23 Cost Governance 3.0). They
 * mirror the Rust structs in `src-tauri/src/commands/config.rs` (post 3a:
 * `project_path` on entries, canonical `key`/`display_name` on top projects)
 * and the typed wrapper in `lib/tauri.ts`. Validation intentionally lives at
 * the store level — never inside `lib/tauri.ts` — following the `raceStore`
 * pattern.
 */

/**
 * One aggregated usage entry (per date/model/file-group on the backend).
 * `provider` and `project` stay optional for legacy seeds; `project_path`
 * (3a) carries the raw project directory when reliably known (Codex records
 * its `cwd`) and is null/absent for Claude, whose on-disk folder encoding is
 * not guaranteed to be reversible.
 */
export const UsageEntrySchema = z.object({
  date: z.string().min(1),
  cli: z.string().min(1),
  provider: z.string().nullable().optional(),
  model: z.string().nullable(),
  tokens_in: z.number(),
  tokens_out: z.number(),
  cost_estimate_usd: z.number(),
  project: z.string().nullable().optional(),
  project_path: z.string().nullable().optional(),
});
export type UsageEntry = z.infer<typeof UsageEntrySchema>;

/** Per-CLI rollup of the report (`by_cli` map value on the Rust side). */
export const CliUsageSummarySchema = z.object({
  tokens_in: z.number(),
  tokens_out: z.number(),
  cost_usd: z.number(),
  entries: z.number(),
});
export type CliUsageSummary = z.infer<typeof CliUsageSummarySchema>;

/**
 * One top-project aggregate (3a): `key` is the canonical grouping key
 * (normalized path when trusted, lowercased label otherwise) and
 * `display_name` the deterministic readable label. Optional here so older
 * seeds/payloads without the 3a fields still validate.
 */
export const ProjectUsageSchema = z.object({
  project: z.string(),
  key: z.string().optional(),
  display_name: z.string().optional(),
  cost_usd: z.number(),
  tokens: z.number(),
});
export type ProjectUsage = z.infer<typeof ProjectUsageSchema>;

/**
 * Full usage report payload. Totals/`by_cli`/`top_projects`/`warnings`
 * are optional: the backend always sends them, but tolerant parsing keeps
 * legacy fallbacks (`{ entries: [] }`) and e2e seeds valid.
 */
export const UsageReportSchema = z.object({
  entries: z.array(UsageEntrySchema),
  total_tokens_in: z.number().optional(),
  total_tokens_out: z.number().optional(),
  total_cost_usd: z.number().optional(),
  by_cli: z.record(z.string(), CliUsageSummarySchema).optional(),
  top_projects: z.array(ProjectUsageSchema).optional(),
  warnings: z.array(z.string()).optional(),
});
export type UsageReport = z.infer<typeof UsageReportSchema>;
