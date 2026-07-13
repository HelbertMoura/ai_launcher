// ==============================================================================
// AI Launcher Pro - Unified persistence layer (T4)
// Typed read/write helpers backed by the central REGISTRY. Every access goes
// through zod safeParse on load (corrupt key -> default + warning, never crash)
// and centralized JSON.parse/stringify with try/catch.
//
// Usage:
//   import { readKey, writeKey } from '@/lib/storage';
//   const profiles = readKey('profiles');        // typed, validated, defaulted
//   writeKey('profiles', nextProfiles);
//
// MIGRATION DEBT (beta2): most existing call-sites still read/write localStorage
// directly. Migrated in T4: configIO.ts (export/import), profileStore.ts and
// workspaceStore.ts (the blind-cast stores). Still to migrate:
//   - runbookStore.ts, providers/budget.ts (already has its own zod), providers/storage.ts
//   - lib/customClis.ts, lib/customIdes.ts, lib/clisOverrides.ts, lib/notifications.ts
//   - lib/secrets.ts (secret fallback — must stay special-cased)
//   - hooks/useTheme, useAccent, useDensity, i18n/index, app/onboarding
//   - features/launcher/{LauncherPage cli-order, pinnedDirs, history, clisStore}
//   - features/history/useHistory (last-dir, recent-dirs), useSidebarIndicators
// These keep working untouched because the registry uses the SAME key strings.
// ==============================================================================

import { REGISTRY, type RegistryId, type RegistryEntry } from './registry';
import type { z } from 'zod';

export { STORAGE_KEYS } from './keys';
export type { StorageKeyId } from './keys';
export { REGISTRY, backupEntries, entryById } from './registry';
export type { RegistryId, RegistryEntry } from './registry';

type ValueOf<I extends RegistryId> = (typeof REGISTRY)[I] extends RegistryEntry<infer T>
  ? T
  : never;

function warn(scope: string, message: string, err?: unknown): void {
  // Centralized warning channel — keeps corruption visible without crashing.
  console.warn(`[storage:${scope}] ${message}`, err ?? '');
}

function cloneDefault<T>(value: T): T {
  return value !== null && typeof value === 'object' ? structuredClone(value) : value;
}

/** Low-level: read the raw deserialized value for an entry, or undefined. */
function rawRead(entry: RegistryEntry): unknown {
  let raw: string | null;
  try {
    raw = localStorage.getItem(entry.key);
  } catch (err) {
    warn(entry.id, 'localStorage.getItem failed', err);
    return undefined;
  }
  if (raw === null) return undefined;
  if (entry.serialize === 'raw') return raw;
  try {
    return JSON.parse(raw);
  } catch (err) {
    warn(entry.id, `corrupt JSON for "${entry.key}", falling back to default`, err);
    return undefined;
  }
}

/**
 * Read a known key. Returns the validated value, or the registry default when
 * the key is absent or the stored blob fails validation. Never throws.
 */
export function readKey<I extends RegistryId>(id: I): ValueOf<I> {
  const entry = REGISTRY[id] as RegistryEntry<ValueOf<I>>;
  const raw = rawRead(entry);
  if (raw === undefined) return cloneDefault(entry.default);
  const result = entry.schema.safeParse(raw);
  if (!result.success) {
    warn(entry.id, `validation failed for "${entry.key}", falling back to default`, result.error.issues[0]);
    return cloneDefault(entry.default);
  }
  return result.data;
}

/**
 * Write a known key. Validates the value before persisting so a programming
 * error can't write garbage that later loads as default. Returns false on
 * validation/serialization/storage failure (logged, never thrown).
 */
export function writeKey<I extends RegistryId>(id: I, value: unknown): boolean {
  const entry = REGISTRY[id] as RegistryEntry<ValueOf<I>>;
  const result = entry.schema.safeParse(value);
  if (!result.success) {
    warn(entry.id, `refused to write invalid value to "${entry.key}"`, result.error.issues[0]);
    return false;
  }
  try {
    const serialized =
      entry.serialize === 'raw'
        ? String(result.data)
        : JSON.stringify(result.data);
    localStorage.setItem(entry.key, serialized);
    return true;
  } catch (err) {
    warn(entry.id, `failed to persist "${entry.key}"`, err);
    return false;
  }
}

/** Remove a known key from storage. Never throws. */
export function removeKey(id: RegistryId): void {
  const entry = REGISTRY[id] as RegistryEntry;
  try {
    localStorage.removeItem(entry.key);
  } catch (err) {
    warn(entry.id, `failed to remove "${entry.key}"`, err);
  }
}

/** Validated access for namespaced keys such as pinned dirs and provider tests. */
export function readScoped<T>(key: string, schema: z.ZodType<T>, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const result = schema.safeParse(JSON.parse(raw));
    return result.success ? result.data : fallback;
  } catch (err) {
    warn(key, 'failed to read scoped value', err);
    return fallback;
  }
}

export function writeScoped<T>(key: string, schema: z.ZodType<T>, value: T): boolean {
  const result = schema.safeParse(value);
  if (!result.success) {
    warn(key, 'refused to write invalid scoped value', result.error.issues[0]);
    return false;
  }
  try {
    localStorage.setItem(key, JSON.stringify(result.data));
    return true;
  } catch (err) {
    warn(key, 'failed to persist scoped value', err);
    return false;
  }
}

export function removeScoped(key: string): void {
  try { localStorage.removeItem(key); } catch (err) { warn(key, 'failed to remove scoped value', err); }
}

export function readTextScoped(key: string): string | null {
  try { return localStorage.getItem(key); } catch (err) { warn(key, 'failed to read scoped text', err); return null; }
}

/** Restore/import helper for a registry entry selected at runtime. */
export function writeEntryValue(entry: RegistryEntry, value: unknown): boolean {
  const result = entry.schema.safeParse(value);
  if (!result.success) {
    warn(entry.id, `refused invalid imported value for "${entry.key}"`, result.error.issues[0]);
    return false;
  }
  try {
    localStorage.setItem(entry.key, entry.serialize === 'raw' ? String(result.data) : JSON.stringify(result.data));
    return true;
  } catch (err) {
    warn(entry.id, `failed to restore "${entry.key}"`, err);
    return false;
  }
}

/**
 * Read the raw value for a registry entry WITHOUT validation (used by backup
 * export so we round-trip whatever the user actually has, even if a future
 * field isn't in our schema yet). Returns undefined when absent.
 */
export function readRawForBackup(entry: RegistryEntry): unknown {
  return rawRead(entry);
}
