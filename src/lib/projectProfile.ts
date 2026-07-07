// ==============================================================================
// AI Launcher Pro - Project Profile (.ailauncher.json) — B4
//
// A `.ailauncher.json` file committed at the root of a project declares the
// default CLI / provider / env / directory / MCP / runbook for that project.
// It is read at launch time so a teammate cloning the repo gets the same launch
// configuration without re-typing it.
//
// This module owns:
//   - the zod schema + tolerant parser (corrupt file -> error, never throws)
//   - reading the file from a chosen directory via a minimal Rust command
//   - the env merge with documented precedence: project > workspace > default
//
// The schema is intentionally permissive on unknown keys (.passthrough) so a
// newer `.ailauncher.json` written by a future version still parses here; we
// only validate the fields we consume.
// ==============================================================================

import { z } from "zod";
import { invokeOrFallback } from "./tauri";

/** Schema for a `.ailauncher.json` file. Every field except `version` is optional. */
export const projectProfileSchema = z
  .object({
    /** Schema version. Bump when the shape changes; reserved for future migrations. */
    version: z.number().int().positive().default(1),
    /** Preferred CLI key (e.g. "claude", "codex"). */
    cli: z.string().min(1).optional(),
    /** Preferred provider id (Claude provider profiles). */
    provider: z.string().min(1).optional(),
    /** Environment variables injected at launch (highest precedence). */
    env: z.record(z.string(), z.string()).optional(),
    /** Default working directory (absolute or relative to the project root). */
    directory: z.string().optional(),
    /** MCP server ids this project expects (schema-only in B4; not wired yet). */
    mcp: z.array(z.string()).optional(),
    /** Runbook id to suggest for this project (schema-only in B4). */
    runbook: z.string().optional(),
  })
  .passthrough();

/** Validated `.ailauncher.json` shape. */
export type ProjectProfile = z.infer<typeof projectProfileSchema>;

/** The canonical filename looked up at a project root. */
export const PROJECT_PROFILE_FILENAME = ".ailauncher.json";

/**
 * Parse a raw JSON string into a {@link ProjectProfile}.
 *
 * Returns `{ ok: true, profile }` on success, or `{ ok: false, error }` when the
 * string is not valid JSON or fails schema validation. Never throws — callers at
 * the UI boundary should surface `error` and continue without a profile.
 */
export function parseProjectProfile(
  raw: string,
): { ok: true; profile: ProjectProfile } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid JSON" };
  }
  const result = projectProfileSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, error: result.error.issues[0]?.message ?? "Invalid project profile" };
  }
  return { ok: true, profile: result.data };
}

/**
 * Read and parse `.ailauncher.json` from a chosen directory.
 *
 * Delegates the file read to the Rust `read_project_profile` command (returns
 * the file contents, or `null` when the file is absent). Returns:
 *   - the parsed profile when present and valid
 *   - `null` when the file does not exist (the common case — not an error)
 * Throws only when the file exists but cannot be read or parsed, so the caller
 * can warn the user that their committed profile is broken.
 */
export async function readProjectProfile(directory: string): Promise<ProjectProfile | null> {
  if (!directory.trim()) return null;
  const raw = await invokeOrFallback<string | null>(
    "read_project_profile",
    { directory },
    null,
  );
  if (raw == null) return null;
  const parsed = parseProjectProfile(raw);
  if (!parsed.ok) {
    throw new Error(`${PROJECT_PROFILE_FILENAME}: ${parsed.error}`);
  }
  return parsed.profile;
}

/**
 * Merge launch environment variables with documented precedence:
 *
 *   project  >  workspace  >  default
 *
 * Later sources win on key collisions. This is the fix for the "decorative
 * workspace" bug: until now `WorkspaceProfile.envVars` was persisted but never
 * applied to any launch. Now the active workspace's env (and the project's env)
 * are merged into the env passed to `launch_cli`.
 *
 * Any source may be `undefined`/`null` and is treated as empty. Returns a new
 * object (never mutates inputs).
 */
export function mergeLaunchEnv(
  defaults?: Record<string, string> | null,
  workspace?: Record<string, string> | null,
  project?: Record<string, string> | null,
): Record<string, string> {
  return {
    ...(defaults ?? {}),
    ...(workspace ?? {}),
    ...(project ?? {}),
  };
}
