// ==============================================================================
// AI Launcher Pro - CliOverrideModal (v7.1)
// Minimal edit surface for built-in CLIs and IDEs. Allows changing the
// display name and/or icon emoji only — install/detect/launch commands stay
// hardcoded. Empty fields act as "reset to built-in default".
// ==============================================================================

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from '../icons';
import type { CliOverride } from '../lib/clisOverrides';
import './CliOverrideModal.css';

export interface CliOverrideTarget {
  key: string;
  builtinName: string;
  // builtinIcon is rendered as fallback when no emoji override is set.
  builtinIcon: React.ReactNode;
}

interface CliOverrideModalProps {
  open: boolean;
  target: CliOverrideTarget | null;
  current: CliOverride;
  onSave: (key: string, override: CliOverride) => void;
  onClear: (key: string) => void;
  onCancel: () => void;
  kind: 'cli' | 'ide';
}

export function CliOverrideModal({
  open,
  target,
  current,
  onSave,
  onClear,
  onCancel,
}: CliOverrideModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState<string>('');
  const [iconEmoji, setIconEmoji] = useState<string>('');

  const titleId = 'cli-override-modal-title';

  useEffect(() => {
    if (!open) return;
    setName(current.name ?? '');
    setIconEmoji(current.iconEmoji ?? '');
  }, [open, current]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open || !target) return null;

  function handleSave() {
    if (!target) return;
    const cleaned: CliOverride = {
      name: name.trim() || undefined,
      iconEmoji: iconEmoji.trim() || undefined,
    };
    if (!cleaned.name && !cleaned.iconEmoji) {
      onClear(target.key);
      return;
    }
    onSave(target.key, cleaned);
  }

  function handleReset() {
    if (!target) return;
    setName('');
    setIconEmoji('');
    onClear(target.key);
  }

  const previewEmoji = iconEmoji.trim();

  return (
    <div
      className="cli-override-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onCancel}
    >
      <div className="cli-override-modal__frame" onClick={e => e.stopPropagation()}>
        <header className="cli-override-modal__header">
          <h2 id={titleId} className="cli-override-modal__title">
            <span className="cli-override-modal__prompt" aria-hidden="true">&gt;</span>
            {t('overrides.editTitle', { name: target.builtinName })}
          </h2>
          <button
            type="button"
            className="cli-override-modal__btn"
            onClick={onCancel}
            aria-label={t('overrides.cancel')}
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </header>

        <div className="cli-override-modal__body">
          <div className="cli-override-modal__preview">
            <span className="cli-override-modal__preview-label">{t('overrides.iconPreview')}</span>
            <span className="cli-override-modal__preview-icon" aria-hidden="true">
              {previewEmoji ? previewEmoji : target.builtinIcon}
            </span>
          </div>

          <div className="cli-override-modal__field">
            <label className="cli-override-modal__label" htmlFor="cli-ovr-name">
              {t('overrides.nameLabel')}
            </label>
            <input
              id="cli-ovr-name"
              className="cli-override-modal__input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={target.builtinName}
              autoFocus
              autoComplete="off"
              spellCheck={false}
            />
            <div className="cli-override-modal__hint">{t('overrides.nameHint')}</div>
          </div>

          <div className="cli-override-modal__field">
            <label className="cli-override-modal__label" htmlFor="cli-ovr-icon">
              {t('overrides.iconLabel')}
            </label>
            <input
              id="cli-ovr-icon"
              className="cli-override-modal__input cli-override-modal__input--short"
              value={iconEmoji}
              onChange={e => setIconEmoji(e.target.value)}
              maxLength={4}
              autoComplete="off"
              spellCheck={false}
            />
            <div className="cli-override-modal__hint">{t('overrides.iconHint')}</div>
          </div>
        </div>

        <footer className="cli-override-modal__footer">
          <button
            type="button"
            className="cli-override-modal__btn cli-override-modal__btn--ghost"
            onClick={handleReset}
          >
            {t('overrides.reset')}
          </button>
          <span className="cli-override-modal__footer-spacer" />
          <button
            type="button"
            className="cli-override-modal__btn"
            onClick={onCancel}
          >
            {t('overrides.cancel')}
          </button>
          <button
            type="button"
            className="cli-override-modal__btn is-primary"
            onClick={handleSave}
          >
            {t('overrides.save')}
          </button>
        </footer>
      </div>
    </div>
  );
}
