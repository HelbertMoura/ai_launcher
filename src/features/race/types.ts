import { z } from "zod";

/**
 * Zod contracts for the Race Mode wire payloads (v23.2). They mirror the Rust
 * structs in `src-tauri/src/commands/race.rs` and the typed wrappers in
 * `lib/tauri.ts`. Validation intentionally lives at the store level — never
 * inside `lib/tauri.ts` — following the `mcpStore` pattern.
 */

/**
 * Per-agent poll view (`status`: "running" | "completed" | "failed" |
 * "killed" | "unknown"). Statuses are validated as plain strings so a future
 * backend value degrades to the UI's "unknown" styling instead of rejecting
 * a structurally sound snapshot.
 */
export const RaceAgentStatusSchema = z.object({
  agent: z.string().min(1),
  status: z.string(),
  pid: z.number().nullable(),
  exit_code: z.number().nullable(),
  duration_secs: z.number().nullable(),
  last_log_lines: z.array(z.string()).default([]),
});
export type RaceAgentStatus = z.infer<typeof RaceAgentStatusSchema>;

/** Receipt of a started race; opaque handle for the other race commands. */
export const RaceHandleSchema = z.object({
  race_id: z.string().min(1),
  directory: z.string(),
  /** HEAD SHA frozen at start; diffs always use `base_sha...race-branch`. */
  base_sha: z.string().min(1),
  agents: z.array(z.string().min(1)).min(1),
  branches: z.array(z.string()),
  worktrees: z.array(z.string()),
  /** Limitation banners (submodules/LFS/dependencies) captured at start. */
  warnings: z.array(z.string()).default([]),
  started_at: z.string().min(1),
});
export type RaceHandle = z.infer<typeof RaceHandleSchema>;

/**
 * Lightweight poll snapshot (`status`: "running" | "completed" | "failed" |
 * "cancelled" | "adopted" | "cleaned").
 */
export const RaceSnapshotSchema = z.object({
  race_id: z.string().min(1),
  directory: z.string(),
  status: z.string(),
  base_sha: z.string(),
  started_at: z.string(),
  warnings: z.array(z.string()).default([]),
  agents: z.array(RaceAgentStatusSchema),
});
export type RaceSnapshot = z.infer<typeof RaceSnapshotSchema>;

/** Snapshot statuses that end the race from the UI's point of view. */
export const TERMINAL_SNAPSHOT_STATUSES = [
  "completed",
  "failed",
  "cancelled",
  "adopted",
  "cleaned",
] as const;

export function isTerminalSnapshotStatus(status: string): boolean {
  return (TERMINAL_SNAPSHOT_STATUSES as readonly string[]).includes(status);
}

/** One changed file in the diff (`null` adds/dels = binary file). */
export const RaceFileStatSchema = z.object({
  path: z.string().min(1),
  adds: z.number().nullable(),
  dels: z.number().nullable(),
});
export type RaceFileStat = z.infer<typeof RaceFileStatSchema>;

/** Result of `race_diff`: file stats plus the capped unified patch. */
export const DiffReportSchema = z.object({
  agent: z.string().min(1),
  files: z.array(RaceFileStatSchema),
  total_adds: z.number(),
  total_dels: z.number(),
  patch: z.string(),
  /** True when the patch hit the backend's 2 MB cap. */
  truncated: z.boolean(),
});
export type DiffReport = z.infer<typeof DiffReportSchema>;

/** Adoption strategy: `branch` (default safe) or `apply`. */
export const RaceAdoptModeSchema = z.enum(["branch", "apply"]);
export type RaceAdoptMode = z.infer<typeof RaceAdoptModeSchema>;

/** Result of `race_adopt` (report with per-file conflicts on apply mode). */
export const AdoptReportSchema = z.object({
  mode: RaceAdoptModeSchema,
  ok: z.boolean(),
  branch: z.string().nullable(),
  conflicts: z
    .array(z.object({ path: z.string(), reason: z.string() }))
    .default([]),
  message: z.string(),
});
export type AdoptReport = z.infer<typeof AdoptReportSchema>;

/** Result of `race_cleanup`. */
export const RaceCleanupReportSchema = z.object({
  race_id: z.string(),
  removed_worktrees: z.array(z.string()).default([]),
  removed_branches: z.array(z.string()).default([]),
  pruned: z.boolean(),
  /** Present when the retention window has not elapsed yet. */
  skipped_reason: z.string().nullable(),
});
export type RaceCleanupReport = z.infer<typeof RaceCleanupReportSchema>;

/**
 * One orphaned race from the boot-time scan (23.2d): a race recorded as
 * "running" with no live runtime — the app died mid-race. The record fields
 * (base SHA, branches, worktrees) allow the UI to rebuild a valid handle for
 * `race_recover`.
 */
export const RaceOrphanSchema = z.object({
  race_id: z.string().min(1),
  directory: z.string(),
  started_at: z.string().min(1),
  agents: z.array(z.string().min(1)).min(1),
  worktree_root: z.string(),
  base_sha: z.string().min(1),
  branches: z.array(z.string()).default([]),
  worktrees: z.array(z.string()).default([]),
});
export type RaceOrphan = z.infer<typeof RaceOrphanSchema>;

/** Result of `race_scan_orphans`. */
export const OrphanScanReportSchema = z.object({
  orphans: z.array(RaceOrphanSchema).default([]),
});

/**
 * One terminal race record of the graveyard section (23.2d). When
 * `worktrees_present` is false — or the status is "cleaned" — a restore can
 * only reopen the read-only archived record, never the live diffs.
 */
export const RaceHistoryEntrySchema = z.object({
  race_id: z.string().min(1),
  directory: z.string(),
  base_sha: z.string().min(1),
  status: z.string(),
  started_at: z.string().min(1),
  finished_at: z.string().nullable(),
  agents: z.array(z.string().min(1)).min(1),
  branches: z.array(z.string()).default([]),
  worktrees: z.array(z.string()).default([]),
  worktrees_present: z.boolean(),
});
export type RaceHistoryEntry = z.infer<typeof RaceHistoryEntrySchema>;
