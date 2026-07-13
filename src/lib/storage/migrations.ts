import { backupEntries, readRawForBackup, readKey, writeKey } from './index';

export const CURRENT_STORAGE_SCHEMA_VERSION = 1;

export interface StorageMigrationResult {
  ok: boolean;
  from: number;
  to: number;
  error?: string;
}

/**
 * Coordinates ordered, idempotent local migrations. The snapshot intentionally
 * walks only backup-safe registry entries, so credentials and transient keys
 * can never leak into the recovery manifest.
 */
export function migrateStorage(): StorageMigrationResult {
  const stored = Number.parseInt(readKey('schemaVersion'), 10);
  const from = Number.isFinite(stored) ? stored : 0;
  if (from >= CURRENT_STORAGE_SCHEMA_VERSION) return { ok: true, from, to: from };

  try {
    const backup = Object.fromEntries(
      backupEntries()
        .map((entry) => [entry.id, readRawForBackup(entry)] as const)
        .filter(([, value]) => value !== undefined),
    );
    writeKey('migrationManifest', {
      from,
      to: CURRENT_STORAGE_SCHEMA_VERSION,
      migratedAt: new Date().toISOString(),
      backup,
    });
    // Version 1 establishes the registry/manifest boundary. Existing key names
    // and payloads are retained, making this migration safe to run repeatedly.
    if (!writeKey('schemaVersion', String(CURRENT_STORAGE_SCHEMA_VERSION))) {
      throw new Error('storage schema version could not be persisted');
    }
    return { ok: true, from, to: CURRENT_STORAGE_SCHEMA_VERSION };
  } catch (error) {
    return { ok: false, from, to: CURRENT_STORAGE_SCHEMA_VERSION, error: error instanceof Error ? error.message : String(error) };
  }
}
