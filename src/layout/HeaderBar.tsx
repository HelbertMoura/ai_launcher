import { ProviderBadge } from '../providers/ProviderBadge';
import type { ProvidersState } from '../providers/types';

export type HeaderTabId =
  | 'launcher'
  | 'install'
  | 'tools'
  | 'orchestrator'
  | 'history'
  | 'updates'
  | 'costs'
  | 'help'
  | 'admin';

interface HeaderBarProps {
  activeTab: string;
  onSelectTab: (tab: HeaderTabId) => void;
  onThemeToggle: () => void;
  onRefresh: () => void;
  theme: 'dark' | 'light';
  version: string;
  adminMode: boolean;
  providers: ProvidersState;
  updateCount: number;
}

export function HeaderBar({
  activeTab,
  onSelectTab,
  onThemeToggle,
  onRefresh,
  theme,
  version,
  adminMode,
  providers,
  updateCount,
}: HeaderBarProps) {
  return (
    <>
      <header className="header">
        <div className="logo">
          <div className="logo-icon">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <rect width="24" height="24" rx="5" fill="#8B1E2A" />
              <path d="M7 7l-3 5 3 5M17 7l3 5-3 5" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
            </svg>
          </div>
          <div>
            <div className="logo-title">
              AI Launcher <span>Pro</span>
              <small className="logo-ver">v{version}</small>
              {/^\d+\.\d+\.\d+-(alpha|beta|rc)/i.test(version) && (
                <small className="logo-badge logo-badge-beta">BETA</small>
              )}
            </div>
            <div className="logo-sub">by Helbert Moura • Powered by DevManiac's</div>
          </div>
        </div>
        <div className="header-actions">
          {adminMode && (
            <ProviderBadge
              state={providers}
              onClick={() => onSelectTab('admin')}
            />
          )}
          <button
            className="theme-btn"
            onClick={onThemeToggle}
            title="Alternar tema"
            aria-label={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button
            className="btn"
            onClick={onRefresh}
            title="Re-verificar CLIs (F5)"
            aria-label="Re-verificar CLIs instalados"
          >🔄</button>
        </div>
      </header>

      <div className="tabs">
        <div className={`tab ${activeTab === 'launcher' ? 'active' : ''}`} onClick={() => onSelectTab('launcher')}>⚡ Launcher</div>
        <div className={`tab ${activeTab === 'install' ? 'active' : ''}`} onClick={() => onSelectTab('install')}>📦 Instalar</div>
        <div className={`tab ${activeTab === 'tools' ? 'active' : ''}`} onClick={() => onSelectTab('tools')}>🛠️ Ferramentas</div>
        <div className={`tab ${activeTab === 'orchestrator' ? 'active' : ''}`} onClick={() => onSelectTab('orchestrator')}>🎛️ Orquestrador</div>
        <div className={`tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => onSelectTab('history')}>📜 Histórico</div>
        <div className={`tab ${activeTab === 'updates' ? 'active' : ''}`} onClick={() => onSelectTab('updates')}>
          🔔 Atualizações
          {updateCount > 0 && <span className="tab-badge">{updateCount}</span>}
        </div>
        <div className={`tab ${activeTab === 'costs' ? 'active' : ''}`} onClick={() => onSelectTab('costs')}>💰 Custos</div>
        <div className={`tab ${activeTab === 'help' ? 'active' : ''}`} onClick={() => onSelectTab('help')}>❓ Ajuda</div>
        {adminMode && (
          <div className={`tab tab-admin ${activeTab === 'admin' ? 'active' : ''}`} onClick={() => onSelectTab('admin')}>
            ⚙️ Admin
          </div>
        )}
      </div>
    </>
  );
}
