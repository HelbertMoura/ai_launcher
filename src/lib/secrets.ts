// ==============================================================================
// AI Launcher Pro - Secrets interface
// Frontend abstraction for secure secret storage via Tauri backend commands.
// Falls back to localStorage when Tauri backend is unavailable.
// ==============================================================================

import { invoke } from '@tauri-apps/api/core';

const FALLBACK_PREFIX = 'ai-launcher-secret:';

/**
 * Whether the Tauri backend with secure storage is available.
 * Cached after first check to avoid repeated PowerShell probes.
 */
let _secureAvailable: boolean | null = null;

/**
 * Check if the Tauri secure storage backend is available.
 * Returns false when running in browser (dev mode) or when DPAPI is unavailable.
 */
export async function hasSecureStorage(): Promise<boolean> {
  if (_secureAvailable !== null) return _secureAvailable;
  try {
    _secureAvailable = await invoke<boolean>('has_secure_storage');
  } catch {
    _secureAvailable = false;
  }
  return _secureAvailable;
}

/**
 * Store a secret securely.
 * Falls back to localStorage when secure storage is unavailable.
 */
export async function storeSecret(key: string, value: string): Promise<void> {
  if (!key) return;
  try {
    const secure = await hasSecureStorage();
    if (secure) {
      await invoke<boolean>('store_secret', { key, value });
      return;
    }
  } catch {
    // Tauri backend unavailable (e.g. browser dev mode)
  }
  // Fallback: localStorage (NOT secure, but better than nothing)
  localStorage.setItem(`${FALLBACK_PREFIX}${key}`, value);
}

/**
 * Retrieve a secret.
 * Returns null if the key does not exist.
 */
export async function getSecret(key: string): Promise<string | null> {
  if (!key) return null;
  try {
    const secure = await hasSecureStorage();
    if (secure) {
      return await invoke<string | null>('get_secret', { key });
    }
  } catch {
    // Tauri backend unavailable
  }
  // Fallback: localStorage
  return localStorage.getItem(`${FALLBACK_PREFIX}${key}`);
}

/**
 * Delete a secret.
 */
export async function deleteSecret(key: string): Promise<void> {
  if (!key) return;
  try {
    const secure = await hasSecureStorage();
    if (secure) {
      await invoke<boolean>('delete_secret', { key });
      return;
    }
  } catch {
    // Tauri backend unavailable
  }
  // Fallback: localStorage
  localStorage.removeItem(`${FALLBACK_PREFIX}${key}`);
}

/**
 * Migrate secrets from localStorage to secure storage.
 * Called once on app startup when secure storage becomes available.
 * Returns the number of keys migrated.
 */
export async function migrateFromLocalStorage(
  keys: string[],
): Promise<number> {
  let migrated = 0;
  const secure = await hasSecureStorage();
  if (!secure) return 0;

  for (const key of keys) {
    const lsKey = `${FALLBACK_PREFIX}${key}`;
    const value = localStorage.getItem(lsKey);
    if (value) {
      try {
        await invoke<boolean>('store_secret', { key, value });
        localStorage.removeItem(lsKey);
        migrated++;
      } catch {
        // Skip this key on failure
      }
    }
  }
  return migrated;
}
