// ==============================================================================
// AI Launcher Pro - Secrets interface
// Frontend abstraction for secure secret storage via Tauri backend commands.
// Browser development uses memory-only storage; packaged builds fail closed.
// ==============================================================================

import { invoke } from '@tauri-apps/api/core';
import { isTauriRuntime } from './tauri';

const FALLBACK_PREFIX = 'ai-launcher-secret:';
const sessionSecrets = new Map<string, string>();

interface SecretStoreResult {
  stored: boolean;
  backend: string;
  migratedLegacy: boolean;
}

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
 * Store a secret securely. Browser development is memory-only; packaged builds
 * never downgrade to localStorage or another plaintext persistence mechanism.
 */
export async function storeSecret(key: string, value: string): Promise<void> {
  if (!key) return;
  if (!isTauriRuntime()) {
    sessionSecrets.set(key, value);
    return;
  }
  if (!(await hasSecureStorage())) {
    throw new Error('Secure credential storage is unavailable');
  }
  const result = await invoke<SecretStoreResult>('store_secret', { key, value });
  if (!result.stored || result.backend !== 'windows-credential-manager') {
    throw new Error('The credential was not stored by an approved secure backend');
  }
}

/**
 * Retrieve a secret.
 * Returns null if the key does not exist.
 */
export async function getSecret(key: string): Promise<string | null> {
  if (!key) return null;
  if (!isTauriRuntime()) {
    return sessionSecrets.get(key) ?? null;
  }
  if (!(await hasSecureStorage())) {
    throw new Error('Secure credential storage is unavailable');
  }
  return invoke<string | null>('get_secret', { key });
}

/**
 * Delete a secret.
 */
export async function deleteSecret(key: string): Promise<void> {
  if (!key) return;
  if (!isTauriRuntime()) {
    sessionSecrets.delete(key);
    return;
  }
  if (!(await hasSecureStorage())) {
    throw new Error('Secure credential storage is unavailable');
  }
  await invoke<boolean>('delete_secret', { key });
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
