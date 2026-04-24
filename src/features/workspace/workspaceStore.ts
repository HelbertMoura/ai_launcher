// ==============================================================================
// AI Launcher Pro - Workspace Profile Store
// CRUD operations for WorkspaceProfile backed by localStorage.
// ==============================================================================

import type { WorkspaceProfile } from "../../domain/types";

const STORE_KEY = "ai-launcher:v15:workspace";
const ACTIVE_KEY = "ai-launcher:v15:active-workspace";
const MAX_PROFILES = 64;

/** Keys that look like secrets — redacted during export. */
const SECRET_PATTERNS = [/key/i, /token/i, /secret/i, /password/i, /auth/i, /credential/i];

function isSecretKey(key: string): boolean {
  return SECRET_PATTERNS.some((p) => p.test(key));
}

function readAll(): WorkspaceProfile[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(profiles: WorkspaceProfile[]): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(profiles.slice(0, MAX_PROFILES)));
  } catch {
    // ignore storage failures
  }
}

export function loadWorkspaces(): WorkspaceProfile[] {
  return readAll();
}

export function saveWorkspaces(profiles: WorkspaceProfile[]): void {
  writeAll(profiles);
}

export function addWorkspace(list: WorkspaceProfile[], profile: WorkspaceProfile): WorkspaceProfile[] {
  const next = [profile, ...list.filter((p) => p.id !== profile.id)].slice(0, MAX_PROFILES);
  writeAll(next);
  return next;
}

export function removeWorkspace(list: WorkspaceProfile[], id: string): WorkspaceProfile[] {
  const next = list.filter((p) => p.id !== id);
  writeAll(next);
  // Clear active if removed
  if (getActiveWorkspaceId() === id) {
    setActiveWorkspaceId(null);
  }
  return next;
}

export function updateWorkspace(
  list: WorkspaceProfile[],
  id: string,
  patch: Partial<WorkspaceProfile>,
): WorkspaceProfile[] {
  const now = new Date().toISOString();
  const next = list.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: now } : p));
  writeAll(next);
  return next;
}

export function togglePin(list: WorkspaceProfile[], id: string): WorkspaceProfile[] {
  const now = new Date().toISOString();
  const next = list.map((p) =>
    p.id === id ? { ...p, pinned: !p.pinned, updatedAt: now } : p,
  );
  writeAll(next);
  return next;
}

export function generateWorkspaceId(): string {
  return `ws-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Export profiles as JSON string with secrets redacted. */
export function exportWorkspaces(profiles: WorkspaceProfile[]): string {
  const safe = profiles.map((p) => ({
    ...p,
    envVars: Object.fromEntries(
      Object.entries(p.envVars).map(([k, v]) => [
        k,
        isSecretKey(k) ? "••••••••" : v,
      ]),
    ),
  }));
  return JSON.stringify(safe, null, 2);
}

/** Import profiles from JSON string. Returns merged list or null on failure. */
export function importWorkspaces(
  current: WorkspaceProfile[],
  json: string,
): WorkspaceProfile[] | null {
  try {
    const incoming = JSON.parse(json);
    if (!Array.isArray(incoming)) return null;
    const existing = new Set(current.map((p) => p.id));
    const merged = [...current];
    for (const p of incoming as WorkspaceProfile[]) {
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

// --- Active workspace ---

export function getActiveWorkspaceId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function setActiveWorkspaceId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(ACTIVE_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_KEY);
    }
  } catch {
    // ignore
  }
}

export function getActiveWorkspace(list: WorkspaceProfile[]): WorkspaceProfile | null {
  const id = getActiveWorkspaceId();
  if (!id) return null;
  return list.find((p) => p.id === id) ?? null;
}
