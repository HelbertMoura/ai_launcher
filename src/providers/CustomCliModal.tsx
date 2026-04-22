// ==============================================================================
// AI Launcher Pro - CustomCliModal (v7.0)
// Add/edit modal for user-defined custom CLIs.
// ==============================================================================

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from '../icons';
import type { CustomCli } from '../lib/customClis';
import { validateCustomCli } from '../lib/customClis';
import { readIconFileAsDataUrl } from '../lib/iconUpload';
import './CustomCliModal.css';

interface CustomCliModalProps {
  open: boolean;
  editing: CustomCli | null;
  existingKeys: string[];
  onSave: (cli: CustomCli) => void;
  onCancel: () => void;
}

interface DraftState {
  key: string;
  name: string;
  installCmd: string;
  versionCmd: string;
  launchArgs: string;
  docsUrl: string;
  iconEmoji: string;
  iconDataUrl: string;
}

const EMPTY_DRAFT: DraftState = {
  key: '',
  name: '',
  installCmd: '',
  versionCmd: '',
  launchArgs: '',
  docsUrl: '',
  iconEmoji: '',
  iconDataUrl: '',
};

function fromCli(cli: CustomCli): DraftState {
  return {
    key: cli.key,
    name: cli.name,
    installCmd: cli.installCmd,
    versionCmd: cli.versionCmd,
    launchArgs: cli.launchArgs ?? '',
    docsUrl: cli.docsUrl ?? '',
    iconEmoji: cli.iconEmoji ?? '',
    iconDataUrl: cli.iconDataUrl ?? '',
  };
}

export function CustomCliModal({
  open,
  editing,
  existingKeys,
  onSave,
  onCancel,
}: CustomCliModalProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [errorField, setErrorField] = useState<keyof CustomCli | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const originalKey = editing?.key;
  const titleId = 'custom-cli-modal-title';

  useEffect(() => {
    if (!open) return;
    setDraft(editing ? fromCli(editing) : EMPTY_DRAFT);
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
    const result = validateCustomCli(
      {
        key: draft.key.trim(),
        name: draft.name.trim(),
        installCmd: draft.installCmd.trim(),
        versionCmd: draft.versionCmd.trim(),
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
    const cli: CustomCli = {
      key: draft.key.trim(),
      name: draft.name.trim(),
      installCmd: draft.installCmd.trim(),
      versionCmd: draft.versionCmd.trim(),
      launchArgs: draft.launchArgs.trim() || undefined,
      docsUrl: draft.docsUrl.trim() || undefined,
      iconEmoji: draft.iconEmoji.trim() || undefined,
      iconDataUrl: draft.iconDataUrl.trim() || undefined,
      createdAt: editing?.createdAt ?? now,
    };
    onSave(cli);
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

  const title = editing ? t('customCli.editTitle') : t('customCli.addTitle');

  return (
    <div
      className="custom-cli-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onCancel}
    >
      <div className="custom-cli-modal__frame" onClick={e => e.stopPropagation()}>
        <header className="custom-cli-modal__header">
          <h2 id={titleId} className="custom-cli-modal__title">
            <span className="custom-cli-modal__prompt" aria-hidden="true">&gt;</span>
            {title}
          </h2>
          <button
            type="button"
            className="custom-cli-modal__btn"
            onClick={onCancel}
            aria-label={t('customCli.cancel')}
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </header>

        <div className="custom-cli-modal__body">
          <Field
            id="cc-name"
            label={t('customCli.fields.name')}
            hint={t('customCli.fields.nameHint')}
            value={draft.name}
            onChange={v => update('name', v)}
            isError={errorField === 'name'}
            error={errorField === 'name' && errorKey ? t(errorKey) : null}
            autoFocus
          />
          <Field
            id="cc-key"
            label={t('customCli.fields.key')}
            hint={t('customCli.fields.keyHint')}
            value={draft.key}
            onChange={v => update('key', v.toLowerCase())}
            isError={errorField === 'key'}
            error={errorField === 'key' && errorKey ? t(errorKey, { key: draft.key }) : null}
          />
          <Field
            id="cc-install"
            label={t('customCli.fields.installCmd')}
            hint={t('customCli.fields.installCmdHint')}
            value={draft.installCmd}
            onChange={v => update('installCmd', v)}
            isError={errorField === 'installCmd'}
            error={errorField === 'installCmd' && errorKey ? t(errorKey) : null}
          />
          <Field
            id="cc-version"
            label={t('customCli.fields.versionCmd')}
            hint={t('customCli.fields.versionCmdHint')}
            value={draft.versionCmd}
            onChange={v => update('versionCmd', v)}
          />
          <Field
            id="cc-args"
            label={t('customCli.fields.launchArgs')}
            hint={t('customCli.fields.launchArgsHint')}
            value={draft.launchArgs}
            onChange={v => update('launchArgs', v)}
          />
          <Field
            id="cc-docs"
            label={t('customCli.fields.docsUrl')}
            value={draft.docsUrl}
            onChange={v => update('docsUrl', v)}
          />
          <Field
            id="cc-icon"
            label={t('customCli.fields.iconEmoji')}
            hint={t('customCli.fields.iconHint')}
            value={draft.iconEmoji}
            onChange={v => update('iconEmoji', v)}
          />
          <div className="custom-cli-modal__field">
            <label className="custom-cli-modal__label" htmlFor="cc-icon-file">{t('customCli.fields.iconFile')}</label>
            <input
              id="cc-icon-file"
              className="custom-cli-modal__input"
              type="file"
              accept="image/png,image/svg+xml,image/jpeg,image/webp"
              onChange={e => void handleIconFile(e.target.files?.[0] ?? null)}
            />
            <div className="custom-cli-modal__hint">{t('customCli.fields.iconFileHint')}</div>
            {draft.iconDataUrl && <img className="custom-cli-modal__icon-preview" src={draft.iconDataUrl} alt="" aria-hidden="true" />}
            {uploadError && <div className="custom-cli-modal__error">{uploadError}</div>}
          </div>
        </div>

        <footer className="custom-cli-modal__footer">
          <button
            type="button"
            className="custom-cli-modal__btn"
            onClick={onCancel}
          >
            {t('customCli.cancel')}
          </button>
          <button
            type="button"
            className="custom-cli-modal__btn is-primary"
            onClick={handleSave}
          >
            {t('customCli.save')}
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
    <div className="custom-cli-modal__field">
      <label className="custom-cli-modal__label" htmlFor={id}>{label}</label>
      <input
        id={id}
        className={`custom-cli-modal__input${isError ? ' is-error' : ''}`}
        value={value}
        onChange={e => onChange(e.target.value)}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
      />
      {hint && !error && <div className="custom-cli-modal__hint">{hint}</div>}
      {error && <div className="custom-cli-modal__error">{error}</div>}
    </div>
  );
}
