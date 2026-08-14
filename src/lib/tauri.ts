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

