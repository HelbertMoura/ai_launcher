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
