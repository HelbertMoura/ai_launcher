import { Terminal, Command, Moon, Sun, RefreshCw } from '../icons';
import { KeyCap } from '../shared/KeyCap';
import type { ProvidersState, ProviderKind } from '../providers/types';
import './HeaderBar.css';

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
  onOpenPalette?: () => void;
}

interface TabDef {
  id: HeaderTabId;
  label: string;
  keycap?: string[];
  adminOnly?: boolean;
}

const TABS: TabDef[] = [
  { id: 'launcher', label: 'launch', keycap: ['\u2318', '1'] },
  { id: 'install', label: 'install', keycap: ['\u2318', '2'] },
  { id: 'tools', label: 'tools' },
  { id: 'orchestrator', label: 'orchestrator' },
  { id: 'history', label: 'history', keycap: ['\u2318', '3'] },
  { id: 'updates', label: 'updates' },
  { id: 'costs', label: 'costs', keycap: ['\u2318', '4'] },
  { id: 'help', label: 'help' },
  { id: 'admin', label: 'admin', adminOnly: true },
];

function resolveActiveProvider(
  providers: ProvidersState,
): { kind: ProviderKind; name: string } | null {
  const active = providers.profiles.find(p => p.id === providers.activeId);
  if (!active) return null;
  if (active.kind === 'anthropic' && !active.baseUrl) return null;
  return { kind: active.kind, name: active.name };
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
  onOpenPalette,
}: HeaderBarProps) {
  const visibleTabs = TABS.filter(t => !t.adminOnly || adminMode);
  const activeProvider = adminMode ? resolveActiveProvider(providers) : null;

  return (
    <header className="headerbar">
      <div className="headerbar__top">
        <div className="headerbar__brand">
          <span className="headerbar__brand-icon" aria-hidden="true">
            <Terminal size={18} strokeWidth={1.5} />
          </span>
          <span className="headerbar__wordmark">AI LAUNCHER</span>
          <span className="headerbar__version">v{version}</span>
        </div>

        <div className="headerbar__status">
          {activeProvider && (
            <button
              type="button"
              className="headerbar__provider"
              onClick={() => onSelectTab('admin')}
              aria-label={`Active provider: ${activeProvider.name}`}
              title="Open admin panel"
            >
              <span
                className={`headerbar__dot headerbar__dot--${activeProvider.kind}`}
                aria-hidden="true"
              />
              <span>{activeProvider.name}</span>
            </button>
          )}

          <button
            type="button"
            className="headerbar__btn"
            onClick={() => onOpenPalette?.()}
            aria-label="Open command palette"
            title="Command palette"
          >
            <Command size={14} strokeWidth={1.5} />
            <KeyCap keys={['\u2318', 'K']} dimmed />
          </button>

          <button
            type="button"
            className="headerbar__btn"
            onClick={onThemeToggle}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun size={14} strokeWidth={1.5} />
            ) : (
              <Moon size={14} strokeWidth={1.5} />
            )}
          </button>

          <button
            type="button"
            className="headerbar__btn"
            onClick={onRefresh}
            aria-label="Re-check installed CLIs"
            title="Refresh (F5)"
          >
            <RefreshCw size={14} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <nav className="headerbar__tabs" aria-label="Primary navigation">
        {visibleTabs.map(tab => {
          const isActive = activeTab === tab.id;
          const tabClasses = [
            'headerbar__tab',
            isActive ? 'headerbar__tab--active' : '',
            tab.id === 'admin' ? 'headerbar__tab--admin' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <button
              key={tab.id}
              type="button"
              className={tabClasses}
              onClick={() => onSelectTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="headerbar__tab-prompt" aria-hidden="true">&gt;</span>
              <span className="headerbar__tab-label">{tab.label}</span>
              {tab.id === 'updates' && updateCount > 0 && (
                <span className="headerbar__tab-badge">{updateCount}</span>
              )}
              {tab.keycap && <KeyCap keys={tab.keycap} dimmed />}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
