import { invoke } from "@tauri-apps/api/core";

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function invokeOrFallback<T>(
  command: string,
  args: Record<string, unknown> | undefined,
  fallback: T,
): Promise<T> {
  if (!isTauriRuntime()) return fallback;
  return invoke<T>(command, args);
}

/**
 * Raw `open_external_url` command: rejects on failure (no window.open
 * fallback), so call sites keep surfacing errors as raw strings.
 */
export function openExternalUrlCommand(url: string): Promise<string> {
  return invoke<string>("open_external_url", { url });
}

export async function openExternalUrl(url: string): Promise<void> {
  if (isTauriRuntime()) {
    try {
      await openExternalUrlCommand(url);
      return;
    } catch {
      // Fallback to window.open if Tauri command fails
    }
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

// ============================================================================
// Typed command layer
//
// This module is the canonical invoke layer for Tauri commands: new call
// sites go through these typed wrappers instead of importing
// `@tauri-apps/api/core` directly. A few legacy call sites still live
// outside this module and migrate in their own waves; errors keep surfacing
// as raw strings so existing UI handling is unchanged.
// ============================================================================

// --- Tray hotkey ------------------------------------------------------------

export function getTrayHotkey(): Promise<string> {
  return invoke<string>("get_tray_hotkey");
}

export function setTrayHotkey(hotkey: string): Promise<void> {
  return invoke("set_tray_hotkey", { hotkey });
}

// --- Sessions ---------------------------------------------------------------

export function killSession(sessionId: string): Promise<void> {
  return invoke("kill_session", { sessionId });
}

/** Raw `launch_cli` payload (`LaunchResult` on the Rust side). */
export interface LaunchCliCommandResult {
  session_id: string;
  message: string;
}

/** Args forwarded verbatim to `launch_cli`, so the wire payload is stable. */
export type LaunchCliCommandArgs = {
  cliKey: string;
  directory: string;
  args: string;
  noPerms: boolean;
  envVars: Record<string, string> | null;
};

export function launchCli(args: LaunchCliCommandArgs): Promise<LaunchCliCommandResult> {
  return invoke("launch_cli", args);
}

/** Args forwarded verbatim to `launch_custom_cli`, so the wire payload is stable. */
export type LaunchCustomCliCommandArgs = {
  command: string;
  args: string | null;
  directory: string;
  env: Record<string, string> | null;
};

export function launchCustomCli(
  args: LaunchCustomCliCommandArgs,
): Promise<LaunchCliCommandResult> {
  return invoke("launch_custom_cli", args);
}

// --- Tool / IDE launch --------------------------------------------------------

export function launchTool(toolKey: string, directory?: string | null): Promise<string> {
  // Omit the key entirely when no directory is given, matching the legacy
  // ad-hoc `{ toolKey }` payload byte for byte.
  return invoke("launch_tool", directory === undefined ? { toolKey } : { toolKey, directory });
}

export function launchCustomIde(launchCmd: string, directory: string | null): Promise<string> {
  return invoke("launch_custom_ide", { launchCmd, directory });
}

// --- Prerequisites / doctor -------------------------------------------------

export function installPrerequisite(key: string): Promise<void> {
  return invoke("install_prerequisite", { key });
}

/** Result of the `cleanup_system_cache` doctor command. */
export interface CleanupSystemCacheResult {
  healed_stubs: number;
  cleaned_temp_files: number;
  message: string;
}

export function cleanupSystemCache(): Promise<CleanupSystemCacheResult> {
  return invoke<CleanupSystemCacheResult>("cleanup_system_cache");
}

// --- CLI / tool maintenance (updates page) -----------------------------------

export function updateAllClis(): Promise<void> {
  return invoke("update_all_clis");
}

/**
 * Typed runners for the maintenance commands surfaced on the updates page.
 * Each entry forwards the exact args object it receives, so the wire payload
 * is identical to the previous ad-hoc `invoke(cmd, args)` calls.
 */
export const maintenanceCommands = {
  update_cli: (args: { cliKey: string }) => invoke("update_cli", args),
  install_cli: (args: { cliKey: string; timeoutSec: number | null }) =>
    invoke("install_cli", args),
  install_tool: (args: { toolKey: string }) => invoke("install_tool", args),
  install_prerequisite: (args: { key: string }) => installPrerequisite(args.key),
} as const;

export type MaintenanceCommand = keyof typeof maintenanceCommands;

export type MaintenanceCommandArgs = {
  [K in MaintenanceCommand]: Parameters<(typeof maintenanceCommands)[K]>[0];
}[MaintenanceCommand];

export function runMaintenanceCommand<T extends MaintenanceCommand>(
  cmd: T,
  args: Parameters<(typeof maintenanceCommands)[T]>[0],
): Promise<void> {
  // Internal cast only: TS cannot correlate `cmd` and `args` generics here,
  // but the public signature guarantees the pair already matches.
  const runner = maintenanceCommands[cmd] as (a: MaintenanceCommandArgs) => Promise<void>;
  return runner(args);
}

// --- App update ---------------------------------------------------------------

/** Raw `check_app_update` payload (`AppUpdateInfo` on the Rust side). */
export interface AppUpdateInfo {
  update_available: boolean;
  version: string;
  current_version: string;
  release_notes_url: string;
  release_notes_body: string;
}

/** Raw `download_verified_app_update` payload. */
export interface AppUpdateDownloadResult {
  version: string;
  asset_name: string;
}

export function checkAppUpdate(): Promise<AppUpdateInfo> {
  return invoke<AppUpdateInfo>("check_app_update");
}

export function downloadVerifiedAppUpdate(version: string): Promise<AppUpdateDownloadResult> {
  return invoke("download_verified_app_update", { version });
}

// ============================================================================
// Race Mode (v23.2)
//
// Wire payloads mirror the Rust structs in `src-tauri/src/commands/race.rs`
// (snake_case fields, serde defaults). A race handle is the opaque receipt
// returned by `race_start` and passed back to every other race command.
// ============================================================================

/** Receipt of a started race; opaque handle for the other race commands. */
export interface RaceHandle {
  race_id: string;
  directory: string;
  /** HEAD SHA frozen at start; diffs always use `base_sha...race-branch`. */
  base_sha: string;
  agents: string[];
  branches: string[];
  worktrees: string[];
  /** Limitation banners (submodules/LFS/dependencies) captured at start. */
  warnings: string[];
  started_at: string;
}

/** Per-agent poll view (`status`: running | completed | failed | killed | unknown). */
export interface RaceAgentStatus {
  agent: string;
  status: string;
  pid: number | null;
  exit_code: number | null;
  duration_secs: number | null;
  last_log_lines: string[];
}

/** Lightweight poll snapshot (`status`: running | completed | failed | cancelled | adopted | cleaned). */
export interface RaceSnapshot {
  race_id: string;
  directory: string;
  status: string;
  base_sha: string;
  started_at: string;
  warnings: string[];
  agents: RaceAgentStatus[];
}

/** One changed file (`null` adds/dels = binary file). */
export interface RaceFileStat {
  path: string;
  adds: number | null;
  dels: number | null;
}

/** Diff of one agent against the frozen base; patch capped at 2 MB. */
export interface DiffReport {
  agent: string;
  files: RaceFileStat[];
  total_adds: number;
  total_dels: number;
  patch: string;
  truncated: boolean;
}

export type RaceAdoptMode = "branch" | "apply";

/** One file that could not be applied (apply mode conflict report). */
export interface AdoptConflict {
  path: string;
  reason: string;
}

export interface AdoptReport {
  mode: RaceAdoptMode;
  ok: boolean;
  branch: string | null;
  conflicts: AdoptConflict[];
  message: string;
}

export interface RaceCleanupReport {
  race_id: string;
  removed_worktrees: string[];
  removed_branches: string[];
  pruned: boolean;
  skipped_reason: string | null;
  /** Recover only: persisted pids NOT killed (identity unverified). */
  unverified_processes: string[];
}

/** One orphaned race found by the boot-time scan (wired in 23.2d). */
export interface RaceOrphan {
  race_id: string;
  directory: string;
  started_at: string;
  agents: string[];
  worktree_root: string;
  /** Frozen base SHA + branches/worktrees, enough to rebuild a handle. */
  base_sha: string;
  branches: string[];
  worktrees: string[];
}

export interface OrphanScanReport {
  orphans: RaceOrphan[];
}

/** One terminal race record for the "Corridas anteriores" section (23.2d). */
export interface RaceHistoryEntry {
  race_id: string;
  directory: string;
  base_sha: string;
  /** completed | failed | cancelled | adopted | cleaned */
  status: string;
  started_at: string;
  finished_at: string | null;
  agents: string[];
  branches: string[];
  worktrees: string[];
  /** All worktrees still on disk → restore reopens the live cockpit. */
  worktrees_present: boolean;
}

export function raceStart(
  directory: string,
  taskPrompt: string,
  agents: string[],
): Promise<RaceHandle> {
  return invoke<RaceHandle>("race_start", { directory, taskPrompt, agents });
}

export function raceStatus(handle: RaceHandle): Promise<RaceSnapshot> {
  return invoke<RaceSnapshot>("race_status", { handle });
}

export function raceDiff(handle: RaceHandle, agent: string): Promise<DiffReport> {
  return invoke<DiffReport>("race_diff", { handle, agent });
}

export function raceAdopt(
  handle: RaceHandle,
  agent: string,
  mode: RaceAdoptMode = "branch",
): Promise<AdoptReport> {
  return invoke<AdoptReport>("race_adopt", { handle, agent, mode });
}

export function raceCancel(handle: RaceHandle): Promise<void> {
  return invoke("race_cancel", { handle });
}

export function raceCleanup(handle: RaceHandle, keepDays?: number): Promise<RaceCleanupReport> {
  return invoke<RaceCleanupReport>("race_cleanup", { handle, keepDays: keepDays ?? null });
}

export function raceScanOrphans(): Promise<OrphanScanReport> {
  return invoke<OrphanScanReport>("race_scan_orphans");
}

/** Kills the persisted agent pids of an orphaned race and cleans it up now. */
export function raceRecover(handle: RaceHandle): Promise<RaceCleanupReport> {
  return invoke<RaceCleanupReport>("race_recover", { handle });
}

/** Graveyard listing: terminal race records, newest first. */
export function raceListHistory(): Promise<RaceHistoryEntry[]> {
  return invoke<RaceHistoryEntry[]>("race_list_history");
}

