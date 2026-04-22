// ==============================================================================
// AI Launcher Pro - Appearance Section
// Seletor de fonte de exibição com persistência em localStorage.
// Aplica --ff-mono e --ff-display no :root.
// ==============================================================================

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Type } from '../icons';
import { ACCENT_PRESETS, type AccentPresetId } from '../lib/appearance';
import './AppearanceSection.css';

interface FontOption {
  readonly id: string;
  readonly name: string;
  readonly stack: string;
  readonly recommended?: boolean;
}

const FONT_OPTIONS: readonly FontOption[] = [
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

interface AppearanceSectionProps {
  accentPreset: AccentPresetId;
  onAccentChange: (accentPreset: AccentPresetId) => void;
}

export function AppearanceSection({ accentPreset, onAccentChange }: AppearanceSectionProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<FontId>(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(FONT_STORAGE_KEY) : null;
    return (saved as FontId) || 'jetbrains';
  });

  useEffect(() => {
    applyFontStack(selected);
    try { localStorage.setItem(FONT_STORAGE_KEY, selected); } catch { /* noop */ }
  }, [selected]);

  const currentStack = FONT_OPTIONS.find(o => o.id === selected)?.stack;

  return (
    <section className="admin-section appearance-section">
      <h3 className="appearance-section__title">
        <Type size={14} strokeWidth={1.5} aria-hidden="true" />
        <span>{t('admin.appearance.title')}</span>
      </h3>
      <div role="radiogroup" aria-label={t('admin.appearance.fontAria')} className="appearance-options">
        {FONT_OPTIONS.map(opt => (
          <label key={opt.id} className={`appearance-option${selected === opt.id ? ' is-active' : ''}`}>
            <input
              type="radio"
              name="display-font"
              value={opt.id}
              checked={selected === opt.id}
              onChange={() => setSelected(opt.id as FontId)}
            />
            <span className="appearance-option__name">{opt.name}</span>
            {opt.recommended && <span className="appearance-option__badge">{t('admin.appearance.recommended')}</span>}
          </label>
        ))}
      </div>
      <div className="appearance-accent">
        <div className="appearance-accent__head">
          <span className="appearance-accent__title">{t('admin.appearance.accentTitle')}</span>
          <span className="appearance-accent__hint">{t('admin.appearance.accentHint')}</span>
        </div>

        {/* Color preset circles */}
        <div className="accent-picker" role="radiogroup" aria-label={t('admin.appearance.accentAria')}>
          {ACCENT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`accent-preset${accentPreset === preset.id ? ' is-active' : ''}`}
              style={{ '--preset-color': preset.color } as React.CSSProperties}
              onClick={() => onAccentChange(preset.id)}
              title={preset.name}
              aria-label={preset.name}
              aria-pressed={accentPreset === preset.id}
            />
          ))}
          {/* Custom color button */}
          <label className="accent-custom" title={t('admin.appearance.customColor')}>
            <input
              type="color"
              className="accent-custom__input"
              defaultValue={ACCENT_PRESETS.find(p => p.id === accentPreset)?.color ?? '#E07A5F'}
              onChange={(e) => {
                onAccentChange(e.target.value as unknown as AccentPresetId);
              }}
            />
            <span className="accent-custom__icon">+</span>
          </label>
        </div>
      </div>
      <div className="appearance-preview" style={{ fontFamily: currentStack }}>
        abc 123 → fn() {'{} '} α β γ
      </div>
    </section>
  );
}