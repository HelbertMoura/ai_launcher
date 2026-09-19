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

