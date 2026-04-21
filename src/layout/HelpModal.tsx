import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from '../icons';
import { KeyCap } from '../shared/KeyCap';
import './HelpModal.css';

interface Shortcut {
  keys: string[];
  descriptionKey: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: ['\u2318', 'K'], descriptionKey: 'helpModal.shortcuts.palette' },
  { keys: ['\u2318', '\u21E7', '1'], descriptionKey: 'helpModal.shortcuts.tabLauncher' },
  { keys: ['\u2318', '\u21E7', '2'], descriptionKey: 'helpModal.shortcuts.tabInstall' },
  { keys: ['\u2318', '\u21E7', '3'], descriptionKey: 'helpModal.shortcuts.tabHistory' },
  { keys: ['\u2318', '\u21E7', '4'], descriptionKey: 'helpModal.shortcuts.tabCosts' },
  { keys: ['\u2318', '1'], descriptionKey: 'helpModal.shortcuts.preset1' },
  { keys: ['\u2318', '2..9'], descriptionKey: 'helpModal.shortcuts.presetsRange' },
  { keys: ['F5'], descriptionKey: 'helpModal.shortcuts.refresh' },
  { keys: ['\u2318', '/'], descriptionKey: 'helpModal.shortcuts.help' },
  { keys: ['\u2318', '\u21E7', 'A'], descriptionKey: 'helpModal.shortcuts.adminToggle' },
  { keys: ['Esc'], descriptionKey: 'helpModal.shortcuts.escape' },
];

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

export function HelpModal({ open, onClose }: HelpModalProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="helpmodal" role="dialog" aria-modal="true" aria-labelledby="helpmodal-title" onClick={onClose}>
      <div className="helpmodal__frame" onClick={(e) => e.stopPropagation()}>
        <header className="helpmodal__header">
          <h2 id="helpmodal-title" className="helpmodal__title">
            <span className="helpmodal__prompt" aria-hidden="true">&gt;</span>
            {t('helpModal.title')}
          </h2>
          <button type="button" className="helpmodal__close" onClick={onClose} aria-label={t('helpModal.close')}>
            <X size={14} strokeWidth={1.5} />
          </button>
        </header>
        <ul className="helpmodal__list">
          {SHORTCUTS.map((s, i) => (
            <li key={i} className="helpmodal__row">
              <span className="helpmodal__keys">
                <KeyCap keys={s.keys} />
              </span>
              <span className="helpmodal__desc">{t(s.descriptionKey)}</span>
            </li>
          ))}
        </ul>
        <footer className="helpmodal__footer">
          {(() => {
            const parts = t('helpModal.closeHint', { key: '\u0000' }).split('\u0000');
            return (
              <span>
                {parts[0]}
                <KeyCap keys={['Esc']} dimmed />
                {parts[1]}
              </span>
            );
          })()}
        </footer>
      </div>
    </div>
  );
}
