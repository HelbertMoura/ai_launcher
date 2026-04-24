// ==============================================================================
// AI Launcher Pro - Runbook Editor
// Create, edit, and manage runbook steps with reordering support.
// ==============================================================================

import { useCallback, useState } from 'react';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Toggle } from '../../ui/Toggle';
import { Banner } from '../../ui/Banner';
import { downloadBlob } from '../../lib/exportData';
import type { Runbook, RunbookStep, RunbookStepType } from '../../domain/types';
import {
  addStep,
  updateStep,
  removeStep,
  moveStep,
  updateRunbook,
  deleteRunbook,
  exportRunbook,
  createRunbook,
} from './runbookStore';
import './Runbook.css';

const STEP_TYPES: RunbookStepType[] = ['install', 'configure', 'launch', 'check'];

const TYPE_ICONS: Record<RunbookStepType, string> = {
  install: '⬇',
  configure: '⚙',
  launch: '▶',
  check: '✓',
};

interface RunbookEditorProps {
  runbook: Runbook;
  onChange: (updated: Runbook | null) => void;
}

// --- Step Editor -------------------------------------------------------------

interface StepEditorProps {
  step: RunbookStep;
  isFirst: boolean;
  isLast: boolean;
  onChange: (stepId: string, patch: Partial<RunbookStep>) => void;
  onRemove: (stepId: string) => void;
  onMove: (stepId: string, direction: 'up' | 'down') => void;
}

function StepEditor({ step, isFirst, isLast, onChange, onRemove, onMove }: StepEditorProps) {
  return (
    <Card className="cd-rb-step">
      <div className="cd-rb-step__header">
        <span className="cd-rb-step__icon">{TYPE_ICONS[step.type]}</span>
        <span className="cd-rb-step__id">#{step.id.slice(-4)}</span>
      </div>
      <div className="cd-rb-step__fields">
        <label className="cd-rb-step__field">
          <span className="cd-rb-step__label">Label</span>
          <Input
            value={step.label}
            onChange={(e) => onChange(step.id, { label: e.target.value })}
            placeholder="Step label"
          />
        </label>
        <div className="cd-rb-step__row">
          <label className="cd-rb-step__field cd-rb-step__field--sm">
            <span className="cd-rb-step__label">Type</span>
            <select
              className="cd-rb-step__select"
              value={step.type}
              onChange={(e) => onChange(step.id, { type: e.target.value as RunbookStepType })}
            >
              {STEP_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="cd-rb-step__field cd-rb-step__field--auto">
            <span className="cd-rb-step__label">Auto</span>
            <Toggle
              checked={step.auto}
              onChange={(val) => onChange(step.id, { auto: val })}
            />
          </label>
        </div>
        <label className="cd-rb-step__field">
          <span className="cd-rb-step__label">Command</span>
          <Input
            value={step.command ?? ''}
            onChange={(e) => onChange(step.id, { command: e.target.value || undefined })}
            placeholder="Shell command (optional)"
          />
        </label>
        <div className="cd-rb-step__row">
          <label className="cd-rb-step__field cd-rb-step__field--sm">
            <span className="cd-rb-step__label">Tool Key</span>
            <Input
              value={step.toolKey ?? ''}
              onChange={(e) => onChange(step.id, { toolKey: e.target.value || undefined })}
              placeholder="optional"
            />
          </label>
          <label className="cd-rb-step__field cd-rb-step__field--sm">
            <span className="cd-rb-step__label">CLI Key</span>
            <Input
              value={step.cliKey ?? ''}
              onChange={(e) => onChange(step.id, { cliKey: e.target.value || undefined })}
              placeholder="optional"
            />
          </label>
        </div>
      </div>
      <div className="cd-rb-step__actions">
        <Button size="sm" variant="ghost" onClick={() => onMove(step.id, 'up')} disabled={isFirst}>
          ↑
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onMove(step.id, 'down')} disabled={isLast}>
          ↓
        </Button>
        <Button size="sm" variant="danger" onClick={() => onRemove(step.id)}>
          Remove
        </Button>
      </div>
    </Card>
  );
}

// --- Main Editor -------------------------------------------------------------

export function RunbookEditor({ runbook, onChange }: RunbookEditorProps) {
  const [name, setName] = useState(runbook.name);
  const [description, setDescription] = useState(runbook.description ?? '');
  const [error, setError] = useState<string | null>(null);

  const handleSaveMeta = useCallback(() => {
    const result = updateRunbook(runbook.id, {
      name: name.trim() || 'Untitled Runbook',
      description: description.trim() || undefined,
    });
    if (result) {
      onChange(result);
    } else {
      setError('Failed to save runbook');
    }
  }, [runbook.id, name, description, onChange]);

  const handleAddStep = useCallback(() => {
    const result = addStep(runbook.id);
    if (result) onChange(result);
  }, [runbook.id, onChange]);

  const handleStepChange = useCallback(
    (stepId: string, patch: Partial<RunbookStep>) => {
      const result = updateStep(runbook.id, stepId, patch);
      if (result) onChange(result);
    },
    [runbook.id, onChange],
  );

  const handleStepRemove = useCallback(
    (stepId: string) => {
      const result = removeStep(runbook.id, stepId);
      if (result) onChange(result);
    },
    [runbook.id, onChange],
  );

  const handleStepMove = useCallback(
    (stepId: string, direction: 'up' | 'down') => {
      const result = moveStep(runbook.id, stepId, direction);
      if (result) onChange(result);
    },
    [runbook.id, onChange],
  );

  const handleDelete = useCallback(() => {
    deleteRunbook(runbook.id);
    onChange(null);
  }, [runbook.id, onChange]);

  const handleExport = useCallback(() => {
    const json = exportRunbook(runbook);
    const date = new Date().toISOString().slice(0, 10);
    downloadBlob(json, `runbook-${runbook.name.replace(/\s+/g, '-')}-${date}.json`, 'application/json');
  }, [runbook]);

  const handleDuplicate = useCallback(() => {
    const dup = createRunbook({
      name: `${runbook.name} (copy)`,
      description: runbook.description,
      tags: runbook.tags,
      steps: runbook.steps.map((s) => ({
        ...s,
        id: `step-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      })),
    });
    onChange(dup);
  }, [runbook, onChange]);

  return (
    <div className="cd-rb-editor">
      {error && <Banner variant="err">{error}</Banner>}

      <div className="cd-rb-editor__meta">
        <label className="cd-rb-step__field">
          <span className="cd-rb-step__label">Runbook Name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Runbook name" />
        </label>
        <label className="cd-rb-step__field">
          <span className="cd-rb-step__label">Description</span>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
        </label>
        <Button size="sm" onClick={handleSaveMeta}>Save Metadata</Button>
      </div>

      <div className="cd-rb-editor__steps">
        <div className="cd-rb-editor__steps-header">
          <span className="cd-rb-editor__steps-title">Steps ({runbook.steps.length})</span>
          <Button size="sm" onClick={handleAddStep}>+ Add Step</Button>
        </div>

        {runbook.steps.length === 0 && (
          <Card className="cd-rb-editor__empty">
            <p>No steps yet. Click "Add Step" to create one.</p>
          </Card>
        )}

        {runbook.steps.map((step, i) => (
          <StepEditor
            key={step.id}
            step={step}
            isFirst={i === 0}
            isLast={i === runbook.steps.length - 1}
            onChange={handleStepChange}
            onRemove={handleStepRemove}
            onMove={handleStepMove}
          />
        ))}
      </div>

      <div className="cd-rb-editor__footer">
        <Button size="sm" variant="ghost" onClick={handleExport}>Export JSON</Button>
        <Button size="sm" variant="ghost" onClick={handleDuplicate}>Duplicate</Button>
        <Button size="sm" variant="danger" onClick={handleDelete}>Delete Runbook</Button>
      </div>
    </div>
  );
}
