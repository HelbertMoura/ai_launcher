import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

const TOGGLE_KEY = "ai-launcher:notifications-enabled";

export function isNotificationsEnabled(): boolean {
  try {
    return localStorage.getItem(TOGGLE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setNotificationsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(TOGGLE_KEY, enabled ? "true" : "false");
  } catch {
    /* ignore */
  }
}

export async function ensurePermissionThenNotify(
  title: string,
  body: string,
): Promise<void> {
  if (!isNotificationsEnabled()) return;
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      const status = await requestPermission();
      granted = status === "granted";
    }
    if (!granted) return;
    sendNotification({ title, body });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[notify] failed", err);
  }
}
