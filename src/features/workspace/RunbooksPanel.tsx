// ==============================================================================
// AI Launcher Pro - Runbooks Panel
// Lists runbooks with create / edit / delete / run wiring. Mounted inline in
// WorkspacePage. The list is the entry point; selecting a runbook opens the
// editor, and "Run" opens the real RunbookRunner (Tauri-backed execution).
// ==============================================================================

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { showToast } from '../../ui/toastStore';
import type { Runbook } from '../../domain/types';
import { createRunbook, getRunbook, getRunbooks } from './runbookStore';
import {
  getSuggestedRunbookPresets,
  installRunbookPresets,
  RUNBOOK_PRESETS,
} from './runbookPresets';
import { RunbookEditor } from './RunbookEditor';
import { RunbookRunner } from './RunbookRunner';
import './Runbook.css';

interface RunbooksPanelProps {
  onClose: () => void;
  /** Working directory forwarded to runbook step execution. */
  cwd?: string;
  suggestedPresetIds?: string[];
  onRunbooksChanged?: () => void;
}

type Mode = 'list' | 'edit' | 'run';

export function RunbooksPanel({
  onClose,
  cwd,
  suggestedPresetIds = [],
  onRunbooksChanged,
}: RunbooksPanelProps) {
  const { t } = useTranslation();
  const [runbooks, setRunbooks] = useState<Runbook[]>(() => getRunbooks());
  const [mode, setMode] = useState<Mode>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setRunbooks(getRunbooks());
    onRunbooksChanged?.();
  }, [onRunbooksChanged]);

  const selected = selectedId ? runbooks.find((r) => r.id === selectedId) ?? getRunbook(selectedId) : undefined;

  const handleCreate = useCallback(() => {
    const rb = createRunbook({ name: t('runbook.untitled') });
    refresh();
    setSelectedId(rb.id);
    setMode('edit');
  }, [refresh, t]);

  const presetSuggestions = getSuggestedRunbookPresets(
    suggestedPresetIds.length > 0 ? suggestedPresetIds : RUNBOOK_PRESETS.map((preset) => preset.id),
  );

  const handleInstallPresets = useCallback(() => {
    const result = installRunbookPresets(presetSuggestions.map((preset) => preset.id));
    refresh();
    if (result.created.length > 0) {
      showToast(t('runbook.presets.created', { count: result.created.length }), 'success');
      return;
    }
    showToast(t('runbook.presets.alreadyInstalled'), 'info');
  }, [presetSuggestions, refresh, t]);

  const handleEdit = useCallback((id: string) => {
    setSelectedId(id);
    setMode('edit');
  }, []);

  const handleRun = useCallback((id: string) => {
    setSelectedId(id);
    setMode('run');
  }, []);

  // RunbookEditor reports the updated runbook, or null after deletion.
  const handleEditorChange = useCallback(
    (updated: Runbook | null) => {
      refresh();
      if (updated === null) {
        // Deleted: return to the list.
        setSelectedId(null);
        setMode('list');
      } else {
        setSelectedId(updated.id);
      }
    },
    [refresh],
  );

  const backToList = useCallback(() => {
    refresh();
    setMode('list');
    setSelectedId(null);
  }, [refresh]);

  if (mode === 'edit' && selected) {
    return (
      <section className="cd-rb-panel">
        <header className="cd-rb-panel__head">
          <Button size="sm" variant="ghost" onClick={backToList}>{t('runbook.backToList')}</Button>
          <h2 className="cd-rb-panel__title">{t('runbook.editTitle')}</h2>
          <Button size="sm" onClick={() => handleRun(selected.id)}>{t('runbook.run.start')}</Button>
        </header>
        <RunbookEditor runbook={selected} onChange={handleEditorChange} />
      </section>
    );
  }

  if (mode === 'run' && selected) {
    return (
      <section className="cd-rb-panel">
        <RunbookRunner runbook={selected} cwd={cwd} onClose={() => handleEdit(selected.id)} />
      </section>
    );
  }

  return (
    <section className="cd-rb-panel">
      <header className="cd-rb-panel__head">
        <Button size="sm" variant="ghost" onClick={onClose}>{t('runbook.backToWorkspace')}</Button>
        <h2 className="cd-rb-panel__title">{t('runbook.title')}</h2>
        <div className="cd-rb-panel__head-actions">
          <Button size="sm" variant="ghost" onClick={handleInstallPresets} disabled={presetSuggestions.length === 0}>
            {t('runbook.presets.add')}
          </Button>
          <Button size="sm" onClick={handleCreate}>{t('runbook.new')}</Button>
        </div>
      </header>

      {presetSuggestions.length > 0 && (
        <div className="cd-rb-panel__presets" aria-label={t('runbook.presets.title')}>
          <div className="cd-rb-panel__presets-head">
            <span>{t('runbook.presets.title')}</span>
            <small>{t('runbook.presets.hint')}</small>
          </div>
          <div className="cd-rb-panel__preset-list">
            {presetSuggestions.slice(0, 4).map((preset) => (
              <article key={preset.id} className="cd-rb-panel__preset">
                <strong>{preset.name}</strong>
                <small>{preset.description}</small>
              </article>
            ))}
          </div>
        </div>
      )}

      {runbooks.length === 0 ? (
        <Card className="cd-rb-panel__empty">
          <p>{t('runbook.empty')}</p>
        </Card>
      ) : (
        <ul className="cd-rb-panel__list">
          {runbooks.map((rb) => (
            <li key={rb.id} className="cd-rb-panel__item">
              <div className="cd-rb-panel__item-info">
                <span className="cd-rb-panel__item-name">{rb.name}</span>
                <span className="cd-rb-panel__item-meta">
                  {t('runbook.stepsCount', { count: rb.steps.length })}
                </span>
              </div>
              <div className="cd-rb-panel__item-actions">
                <Button size="sm" onClick={() => handleRun(rb.id)} disabled={rb.steps.length === 0}>
                  {t('runbook.run.start')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleEdit(rb.id)}>
                  {t('common.edit')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
