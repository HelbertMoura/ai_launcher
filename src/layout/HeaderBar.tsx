import { useTranslation } from 'react-i18next';
import { Sun, Moon, HelpCircle, Command } from '../icons';
import { KeyCap } from '../shared/KeyCap';
import type { ProvidersState } from '../providers/types';
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
  activeTab: HeaderTabId;
  onSelectTab: (tab: HeaderTabId) => void;
  onThemeToggle: () => void;
  onHelp: () => void;
  theme: 'dark' | 'light';
  version: string;
  providers: ProvidersState;
  updateCount: number;
  onOpenPalette?: () => void;
}

interface TabDef {
  id: HeaderTabId;
  keycap?: string[];
}

const TABS: TabDef[] = [
  { id: 'launcher', keycap: ['⌘', '⇧', '1'] },
  { id: 'install', keycap: ['⌘', '⇧', '2'] },
  { id: 'tools' },
  { id: 'orchestrator' },
  { id: 'history', keycap: ['⌘', '⇧', '3'] },
  { id: 'updates' },
  { id: 'costs', keycap: ['⌘', '⇧', '4'] },
  { id: 'help' },
  { id: 'admin' },
];

function resolveActiveProvider(providers: ProvidersState) {
  const active = providers.profiles.find(p => p.id === providers.activeId);
  if (!active) return null;
  if (active.kind === 'anthropic' && !active.baseUrl) return null;
  return { kind: active.kind, name: active.name };
}

export function HeaderBar({
  activeTab,
  onSelectTab,
  onThemeToggle,
  onHelp,
  theme,
  version,
  providers,
  updateCount: _updateCount,
  onOpenPalette,
}: HeaderBarProps) {
  const { t } = useTranslation();
  const activeProvider = resolveActiveProvider(providers);

  return (
    <header className="headerbar">
      <div className="headerbar__brand">
        <span className="headerbar__logo">AI Launcher</span>
        <span className="headerbar__version">{version}</span>
      </div>

      <nav className="headerbar__nav" aria-label={t('header.nav')}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`headerbar__tab${isActive ? ' headerbar__tab--active' : ''}`}
              onClick={() => onSelectTab(tab.id)}
              aria-current={isActive ? 'true' : undefined}
            >
              <span className="headerbar__tab-label">{t(`header.tabs.${tab.id}`)}</span>
              {tab.keycap && <KeyCap keys={tab.keycap} dimmed />}
            </button>
          );
        })}
      </nav>

      <div className="headerbar__actions">
        {activeProvider && (
          <button
            type="button"
            className="headerbar__provider"
            onClick={() => onSelectTab('admin')}
            title={t('header.actions.openAdminPanel')}
          >
            <span className={`headerbar__dot headerbar__dot--${activeProvider.kind}`} />
            <span>{activeProvider.name}</span>
          </button>
        )}

        <button
          type="button"
          className="headerbar__btn"
          onClick={() => onOpenPalette?.()}
          aria-label={t('header.actions.commandPalette')}
          title={t('header.actions.commandPaletteTitle')}
        >
          <Command size={14} strokeWidth={1.5} />
          <KeyCap keys={['⌘', 'K']} dimmed />
        </button>

        <button
          type="button"
          className="headerbar__btn"
          onClick={onThemeToggle}
          aria-label={theme === 'dark' ? t('header.actions.toggleThemeToLight') : t('header.actions.toggleThemeToDark')}
          title={t('header.actions.toggleThemeTitle')}
        >
          {theme === 'dark' ? <Sun size={16} strokeWidth={1.5} /> : <Moon size={16} strokeWidth={1.5} />}
        </button>

        <button
          type="button"
          className="headerbar__btn"
          onClick={onHelp}
          aria-label={t('header.actions.help')}
          title={t('header.actions.helpTitle')}
        >
          <HelpCircle size={16} strokeWidth={1.5} />
        </button>
      </div>
    </header>
  );
}