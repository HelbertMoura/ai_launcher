// ==============================================================================
// AI Launcher Pro - Profile Migration
// Migrates legacy LaunchPreset + SessionTemplate data into unified LaunchProfile.
// ==============================================================================

import type { LaunchProfile } from './types';

const PROFILES_KEY = 'ai-launcher:v15:profiles';
const MIGRATION_KEY = 'ai-launcher:v15:migrated';

// Legacy keys
const LEGACY_PRESETS_KEY = 'ai-launcher-presets';
const LEGACY_TEMPLATES_KEY = 'ai-launcher:session-templates';

interface LegacyPreset {
  id: string;
  name: string;
  cliKey: string;
  providerId?: string;
  directory: string;
  args: string;
  noPerms: boolean;
  color?: string;
  emoji?: string;
  createdAt: string;
}

interface LegacyTemplate {
  id: string;
  name: string;
  cliKey: string;
  cliName: string;
  directory: string;
  args: string;
  noPerms: boolean;
  providerId: string | null;
  createdAt: string;
}

function readLegacyPresets(): LegacyPreset[] {
  try {
    const raw = localStorage.getItem(LEGACY_PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readLegacyTemplates(): LegacyTemplate[] {
  try {
    const raw = localStorage.getItem(LEGACY_TEMPLATES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function presetToProfile(p: LegacyPreset): LaunchProfile {
  const now = new Date().toISOString();
  return {
    id: p.id,
    name: p.name,
    description: undefined,
    directory: p.directory || undefined,
    cliKeys: p.cliKey ? [p.cliKey] : [],
    toolKeys: [],
    providerKey: p.providerId || undefined,
    args: p.args || undefined,
    noPerms: p.noPerms,
    clipboardPrompt: undefined,
    tags: p.emoji ? [p.emoji] : [],
    pinned: false,
    createdAt: p.createdAt || now,
    updatedAt: now,
  };
}

function templateToProfile(t: LegacyTemplate): LaunchProfile {
  const now = new Date().toISOString();
  return {
    id: t.id,
    name: t.name,
    description: undefined,
    directory: t.directory || undefined,
    cliKeys: t.cliKey ? [t.cliKey] : [],
    toolKeys: [],
    providerKey: t.providerId || undefined,
    args: t.args || undefined,
    noPerms: t.noPerms,
    clipboardPrompt: undefined,
    tags: [],
    pinned: false,
    createdAt: t.createdAt || now,
    updatedAt: now,
  };
}

/**
 * Run migration once. Returns true if migration was performed.
 * Idempotent — safe to call on every app load.
 */
export function migrateIfNeeded(): boolean {
  if (localStorage.getItem(MIGRATION_KEY) === '1') return false;

  const legacyPresets = readLegacyPresets();
  const legacyTemplates = readLegacyTemplates();

  // Deduplicate by id (presets take priority)
  const seen = new Set<string>();
  const profiles: LaunchProfile[] = [];

  for (const p of legacyPresets) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      profiles.push(presetToProfile(p));
    }
  }
  for (const t of legacyTemplates) {
    if (!seen.has(t.id)) {
      seen.add(t.id);
      profiles.push(templateToProfile(t));
    }
  }

  // Backup old data before writing new
  try {
    if (legacyPresets.length > 0) {
      localStorage.setItem(`${LEGACY_PRESETS_KEY}.bak`, JSON.stringify(legacyPresets));
    }
    if (legacyTemplates.length > 0) {
      localStorage.setItem(`${LEGACY_TEMPLATES_KEY}.bak`, JSON.stringify(legacyTemplates));
    }
  } catch {
    // Backup failure should not block migration
  }

  // Save unified profiles
  if (profiles.length > 0) {
    try {
      localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
    } catch {
      // Storage write failure
    }
  }

  localStorage.setItem(MIGRATION_KEY, '1');
  return true;
}
