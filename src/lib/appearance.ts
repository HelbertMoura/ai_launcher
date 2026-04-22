export type ThemeId = 'light' | 'dark';

export type AccentPresetId = 'ember' | 'coral' | 'amber' | 'sage' | 'slate';

export interface AccentPreset {
  id: AccentPresetId;
  name: string;
  color: string; // hex color
  description: string;
}

export const ACCENT_PRESETS: readonly AccentPreset[] = [
  { id: 'ember', name: 'Terracotta', color: '#E07A5F', description: 'Warm coral — signature accent of Soft Workbench.' },
  { id: 'coral', name: 'Coral', color: '#E8785F', description: 'Coral suave with presence mais leve.' },
  { id: 'amber', name: 'Amber', color: '#D4A017', description: 'Âmbar dourado com energia.' },
  { id: 'sage', name: 'Sage', color: '#7A9E7E', description: 'Verde sálvia contido e calmo.' },
  { id: 'slate', name: 'Slate', color: '#5C7A9E', description: 'Azul acinzentado suave e neutro.' },
] as const;

export const DEFAULT_ACCENT_PRESET: AccentPresetId = 'ember';
export const ACCENT_STORAGE_KEY = 'ai-launcher:accent-color';

export function isAccentPresetId(value: unknown): value is AccentPresetId {
  return typeof value === 'string' && ACCENT_PRESETS.some((preset) => preset.id === value);
}

export function applyAccentPreset(accentPreset: AccentPresetId): void {
  const preset = ACCENT_PRESETS.find(p => p.id === accentPreset);
  if (preset) {
    document.documentElement.setAttribute('data-accent', accentPreset);
    document.documentElement.style.setProperty('--accent', preset.color);
    document.documentElement.style.setProperty('--accent-hover', adjustBrightness(preset.color, -15));
    document.documentElement.style.setProperty('--accent-light', preset.color + '1f'); // ~12% opacity
  }
}

export function applyAccentColor(color: string): void {
  document.documentElement.removeAttribute('data-accent');
  document.documentElement.style.setProperty('--accent', color);
  document.documentElement.style.setProperty('--accent-hover', adjustBrightness(color, -15));
  document.documentElement.style.setProperty('--accent-light', color + '1f');
}

export function adjustBrightness(hex: string, percent: number): string {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + percent));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + percent));
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + percent));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export function applyTheme(theme: ThemeId): void {
  document.documentElement.setAttribute('data-theme', theme);
}

// --- Font stack management (migrated from providers/AppearanceSection.tsx in v10) ---

interface FontOption {
  readonly id: string;
  readonly name: string;
  readonly stack: string;
  readonly recommended?: boolean;
}

export const FONT_OPTIONS: readonly FontOption[] = [
  { id: 'jetbrains', name: 'JetBrains Mono', stack: "'JetBrains Mono', ui-monospace, monospace", recommended: true },
  { id: 'plex',      name: 'IBM Plex Mono',  stack: "'IBM Plex Mono', ui-monospace, monospace" },
  { id: 'cascadia',  name: 'Cascadia Code',  stack: "'Cascadia Code', ui-monospace, monospace" },
  { id: 'berkeley',  name: 'Berkeley Mono',  stack: "'Berkeley Mono', ui-monospace, monospace" },
  { id: 'system',    name: 'System mono',    stack: 'ui-monospace, monospace' },
] as const;

export type FontId = 'jetbrains' | 'plex' | 'cascadia' | 'berkeley' | 'system';

export const FONT_STORAGE_KEY = 'ai-launcher:display-font';

export function applyFontStack(id: FontId): void {
  const opt = FONT_OPTIONS.find(o => o.id === id);
  if (!opt) return;
  document.documentElement.style.setProperty('--ff-mono', opt.stack);
  document.documentElement.style.setProperty('--ff-display', opt.stack);
}