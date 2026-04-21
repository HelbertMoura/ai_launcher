import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Terminal, Command, Moon, Sun, RefreshCw, Globe } from '../icons';
import { KeyCap } from '../shared/KeyCap';
import type { ProvidersState, ProviderKind } from '../providers/types';
import { SUPPORTED_LOCALES, LOCALE_LABELS, setLocale, type Locale } from '../i18n';
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
  keycap?: string[];
  adminOnly?: boolean;
}

const TABS: TabDef[] = [
  { id: 'launcher', keycap: ['\u2318', '\u21E7', '1'] },
  { id: 'install', keycap: ['\u2318', '\u21E7', '2'] },
  { id: 'tools' },
  { id: 'orchestrator' },
  { id: 'history', keycap: ['\u2318', '\u21E7', '3'] },
  { id: 'updates' },
  { id: 'costs', keycap: ['\u2318', '\u21E7', '4'] },
  { id: 'help' },
  { id: 'admin', adminOnly: true },
];

function resolveActiveProvider(
  providers: ProvidersState,
): { kind: ProviderKind; name: string } | null {
  const active = providers.profiles.find(p => p.id === providers.activeId);
  if (!active) return null;
  // Hide dot for default Anthropic (no custom baseUrl) — indicator is for custom providers only
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
  const { t, i18n } = useTranslation();
  const visibleTabs = TABS.filter(t => !t.adminOnly || adminMode);
  const activeProvider = adminMode ? resolveActiveProvider(providers) : null;

  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const resolved = i18n.resolvedLanguage ?? i18n.language ?? 'en';
  const currentLocale: Locale = (SUPPORTED_LOCALES as readonly string[]).includes(resolved)
    ? (resolved as Locale)
    : 'en';

  useEffect(() => {
    if (!langOpen) return;
    function onDocClick(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [langOpen]);

  function handleLocaleSelect(lng: Locale) {
    void setLocale(lng);
    setLangOpen(false);
  }

  return (
    <header className="headerbar">
      <div className="headerbar__top">
        <div className="headerbar__brand">
          <span className="headerbar__brand-icon" aria-hidden="true">
            <Terminal size={18} strokeWidth={1.5} />
          </span>
          <span className="headerbar__wordmark">{t('header.brand')}</span>
          <span className="headerbar__version">v{version}</span>
        </div>

        <div className="headerbar__status">
          {activeProvider && (
            <button
              type="button"
              className="headerbar__provider"
              onClick={() => onSelectTab('admin')}
              aria-label={t('header.actions.activeProvider', { name: activeProvider.name })}
              title={t('header.actions.openAdminPanel')}
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
            aria-label={t('header.actions.commandPalette')}
            title={t('header.actions.commandPaletteTitle')}
          >
            <Command size={14} strokeWidth={1.5} />
            <KeyCap keys={['\u2318', 'K']} dimmed />
          </button>

          <div className="headerbar__lang" ref={langRef}>
            <button
              type="button"
              className="headerbar__btn headerbar__lang-trigger"
              onClick={() => setLangOpen(v => !v)}
              aria-haspopup="menu"
              aria-expanded={langOpen}
              aria-label={`Language: ${LOCALE_LABELS[currentLocale].native}`}
              title="Language"
            >
              <Globe size={14} strokeWidth={1.5} />
              <span className="headerbar__lang-short">{LOCALE_LABELS[currentLocale].short}</span>
            </button>
            {langOpen && (
              <div className="headerbar__lang-menu" role="menu">
                {SUPPORTED_LOCALES.map(lng => (
                  <button
                    key={lng}
                    type="button"
                    role="menuitemradio"
                    aria-checked={lng === currentLocale}
                    className={`headerbar__lang-option${lng === currentLocale ? ' is-current' : ''}`}
                    onClick={() => handleLocaleSelect(lng)}
                  >
                    <span className="headerbar__lang-native">{LOCALE_LABELS[lng].native}</span>
                    <span className="headerbar__lang-code">{LOCALE_LABELS[lng].short}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            className="headerbar__btn"
            onClick={onThemeToggle}
            aria-label={theme === 'dark' ? t('header.actions.toggleThemeToLight') : t('header.actions.toggleThemeToDark')}
            title={t('header.actions.toggleThemeTitle')}
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
            aria-label={t('header.actions.refresh')}
            title={t('header.actions.refreshTitle')}
          >
            <RefreshCw size={14} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <nav className="headerbar__tabs" aria-label={t('header.nav')}>
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
              aria-current={isActive ? 'true' : undefined}
            >
              <span className="headerbar__tab-prompt" aria-hidden="true">&gt;</span>
              <span className="headerbar__tab-label">{t(`header.tabs.${tab.id}`)}</span>
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
