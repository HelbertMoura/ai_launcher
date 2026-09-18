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

export async function openExternalUrl(url: string): Promise<void> {
  if (isTauriRuntime()) {
    try {
      await invoke("open_external_url", { url });
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
// Every direct `invoke` call lives here (or in a feature-level commands
// module when it needs domain types). Call sites never import
// `@tauri-apps/api/core` themselves; errors keep surfacing as raw strings so
// existing UI handling is unchanged.
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

// --- Tool / IDE launch --------------------------------------------------------

export function launchTool(toolKey: string, directory: string): Promise<string> {
  return invoke("launch_tool", { toolKey, directory });
}

export function launchCustomIde(launchCmd: string, directory: string): Promise<string> {
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

