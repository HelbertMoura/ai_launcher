import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import './EmptyState.css';
import {
  EmptyHistoryIllustration,
  EmptyPresetsIllustration,
  EmptyCliIllustration,
} from './EmptyState.illustrations';

type Variant = 'history' | 'presets' | 'cli';

interface EmptyStateProps {
  /** Legacy CTA handler — used by LauncherTab's "no CLI detected" screen. */
  onInstallClick?: () => void;
  /** Optional new API: select a terminal-themed illustration. */
  variant?: Variant;
  /** Optional title override for the new variant-based API. */
  title?: string;
  /** Optional subtitle/description for the new variant-based API. */
  sub?: string;
  /** Optional CTA label for the new variant-based API. */
  ctaLabel?: string;
  /** Optional CTA handler for the new variant-based API. */
  onCta?: () => void;
}

const ILLUSTRATIONS: Record<Variant, () => JSX.Element> = {
  history: EmptyHistoryIllustration,
  presets: EmptyPresetsIllustration,
  cli: EmptyCliIllustration,
};

/**
 * EmptyState — backward compatible.
 *
 * Legacy usage (unchanged): <EmptyState onInstallClick={...} />
 *   → renders the original "Nenhuma CLI detectada" screen with the classic SVG.
 *
 * New usage: <EmptyState variant="history" title="..." sub="..." ctaLabel="..." onCta={...} />
 *   → renders a terminal-themed illustration with custom copy.
 */
export function EmptyState({
  onInstallClick,
  variant,
  title,
  sub,
  ctaLabel,
  onCta,
}: EmptyStateProps) {
  const { t } = useTranslation();
  // New variant-based rendering
  if (variant) {
    const Illustration = ILLUSTRATIONS[variant];
    return (
      <div className="empty-wrap empty-state" role="status">
        <div className="empty-state__illustration" aria-hidden="true">
          <Illustration />
        </div>
        {title && <h3 className="empty-state__title">{title}</h3>}
        {sub && <p className="empty-state__sub">{sub}</p>}
        {ctaLabel && onCta && (
          <button type="button" className="empty-state__cta" onClick={onCta}>
            {ctaLabel}
          </button>
        )}
      </div>
    );
  }

  // Legacy rendering — preserved verbatim for existing callers.
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
      <h3 className="empty-title">{t('empty.cli.title')}</h3>
      <p className="empty-sub">{t('empty.cli.sub')}</p>
      {onInstallClick && (
        <button className="empty-cta" onClick={onInstallClick}>
          {t('empty.cli.cta')}
        </button>
      )}
    </div>
  );
}
