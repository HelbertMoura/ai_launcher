// ==============================================================================
// AI Launcher Pro - Profile Migration
// Migrates legacy LaunchPreset + SessionTemplate data into unified LaunchProfile.
// ==============================================================================

import type { LaunchProfile } from './types';
import { z } from 'zod';
import { readKey, readScoped, writeKey, writeScoped } from '../lib/storage';

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
  return readKey('presets') as LegacyPreset[];
}

function readLegacyTemplates(): LegacyTemplate[] {
  return readScoped(LEGACY_TEMPLATES_KEY, z.array(z.unknown()), []) as LegacyTemplate[];
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
  if (readKey('profilesMigrated') === '1') return false;

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
  if (legacyPresets.length > 0) writeScoped(`${LEGACY_PRESETS_KEY}.bak`, z.array(z.unknown()), legacyPresets);
  if (legacyTemplates.length > 0) writeScoped(`${LEGACY_TEMPLATES_KEY}.bak`, z.array(z.unknown()), legacyTemplates);

  // Save unified profiles
  if (profiles.length > 0) {
    writeKey('profiles', profiles);
  }

  writeKey('profilesMigrated', '1');
  return true;
}
