export type ThemeId = 'light' | 'dark';

export type AccentPresetId = 'ember' | 'coral' | 'rose' | 'sage' | 'mist';

export interface AccentPreset {
  id: AccentPresetId;
  name: string;
  description: string;
}

export const ACCENT_PRESETS: readonly AccentPreset[] = [
  { id: 'ember', name: 'Ember', description: 'Vermelho quente e assinatura principal da v9.' },
  { id: 'coral', name: 'Coral', description: 'Coral suave com presença mais leve.' },
  { id: 'rose', name: 'Rose', description: 'Rosa antigo mais editorial.' },
  { id: 'sage', name: 'Sage', description: 'Verde sálvia contido e calmo.' },
  { id: 'mist', name: 'Mist', description: 'Azul acinzentado suave e neutro.' },
] as const;

export const DEFAULT_ACCENT_PRESET: AccentPresetId = 'ember';

export function isAccentPresetId(value: unknown): value is AccentPresetId {
  return typeof value === 'string' && ACCENT_PRESETS.some((preset) => preset.id === value);
}

export function applyTheme(theme: ThemeId): void {
  document.documentElement.setAttribute('data-theme', theme);
}

export function applyAccentPreset(accentPreset: AccentPresetId): void {
  document.documentElement.setAttribute('data-accent', accentPreset);
}
