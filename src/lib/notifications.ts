import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { readKey, writeKey } from "./storage";

export function isNotificationsEnabled(): boolean {
  return readKey("notificationsEnabled") === "true";
}

export function setNotificationsEnabled(enabled: boolean): void {
  writeKey("notificationsEnabled", enabled ? "true" : "false");
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
