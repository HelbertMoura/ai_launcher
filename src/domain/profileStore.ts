// ==============================================================================
// AI Launcher Pro - Profile Store
// CRUD operations for LaunchProfile backed by localStorage.
// ==============================================================================

import type { LaunchProfile } from './types';
import { migrateIfNeeded } from './profileMigration';
import { readKey, writeKey } from '../lib/storage';

const MAX_PROFILES = 64;

// T4: persistence goes through the unified registry-backed helpers. readKey
// validates with zod and falls back to [] on corruption (never throws), so the
// previous manual try/catch + Array.isArray guard is no longer needed. The cast
// bridges the tolerant registry schema (.passthrough) and the strict
// LaunchProfile domain type — the registry intentionally validates loosely.
function readAll(): LaunchProfile[] {
  return readKey('profiles') as unknown as LaunchProfile[];
}

function writeAll(profiles: LaunchProfile[]): void {
  writeKey('profiles', profiles.slice(0, MAX_PROFILES) as never);
}

/** Ensure migration has run, then load all profiles. */
export function loadProfiles(): LaunchProfile[] {
  migrateIfNeeded();
  return readAll();
}

export function saveProfiles(profiles: LaunchProfile[]): void {
  writeAll(profiles);
}

export function addProfile(list: LaunchProfile[], profile: LaunchProfile): LaunchProfile[] {
  const next = [profile, ...list.filter(p => p.id !== profile.id)].slice(0, MAX_PROFILES);
  writeAll(next);
  return next;
}

export function removeProfile(list: LaunchProfile[], id: string): LaunchProfile[] {
  const next = list.filter(p => p.id !== id);
  writeAll(next);
  return next;
}

export function updateProfile(
  list: LaunchProfile[],
  id: string,
  patch: Partial<LaunchProfile>,
): LaunchProfile[] {
  const now = new Date().toISOString();
  const next = list.map(p => (p.id === id ? { ...p, ...patch, updatedAt: now } : p));
  writeAll(next);
  return next;
}

export function togglePin(list: LaunchProfile[], id: string): LaunchProfile[] {
  const now = new Date().toISOString();
  const next = list.map(p =>
    p.id === id ? { ...p, pinned: !p.pinned, updatedAt: now } : p,
  );
  writeAll(next);
  return next;
}

export function generateProfileId(): string {
  return `profile-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Export profiles as JSON string (no secrets). */
export function exportProfiles(profiles: LaunchProfile[]): string {
  const safe = profiles.map(({ ...p }) => p);
  return JSON.stringify(safe, null, 2);
}

/** Import profiles from JSON string. Returns merged list. */
export function importProfiles(
  current: LaunchProfile[],
  json: string,
): LaunchProfile[] | null {
  try {
    const incoming = JSON.parse(json);
    if (!Array.isArray(incoming)) return null;
    const existing = new Set(current.map(p => p.id));
    const merged = [...current];
    for (const p of incoming) {
      if (!existing.has(p.id)) {
        merged.push(p);
        existing.add(p.id);
      }
    }
    writeAll(merged);
    return merged;
  } catch {
    return null;
  }
}
