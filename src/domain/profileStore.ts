// ==============================================================================
// AI Launcher Pro - Profile Store
// CRUD operations for LaunchProfile backed by localStorage.
// ==============================================================================

import type { LaunchProfile } from './types';
import { migrateIfNeeded } from './profileMigration';

const PROFILES_KEY = 'ai-launcher:v15:profiles';
const MAX_PROFILES = 64;

function readAll(): LaunchProfile[] {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(profiles: LaunchProfile[]): void {
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles.slice(0, MAX_PROFILES)));
  } catch {
    // ignore storage failures
  }
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
