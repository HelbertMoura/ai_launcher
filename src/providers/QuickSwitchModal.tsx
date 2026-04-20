// ==============================================================================
// AI Launcher Pro - Quick Switch Modal (Ctrl+P)
// Modal leve pra trocar provider ativo sem abrir Admin. Arrow keys + enter.
// ==============================================================================

import { useEffect, useRef, useState } from 'react';
import type { ProvidersState } from './types';
import { setActive } from './storage';

interface QuickSwitchModalProps {
  open: boolean;
  state: ProvidersState;
  onChange: (next: ProvidersState) => void;
  onClose: () => void;
}

export function QuickSwitchModal({ open, state, onChange, onClose }: QuickSwitchModalProps) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  if (!open) return null;

  const filtered = state.profiles.filter(p => {
    if (!query) return true;
    const q = query.toLowerCase();
    return p.name.toLowerCase().includes(q)
      || p.kind.toLowerCase().includes(q)
      || p.mainModel.toLowerCase().includes(q);
  });

  function commit(idx: number) {
    const target = filtered[idx];
    if (target) {
      onChange(setActive(state, target.id));
      onClose();
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, filtered.length - 1)); return; }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); return; }
    if (e.key === 'Enter')     { e.preventDefault(); commit(cursor); return; }
  }

  return (
    <div className="quick-switch-overlay" onClick={onClose}>
      <div className="quick-switch-modal" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="input quick-switch-input"
          placeholder="Filtrar provider... (↑↓ navega, Enter ativa, Esc fecha)"
          value={query}
          onChange={e => { setQuery(e.target.value); setCursor(0); }}
          onKeyDown={handleKey}
        />
        <div className="quick-switch-list">
          {filtered.length === 0 && <div className="quick-switch-empty">Sem resultados.</div>}
          {filtered.map((p, idx) => (
            <button
              key={p.id}
              className={`quick-switch-item ${idx === cursor ? 'active' : ''} ${p.id === state.activeId ? 'current' : ''}`}
              onMouseEnter={() => setCursor(idx)}
              onClick={() => commit(idx)}
            >
              <span className="quick-switch-name">{p.name}</span>
              <span className="quick-switch-meta">
                <code>{p.mainModel}</code>
                {p.id === state.activeId && <span className="admin-tag admin-tag-active" style={{ marginLeft: 8 }}>ATIVO</span>}
              </span>
            </button>
          ))}
        </div>
        <div className="quick-switch-hint">
          <kbd>Ctrl+P</kbd> abre · <kbd>↑↓</kbd> navega · <kbd>Enter</kbd> ativa · <kbd>Esc</kbd> fecha
        </div>
      </div>
    </div>
  );
}
