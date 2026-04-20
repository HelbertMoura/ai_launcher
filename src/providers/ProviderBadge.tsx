// ==============================================================================
// AI Launcher Pro - Provider Badge
// Badge no header mostrando qual provider está ativo pro Claude.
// ==============================================================================

import type { ProvidersState } from './types';

interface ProviderBadgeProps {
  state: ProvidersState;
  onClick?: () => void;
}

export function ProviderBadge({ state, onClick }: ProviderBadgeProps) {
  const active = state.profiles.find(p => p.id === state.activeId);
  if (!active) return null;
  // Oculta badge quando é o Anthropic oficial — menos ruído visual.
  if (active.kind === 'anthropic' && !active.baseUrl) return null;

  const label = `Claude via ${active.name}`;
  const model = state.overrideMainModel || active.mainModel;

  return (
    <button
      type="button"
      className={`provider-badge kind-${active.kind}`}
      onClick={onClick}
      title="Abrir Painel Admin"
    >
      <span className="provider-badge-dot" />
      <span className="provider-badge-label">{label}</span>
      <span className="provider-badge-model">{model}</span>
    </button>
  );
}
