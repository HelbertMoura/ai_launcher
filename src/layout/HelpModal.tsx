import { useEffect } from 'react';
import { X } from '../icons';
import { KeyCap } from '../shared/KeyCap';
import './HelpModal.css';

interface Shortcut {
  keys: string[];
  description: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: ['\u2318', 'K'], description: 'Abrir paleta de comandos' },
  { keys: ['\u2318', '\u21E7', '1'], description: 'Tab Launcher' },
  { keys: ['\u2318', '\u21E7', '2'], description: 'Tab Install' },
  { keys: ['\u2318', '\u21E7', '3'], description: 'Tab History' },
  { keys: ['\u2318', '\u21E7', '4'], description: 'Tab Costs' },
  { keys: ['\u2318', '1'], description: 'Lançar preset 1' },
  { keys: ['\u2318', '2..9'], description: 'Lançar presets 2 a 9' },
  { keys: ['F5'], description: 'Re-verificar CLIs instalados' },
  { keys: ['\u2318', '/'], description: 'Abrir esta ajuda' },
  { keys: ['Esc'], description: 'Fechar modais' },
];

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

export function HelpModal({ open, onClose }: HelpModalProps) {
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
            keyboard shortcuts
          </h2>
          <button type="button" className="helpmodal__close" onClick={onClose} aria-label="Close help">
            <X size={14} strokeWidth={1.5} />
          </button>
        </header>
        <ul className="helpmodal__list">
          {SHORTCUTS.map((s, i) => (
            <li key={i} className="helpmodal__row">
              <span className="helpmodal__keys">
                <KeyCap keys={s.keys} />
              </span>
              <span className="helpmodal__desc">{s.description}</span>
            </li>
          ))}
        </ul>
        <footer className="helpmodal__footer">
          <span>Pressione <KeyCap keys={['Esc']} dimmed /> para fechar</span>
        </footer>
      </div>
    </div>
  );
}
