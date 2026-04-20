// ==============================================================================
// AI Launcher Pro - Launch Presets (storage)
// ==============================================================================

import type { LaunchPreset } from './types';

const STORAGE_KEY = 'ai-launcher-presets';
const MAX_PRESETS = 24;

export function loadPresets(): LaunchPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_PRESETS) : [];
  } catch {
    return [];
  }
}

export function savePresets(presets: LaunchPreset[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets.slice(0, MAX_PRESETS)));
  } catch (e) {
    console.error('[presets] falha ao salvar', e);
  }
}

export function addPreset(list: LaunchPreset[], preset: LaunchPreset): LaunchPreset[] {
  const next = [preset, ...list.filter(p => p.id !== preset.id)].slice(0, MAX_PRESETS);
  savePresets(next);
  return next;
}

export function removePreset(list: LaunchPreset[], id: string): LaunchPreset[] {
  const next = list.filter(p => p.id !== id);
  savePresets(next);
  return next;
}

export function updatePreset(list: LaunchPreset[], id: string, patch: Partial<LaunchPreset>): LaunchPreset[] {
  const next = list.map(p => (p.id === id ? { ...p, ...patch } : p));
  savePresets(next);
  return next;
}

export function generatePresetId(): string {
  return `preset-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}
