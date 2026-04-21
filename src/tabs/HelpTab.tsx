import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, HelpCircle, ChevronRight } from '../icons';
import './HelpTab.css';

export interface HelpTabProps {
  onReopenOnboarding?: () => void;
  onResetAll?: () => void;
  onReenableWelcome?: () => void;
  welcomeActive?: boolean;
}

type SectionKey = 'gettingStarted' | 'providers' | 'shortcuts' | 'troubleshooting' | 'privacy';

const SECTIONS: SectionKey[] = ['gettingStarted', 'providers', 'shortcuts', 'troubleshooting', 'privacy'];

const ALL_FAQ_KEYS = [
  'whatIs',
  'whichCLIs',
  'switchProvider',
  'addProvider',
  'adminUnlock',
  'tokensSafe',
  'exportConfig',
  'changeLanguage',
  'firstProvider',
  'platforms',
] as const;

type FaqKey = (typeof ALL_FAQ_KEYS)[number];

const FAQ_BY_SECTION: Record<SectionKey, readonly FaqKey[]> = {
  gettingStarted: ['whatIs', 'whichCLIs', 'firstProvider', 'platforms'],
  providers: ['switchProvider', 'addProvider', 'tokensSafe'],
  shortcuts: ['adminUnlock', 'changeLanguage'],
  troubleshooting: ['exportConfig'],
  privacy: ['tokensSafe', 'exportConfig'],
};

export function HelpTab({
  onReopenOnboarding,
  onResetAll,
  onReenableWelcome,
  welcomeActive,
}: HelpTabProps) {
  const { t } = useTranslation();
  const [section, setSection] = useState<SectionKey>('gettingStarted');
  const [query, setQuery] = useState('');
  const [openItems, setOpenItems] = useState<Set<FaqKey>>(new Set());

  function toggle(key: FaqKey) {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const visibleItems = useMemo<readonly FaqKey[]>(() => {
    const q = query.trim().toLowerCase();
    if (q === '') {
      return FAQ_BY_SECTION[section];
    }
    return ALL_FAQ_KEYS.filter((key) => {
      const text = `${t(`helpTab.faq.${key}.q`)} ${t(`helpTab.faq.${key}.a`)}`.toLowerCase();
      return text.includes(q);
    });
  }, [section, query, t]);

  const showActions = Boolean(onReopenOnboarding || onResetAll || onReenableWelcome);

  return (
    <div className="tab-scroll">
      <div className="helptab">
        <aside className="helptab__sidebar" aria-label={t('helpTab.sectionsAria')}>
          <div className="helptab__search">
            <Search size={14} strokeWidth={1.5} aria-hidden="true" />
            <input
              type="text"
              className="helptab__search-input"
              placeholder={t('helpTab.searchPlaceholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={t('helpTab.searchPlaceholder')}
            />
          </div>
          <nav className="helptab__sections" aria-label={t('helpTab.sectionsAria')}>
            {SECTIONS.map((s) => {
              const isActive = section === s && query === '';
              return (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`helptab__section-btn${isActive ? ' is-active' : ''}`}
                  onClick={() => {
                    setSection(s);
                    setQuery('');
                  }}
                >
                  <span className="helptab__section-prompt">&gt;</span>
                  <span>{t(`helpTab.sections.${s}`)}</span>
                </button>
              );
            })}
          </nav>
          {showActions && (
            <div className="helptab__actions">
              {onReopenOnboarding && (
                <button
                  type="button"
                  className="helptab__action-btn"
                  onClick={onReopenOnboarding}
                >
                  {t('helpTab.reopenOnboarding')}
                </button>
              )}
              {onReenableWelcome && !welcomeActive && (
                <button
                  type="button"
                  className="helptab__action-btn"
                  onClick={onReenableWelcome}
                >
                  {t('helpTab.reenableWelcome')}
                </button>
              )}
              {onReenableWelcome && welcomeActive && (
                <span className="helptab__action-hint">
                  {t('helpTab.welcomeAlreadyActive')}
                </span>
              )}
              {onResetAll && (
                <button
                  type="button"
                  className="helptab__action-btn helptab__action-btn--danger"
                  onClick={onResetAll}
                >
                  {t('helpTab.resetAll')}
                </button>
              )}
            </div>
          )}
        </aside>
        <main className="helptab__content">
          <h2 className="helptab__content-title">
            <HelpCircle size={18} strokeWidth={1.5} aria-hidden="true" />
            <span>{query ? `"${query}"` : t(`helpTab.sections.${section}`)}</span>
          </h2>
          {visibleItems.length === 0 ? (
            <p className="helptab__empty">{t('helpTab.noResults')}</p>
          ) : (
            <ul className="helptab__faq">
              {visibleItems.map((key) => {
                const isOpen = openItems.has(key);
                return (
                  <li key={key} className={`helptab__item${isOpen ? ' is-open' : ''}`}>
                    <button
                      type="button"
                      className="helptab__item-q"
                      aria-expanded={isOpen}
                      onClick={() => toggle(key)}
                    >
                      <ChevronRight
                        size={14}
                        strokeWidth={1.5}
                        className="helptab__item-chevron"
                        aria-hidden="true"
                      />
                      <span>{t(`helpTab.faq.${key}.q`)}</span>
                    </button>
                    {isOpen && (
                      <div className="helptab__item-a">
                        <p>{t(`helpTab.faq.${key}.a`)}</p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </main>
      </div>
    </div>
  );
}
