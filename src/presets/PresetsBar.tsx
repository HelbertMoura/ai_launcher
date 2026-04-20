// ==============================================================================
// AI Launcher Pro - Launch Presets Bar
// Barra horizontal com presets clicáveis. Salva snapshot do estado atual
// (selectedCli + provider + directory + args + noPerms) em 1 clique.
// ==============================================================================

import { useState } from 'react';
import type { LaunchPreset } from './types';
import { PresetIcon, PRESET_ICON_IDS } from './PresetIcon';

interface PresetsBarProps {
  presets: LaunchPreset[];
  onLaunch: (p: LaunchPreset) => void;
  onRemove: (id: string) => void;
  onSave: (name: string, emoji: string) => void;
  onRename: (id: string, name: string) => void;
}

/**
 * v5.1 — IDs de SVG monograma (rendering consistente entre Win10/11/Linux/macOS).
 * Campo `emoji` no LaunchPreset passou a aceitar também IDs SVG além de emojis
 * legados; PresetIcon.resolveIconId faz a tradução.
 */
const ICON_CHOICES: ReadonlyArray<string> = PRESET_ICON_IDS;

export function PresetsBar({ presets, onLaunch, onRemove, onSave, onRename }: PresetsBarProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftEmoji, setDraftEmoji] = useState<string>('bolt');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  function handleSave() {
    const name = draftName.trim();
    if (!name) return;
    onSave(name, draftEmoji);
    setDraftName('');
    setDraftEmoji('bolt');
    setShowAdd(false);
  }

  function handleCommitRename(id: string) {
    const name = renameDraft.trim();
    if (name) onRename(id, name);
    setRenamingId(null);
  }

  return (
    <div className="presets-bar">
      <div className="presets-bar-head">
        <span className="section-title" style={{ margin: 0 }}>PRESETS</span>
        <button className="btn btn-sm" onClick={() => setShowAdd(v => !v)} title="Salvar combinação atual como preset">
          {showAdd ? '✕ Fechar' : '+ Salvar atual'}
        </button>
      </div>
      {showAdd && (
        <div className="preset-add">
          <div className="preset-emoji-row" role="radiogroup" aria-label="Escolher ícone do preset">
            {ICON_CHOICES.map(id => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={draftEmoji === id}
                aria-label={`Ícone ${id}`}
                className={`preset-emoji ${draftEmoji === id ? 'active' : ''}`}
                onClick={() => setDraftEmoji(id)}
              >
                <PresetIcon id={id} size={16} />
              </button>
            ))}
          </div>
          <input
            className="input"
            placeholder="Nome do preset (ex: Refactor mode, Review daily, etc.)"
            value={draftName}
            onChange={e => setDraftName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            autoFocus
          />
          <button className="btn" onClick={handleSave}>💾 Salvar</button>
        </div>
      )}
      {presets.length === 0 && !showAdd && (
        <div className="presets-empty">
          Sem presets. Configure CLI + diretório + argumentos + provider, depois clique <strong>+ Salvar atual</strong>.
        </div>
      )}
      {presets.length > 0 && (
        <div className="presets-list">
          {presets.map((p, idx) => (
            <div key={p.id} className="preset-chip" title={`${p.cliKey} · ${p.directory || '(sem dir)'}`}>
              <button
                className="preset-chip-main"
                onClick={() => onLaunch(p)}
                title={`Lançar (Ctrl+${idx + 1})`}
              >
                <span className="preset-chip-emoji" aria-hidden="true">
                  <PresetIcon id={p.emoji || 'bolt'} size={14} />
                </span>
                {renamingId === p.id ? (
                  <input
                    className="preset-rename"
                    value={renameDraft}
                    autoFocus
                    onChange={e => setRenameDraft(e.target.value)}
                    onBlur={() => handleCommitRename(p.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleCommitRename(p.id);
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span className="preset-chip-name">{p.name}</span>
                )}
                {idx < 9 && <kbd className="preset-chip-kbd">Ctrl+{idx + 1}</kbd>}
              </button>
              <button
                className="preset-chip-edit"
                onClick={e => { e.stopPropagation(); setRenamingId(p.id); setRenameDraft(p.name); }}
                title="Renomear"
                aria-label="Renomear preset"
              >✎</button>
              <button
                className="preset-chip-x"
                onClick={e => { e.stopPropagation(); onRemove(p.id); }}
                title="Excluir preset"
                aria-label="Excluir preset"
              >×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
