// ==============================================================================
// AI Launcher Pro - Appearance Section
// Seletor de fonte de exibição com persistência em localStorage.
// Aplica --ff-mono e --ff-display no :root.
// ==============================================================================

import { useEffect, useState } from 'react';
import { Type } from '../icons';
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

export function AppearanceSection() {
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
        <span>Aparência</span>
      </h3>
      <div role="radiogroup" aria-label="Display font" className="appearance-options">
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
            {opt.recommended && <span className="appearance-option__badge">recomendado</span>}
          </label>
        ))}
      </div>
      <div className="appearance-preview" style={{ fontFamily: currentStack }}>
        abc 123 → fn() {'{} '} α β γ
      </div>
    </section>
  );
}
