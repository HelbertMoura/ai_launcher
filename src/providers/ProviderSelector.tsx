// ==============================================================================
// AI Launcher Pro - Provider Selector
// Dropdown na aba Lançar (só quando Claude selecionado) + aviso de context cap
// + override rápido de modelo.
// ==============================================================================

import { useMemo, useState } from 'react';
import type { ProvidersState } from './types';
import { setActive } from './storage';

interface ProviderSelectorProps {
  state: ProvidersState;
  onChange: (next: ProvidersState) => void;
  /** CLI atualmente selecionado — só rendeiriza pra "claude". */
  selectedCli: string;
}

export function ProviderSelector({ state, onChange, selectedCli }: ProviderSelectorProps) {
  const [showOverride, setShowOverride] = useState(false);

  const active = useMemo(() => state.profiles.find(p => p.id === state.activeId), [state]);

  if (selectedCli !== 'claude') return null;

  const contextCap = active?.contextWindow ?? 0;
  const capWarn = active && active.kind !== 'anthropic' && contextCap > 0 && contextCap < 500_000;

  return (
    <div className="section">
      <div className="section-title">PROVIDER (Claude)</div>
      <div className="provider-row">
        <select
          className="input"
          value={state.activeId}
          onChange={e => onChange(setActive(state, e.target.value))}
        >
          {state.profiles.map(p => (
            <option key={p.id} value={p.id}>
              {p.name}{p.kind !== 'anthropic' ? ` · ${p.mainModel}` : ''}
            </option>
          ))}
        </select>
        <button
          className="btn btn-sm"
          type="button"
          onClick={() => setShowOverride(v => !v)}
          title="Override rápido de modelo pra este launch"
        >
          {showOverride ? '✕ Fechar override' : '⚙ Override modelo'}
        </button>
      </div>
      {active && (
        <div className="provider-meta">
          <span><code>opus/sonnet → {state.overrideMainModel || active.mainModel}</code></span>
          <span><code>haiku → {state.overrideFastModel || active.fastModel}</code></span>
          <span><code>context: {contextCap.toLocaleString()} tokens</code></span>
        </div>
      )}
      {capWarn && (
        <div className="provider-warning">
          ⚠ Context cap: <strong>{contextCap.toLocaleString()} tokens</strong>. Mesmo pedindo "opus 1M"
          ao Claude Code, o backend {active?.name} trunca o contexto. Planeje conversas longas com isso em mente.
        </div>
      )}
      {showOverride && (
        <div className="provider-override">
          <label>Override main (opus/sonnet)
            <input
              className="input"
              value={state.overrideMainModel ?? ''}
              onChange={e => onChange({ ...state, overrideMainModel: e.target.value || undefined })}
              placeholder={active?.mainModel}
            />
          </label>
          <label>Override fast (haiku)
            <input
              className="input"
              value={state.overrideFastModel ?? ''}
              onChange={e => onChange({ ...state, overrideFastModel: e.target.value || undefined })}
              placeholder={active?.fastModel}
            />
          </label>
          <button
            className="btn btn-sm"
            type="button"
            onClick={() => onChange({ ...state, overrideMainModel: undefined, overrideFastModel: undefined })}
          >
            Limpar overrides
          </button>
        </div>
      )}
    </div>
  );
}
