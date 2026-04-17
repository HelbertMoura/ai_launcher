import './EmptyState.css';

interface EmptyStateProps {
  onInstallClick: () => void;
}

/**
 * EmptyState — exibido quando nenhuma CLI foi detectada.
 * CTA leva o usuário direto para a aba Instalar.
 */
export function EmptyState({ onInstallClick }: EmptyStateProps) {
  return (
    <div className="empty-wrap" role="status">
      <div className="empty-illu" aria-hidden="true">
        <svg viewBox="0 0 120 120" width="120" height="120">
          <defs>
            <linearGradient id="emptyGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.9" />
              <stop offset="100%" stopColor="var(--brand-dark)" stopOpacity="0.6" />
            </linearGradient>
          </defs>
          <circle cx="60" cy="60" r="54" fill="none" stroke="var(--border)" strokeWidth="2" strokeDasharray="4 6" />
          <g transform="translate(34, 34)">
            <rect x="4" y="8" width="44" height="36" rx="4" fill="none" stroke="url(#emptyGrad)" strokeWidth="2.5" />
            <path d="M14 14h24M14 22h16M14 30h20" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" />
            <circle cx="40" cy="44" r="9" fill="var(--surface)" stroke="url(#emptyGrad)" strokeWidth="2.5" />
            <path d="M36 44l3 3 5-6" stroke="var(--brand)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </g>
        </svg>
      </div>
      <h3 className="empty-title">Nenhuma CLI detectada</h3>
      <p className="empty-sub">Instale sua primeira CLI de IA pra começar.</p>
      <button className="empty-cta" onClick={onInstallClick}>
        📦 Instalar primeiro CLI
      </button>
    </div>
  );
}
