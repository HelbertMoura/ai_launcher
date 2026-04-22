// ==============================================================================
// AI Launcher Pro - CustomIdeModal (v7.0)
// Add/edit modal for user-defined custom IDEs. Mirrors CustomCliModal but
// targets IDE-specific fields (detectCmd / launchCmd).
// ==============================================================================

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from '../icons';
import type { CustomIde } from '../lib/customIdes';
import { validateCustomIde } from '../lib/customIdes';
import { readIconFileAsDataUrl } from '../lib/iconUpload';
import './CustomIdeModal.css';

interface CustomIdeModalProps {
  open: boolean;
  editing: CustomIde | null;
  existingKeys: string[];
  onSave: (ide: CustomIde) => void;
  onCancel: () => void;
}

interface DraftState {
  key: string;
  name: string;
  detectCmd: string;
  launchCmd: string;
  docsUrl: string;
  iconEmoji: string;
  iconDataUrl: string;
}

const EMPTY_DRAFT: DraftState = {
  key: '',
  name: '',
  detectCmd: '',
  launchCmd: '',
  docsUrl: '',
  iconEmoji: '',
  iconDataUrl: '',
};

function fromIde(ide: CustomIde): DraftState {
  return {
    key: ide.key,
    name: ide.name,
    detectCmd: ide.detectCmd,
    launchCmd: ide.launchCmd,
    docsUrl: ide.docsUrl ?? '',
    iconEmoji: ide.iconEmoji ?? '',
    iconDataUrl: ide.iconDataUrl ?? '',
  };
}

export function CustomIdeModal({
  open,
  editing,
  existingKeys,
  onSave,
  onCancel,
}: CustomIdeModalProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [errorField, setErrorField] = useState<keyof CustomIde | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const originalKey = editing?.key;
  const titleId = 'custom-ide-modal-title';

  useEffect(() => {
    if (!open) return;
    setDraft(editing ? fromIde(editing) : EMPTY_DRAFT);
    setErrorField(null);
    setErrorKey(null);
    setUploadError(null);
  }, [open, editing]);

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

  const existingKeysMemo = useMemo(() => existingKeys, [existingKeys]);

  if (!open) return null;

  function update<K extends keyof DraftState>(key: K, value: DraftState[K]) {
    setDraft(d => ({ ...d, [key]: value }));
  }

  function handleSave() {
    const result = validateCustomIde(
      {
        key: draft.key.trim(),
        name: draft.name.trim(),
        detectCmd: draft.detectCmd.trim(),
        launchCmd: draft.launchCmd.trim(),
      },
      existingKeysMemo,
      originalKey
    );
    if (!result.ok) {
      setErrorField(result.field);
      setErrorKey(result.messageKey);
      return;
    }
    const now = Date.now();
    const ide: CustomIde = {
      key: draft.key.trim(),
      name: draft.name.trim(),
      detectCmd: draft.detectCmd.trim(),
      launchCmd: draft.launchCmd.trim(),
      docsUrl: draft.docsUrl.trim() || undefined,
      iconEmoji: draft.iconEmoji.trim() || undefined,
      iconDataUrl: draft.iconDataUrl.trim() || undefined,
      createdAt: editing?.createdAt ?? now,
    };
    onSave(ide);
  }

  async function handleIconFile(file: File | null) {
    if (!file) return;
    try {
      const dataUrl = await readIconFileAsDataUrl(file);
      update('iconDataUrl', dataUrl);
      setUploadError(null);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : String(error));
    }
  }

  const title = editing ? t('customIde.editTitle') : t('customIde.addTitle');

  return (
    <div
      className="custom-ide-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onCancel}
    >
      <div className="custom-ide-modal__frame" onClick={e => e.stopPropagation()}>
        <header className="custom-ide-modal__header">
          <h2 id={titleId} className="custom-ide-modal__title">
            <span className="custom-ide-modal__prompt" aria-hidden="true">&gt;</span>
            {title}
          </h2>
          <button
            type="button"
            className="custom-ide-modal__btn"
            onClick={onCancel}
            aria-label={t('customIde.cancel')}
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </header>

        <div className="custom-ide-modal__body">
          <Field
            id="ci-name"
            label={t('customIde.fields.name')}
            value={draft.name}
            onChange={v => update('name', v)}
            isError={errorField === 'name'}
            error={errorField === 'name' && errorKey ? t(errorKey) : null}
            autoFocus
          />
          <Field
            id="ci-key"
            label={t('customIde.fields.key')}
            value={draft.key}
            onChange={v => update('key', v.toLowerCase())}
            isError={errorField === 'key'}
            error={errorField === 'key' && errorKey ? t(errorKey, { key: draft.key }) : null}
          />
          <Field
            id="ci-detect"
            label={t('customIde.fields.detectCmd')}
            hint={t('customIde.fields.detectCmdHint')}
            value={draft.detectCmd}
            onChange={v => update('detectCmd', v)}
            isError={errorField === 'detectCmd'}
            error={errorField === 'detectCmd' && errorKey ? t(errorKey) : null}
          />
          <Field
            id="ci-launch"
            label={t('customIde.fields.launchCmd')}
            hint={t('customIde.fields.launchCmdHint')}
            value={draft.launchCmd}
            onChange={v => update('launchCmd', v)}
          />
          <Field
            id="ci-docs"
            label={t('customIde.fields.docsUrl')}
            value={draft.docsUrl}
            onChange={v => update('docsUrl', v)}
          />
          <Field
            id="ci-icon"
            label={t('customIde.fields.iconEmoji')}
            value={draft.iconEmoji}
            onChange={v => update('iconEmoji', v)}
          />
          <div className="custom-ide-modal__field">
            <label className="custom-ide-modal__label" htmlFor="ci-icon-file">{t('customIde.fields.iconFile')}</label>
            <input
              id="ci-icon-file"
              className="custom-ide-modal__input"
              type="file"
              accept="image/png,image/svg+xml,image/jpeg,image/webp"
              onChange={e => void handleIconFile(e.target.files?.[0] ?? null)}
            />
            <div className="custom-ide-modal__hint">{t('customIde.fields.iconFileHint')}</div>
            {draft.iconDataUrl && <img className="custom-ide-modal__icon-preview" src={draft.iconDataUrl} alt="" aria-hidden="true" />}
            {uploadError && <div className="custom-ide-modal__error">{uploadError}</div>}
          </div>
        </div>

        <footer className="custom-ide-modal__footer">
          <button
            type="button"
            className="custom-ide-modal__btn"
            onClick={onCancel}
          >
            {t('customIde.cancel')}
          </button>
          <button
            type="button"
            className="custom-ide-modal__btn is-primary"
            onClick={handleSave}
          >
            {t('customIde.save')}
          </button>
        </footer>
      </div>
    </div>
  );
}

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  isError?: boolean;
  error?: string | null;
  autoFocus?: boolean;
}

function Field({ id, label, hint, value, onChange, isError, error, autoFocus }: FieldProps) {
  return (
    <div className="custom-ide-modal__field">
      <label className="custom-ide-modal__label" htmlFor={id}>{label}</label>
      <input
        id={id}
        className={`custom-ide-modal__input${isError ? ' is-error' : ''}`}
        value={value}
        onChange={e => onChange(e.target.value)}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
      />
      {hint && !error && <div className="custom-ide-modal__hint">{hint}</div>}
      {error && <div className="custom-ide-modal__error">{error}</div>}
    </div>
  );
}
