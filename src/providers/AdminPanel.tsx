// ==============================================================================
// AI Launcher Pro - Admin Panel
// CRUD de ProviderProfile + teste de conexão + import/export + editor de envs
// extras. Só renderiza quando isAdminMode() === true.
// ==============================================================================

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import type { ProviderProfile, ProvidersState } from './types';
import { estimateCost, formatUSD, savingsVsBaseline } from './costEstimator';
import { buildLaunchEnv, exportProfiles, importProfiles, redactEnv, removeProfile, resetProviders, setActive, upsertProfile } from './storage';
import { testProviderConnection } from './testConnection';
import { hintsFor } from './modelCatalog';
import { DOCS_LINKS } from './docsLinks';
import { AppearanceSection } from './AppearanceSection';
import { CustomCliModal } from './CustomCliModal';
import { Download, Upload } from '../icons';
import { downloadConfigJson, importConfig } from '../lib/configIO';
import type { CustomCli } from '../lib/customClis';
import { addCustomCli, loadCustomClis, removeCustomCli, saveCustomClis } from '../lib/customClis';
import {
  loadAppSettings,
  saveAppSettings,
  resetAppSettings,
  DEFAULT_SETTINGS,
  type AppSettings,
} from '../lib/appSettings';

interface AdminPanelProps {
  state: ProvidersState;
  onChange: (next: ProvidersState) => void;
  onToast: (msg: string) => void;
  appVersion?: string;
}

const PROVIDER_KIND_VALUES: ReadonlyArray<ProviderProfile['kind']> = [
  'anthropic',
  'zai',
  'minimax',
  'custom',
];

function slugify(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
}

function newBlankProfile(): ProviderProfile {
  return {
    id: '',
    name: '',
    kind: 'custom',
    baseUrl: '',
    apiKey: '',
    mainModel: '',
    fastModel: '',
    contextWindow: 200_000,
    priceInPerM: 0,
    priceOutPerM: 0,
    dailyBudget: 0,
  };
}

async function openDocs(url: string) {
  try {
    await invoke('open_external_url', { url });
  } catch {
    try { window.open(url, '_blank'); } catch { /* noop */ }
  }
}

export function AdminPanel({ state, onChange, onToast, appVersion }: AdminPanelProps) {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProviderProfile | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [customClis, setCustomClis] = useState<CustomCli[]>(() => loadCustomClis());
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [editingCustomCli, setEditingCustomCli] = useState<CustomCli | null>(null);
  const [settings, setSettings] = useState<AppSettings>(() => loadAppSettings());

  function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    const next = { ...settings, [key]: value };
    setSettings(next);
    saveAppSettings(next);
  }

  function handleResetSettings() {
    const reset = resetAppSettings();
    setSettings(reset);
    onToast(t('admin.settings.resetBtn'));
  }

  const baseline = useMemo(() => state.profiles.find(p => p.id === 'anthropic'), [state.profiles]);
  const activeProfile = useMemo(() => state.profiles.find(p => p.id === state.activeId), [state.profiles, state.activeId]);
  const liveEnv = useMemo(() => buildLaunchEnv(state), [state]);

  function startEdit(profile: ProviderProfile) {
    setEditingId(profile.id);
    setDraft({ ...profile, extraEnv: { ...(profile.extraEnv || {}) } });
    setShowKey(false);
    setTestResult(null);
  }

  function startCreate() {
    const blank = newBlankProfile();
    setEditingId('__new__');
    setDraft(blank);
    setShowKey(false);
    setTestResult(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
    setTestResult(null);
  }

  function commitDraft() {
    if (!draft) return;
    const id = draft.id?.trim() || slugify(draft.name) || `provider-${Date.now()}`;
    const profile: ProviderProfile = { ...draft, id };
    if (!profile.name.trim()) {
      onToast(t('admin.toasts.nameRequired'));
      return;
    }
    const next = upsertProfile(state, profile);
    onChange(next);
    setEditingId(null);
    setDraft(null);
    onToast(t('admin.toasts.profileSaved', { name: profile.name }));
  }

  function handleDelete(profile: ProviderProfile) {
    if (profile.builtin) { onToast(t('admin.toasts.builtinNotDeletable')); return; }
    if (!confirm(t('admin.confirmDelete', { name: profile.name }))) return;
    onChange(removeProfile(state, profile.id));
    onToast(t('admin.toasts.profileDeleted', { name: profile.name }));
  }

  function handleActivate(profile: ProviderProfile) {
    onChange(setActive(state, profile.id));
    onToast(t('admin.toasts.activeSet', { name: profile.name }));
  }

  async function handleTest(profile: ProviderProfile) {
    setTesting(true);
    setTestResult(t('admin.testing'));
    try {
      const r = await testProviderConnection(profile);
      setTestResult(`${r.ok ? '✅' : '❌'} ${r.message}`);
    } catch (e: unknown) {
      setTestResult(`❌ ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setTesting(false);
    }
  }

  function handleExport() {
    const json = exportProfiles(state);
    try {
      navigator.clipboard?.writeText(json);
      onToast(t('admin.toasts.jsonCopied'));
    } catch {
      // fallback: mostra num prompt
      prompt(t('admin.copyJsonPrompt'), json);
    }
  }

  function handleImport() {
    try {
      const next = importProfiles(importText);
      onChange(next);
      setImportText('');
      setShowImport(false);
      onToast(t('admin.toasts.importOk', { count: next.profiles.length }));
    } catch (e: unknown) {
      onToast(t('admin.toasts.importError', { error: e instanceof Error ? e.message : String(e) }));
    }
  }

  function handleReset() {
    if (!confirm(t('admin.confirmReset'))) return;
    onChange(resetProviders());
    onToast(t('admin.toasts.providersReset'));
  }

  async function handleResetClaudeState() {
    const ok = confirm(t('admin.confirmResetClaude'));
    if (!ok) return;
    try {
      const msg = await invoke<string>('reset_claude_state');
      onToast(msg);
    } catch (e) {
      onToast(t('admin.toasts.resetClaudeError', { error: e instanceof Error ? e.message : String(e) }));
    }
  }

  function handleBackupExport() {
    try {
      downloadConfigJson(appVersion ?? 'unknown');
      onToast(t('admin.toasts.configExported'));
    } catch (e: unknown) {
      onToast(t('admin.toasts.exportError', { error: e instanceof Error ? e.message : String(e) }));
    }
  }

  function handleBackupImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const mode = confirm(t('admin.confirmMerge')) ? 'merge' : 'replace';
        const result = importConfig(text, mode);
        if (!result.ok) {
          onToast(t('admin.toasts.importBackupFailed', { error: result.error }));
          return;
        }
        onToast(t('admin.toasts.importBackupOk', { count: result.redactedCount }));
      } catch (err: unknown) {
        onToast(t('admin.toasts.backupImportError', { error: err instanceof Error ? err.message : String(err) }));
      }
    };
    input.click();
  }

  function updateDraft<K extends keyof ProviderProfile>(key: K, value: ProviderProfile[K]) {
    setDraft(d => d ? { ...d, [key]: value } : d);
  }

  function addExtraEnv() {
    setDraft(d => d ? { ...d, extraEnv: { ...(d.extraEnv || {}), '': '' } } : d);
  }

  function updateExtraEnvKey(oldKey: string, newKey: string) {
    setDraft(d => {
      if (!d) return d;
      const entries = Object.entries(d.extraEnv || {});
      const idx = entries.findIndex(([k]) => k === oldKey);
      if (idx < 0) return d;
      entries[idx] = [newKey, entries[idx][1]];
      return { ...d, extraEnv: Object.fromEntries(entries) };
    });
  }

  function updateExtraEnvVal(key: string, val: string) {
    setDraft(d => d ? { ...d, extraEnv: { ...(d.extraEnv || {}), [key]: val } } : d);
  }

  function removeExtraEnv(key: string) {
    setDraft(d => {
      if (!d) return d;
      const next = { ...(d.extraEnv || {}) };
      delete next[key];
      return { ...d, extraEnv: next };
    });
  }

  function handleSaveCustomCli(cli: CustomCli) {
    const next = addCustomCli(customClis, cli);
    setCustomClis(next);
    saveCustomClis(next);
    setCustomModalOpen(false);
    setEditingCustomCli(null);
  }

  function handleDeleteCustomCli(key: string) {
    const target = customClis.find(c => c.key === key);
    if (!target) return;
    if (!confirm(t('customCli.deleteConfirm', { name: target.name }))) return;
    const next = removeCustomCli(customClis, key);
    setCustomClis(next);
    saveCustomClis(next);
  }

  function openAddCustomCli() {
    setEditingCustomCli(null);
    setCustomModalOpen(true);
  }

  function openEditCustomCli(cli: CustomCli) {
    setEditingCustomCli(cli);
    setCustomModalOpen(true);
  }

  function closeCustomCliModal() {
    setCustomModalOpen(false);
    setEditingCustomCli(null);
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <div>
          <h2>{t('admin.header.title')}</h2>
          <p className="admin-sub">
            {t('admin.header.sub')}{' '}
            <strong>{activeProfile?.name || '—'}</strong>
          </p>
        </div>
        <div className="admin-actions">
          <button className="btn" onClick={startCreate}>{t('admin.actions.newProfile')}</button>
          <button className="btn" onClick={handleExport} title={t('admin.buttons.exportTitle')}>{t('admin.buttons.export')}</button>
          <button className="btn" onClick={() => setShowImport(v => !v)}>{t('admin.actions.import')}</button>
          <button className="btn btn-danger" onClick={handleReset} title={t('admin.buttons.resetTitle')}>{t('admin.buttons.reset')}</button>
          <button
            className="btn btn-warn"
            onClick={handleResetClaudeState}
            title={t('admin.buttons.resetClaudeTitle')}
            aria-label={t('admin.buttons.resetClaudeLabel')}
          >
            {t('admin.actions.resetClaude')}
          </button>
        </div>
      </div>

      {showImport && (
        <div className="admin-card admin-import">
          <div className="section-title">{t('admin.import.title')}</div>
          <textarea
            className="input admin-import-ta"
            value={importText}
            onChange={e => setImportText(e.target.value)}
            placeholder={t('admin.import.placeholder')}
            rows={6}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn" onClick={handleImport}>{t('admin.import.submit')}</button>
            <button className="btn" onClick={() => { setShowImport(false); setImportText(''); }}>{t('admin.import.cancel')}</button>
          </div>
        </div>
      )}

      <div className="admin-grid">
        {state.profiles.map(profile => {
          const isActive = profile.id === state.activeId;
          const isEditing = editingId === profile.id;
          const cost = estimateCost(profile);
          const saving = savingsVsBaseline(profile, baseline);
          return (
            <div key={profile.id} className={`admin-card ${isActive ? 'active' : ''} ${isEditing ? 'editing' : ''}`}>
              <div className="admin-card-head">
                <div>
                  <strong>{profile.name}</strong>
                  {profile.builtin && <span className="admin-tag">{t('admin.cardBody.builtIn')}</span>}
                  {isActive && <span className="admin-tag admin-tag-active">{t('common.active')}</span>}
                </div>
                <div className="admin-card-actions">
                  {!isActive && <button className="btn btn-sm" onClick={() => handleActivate(profile)}>{t('admin.cardActions.activate')}</button>}
                  <button className="btn btn-sm" onClick={() => startEdit(profile)}>{t('admin.cardActions.edit')}</button>
                  <button className="btn btn-sm" onClick={() => handleTest(profile)} disabled={testing}>{t('admin.cardActions.test')}</button>
                  <button
                    className="btn btn-sm"
                    onClick={() => openDocs(DOCS_LINKS[profile.kind].url)}
                    title={DOCS_LINKS[profile.kind].label}
                  >{t('admin.cardActions.docs')}</button>
                  {!profile.builtin && (
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDelete(profile)}
                      title={t('admin.form.deleteProfileTitle')}
                      aria-label={t('admin.form.deleteProfileLabel', { name: profile.name })}
                    >×</button>
                  )}
                </div>
              </div>
              <div className="admin-card-body">
                <div className="admin-row"><span>{t('admin.cardBody.baseUrl')}</span><code>{profile.baseUrl || t('admin.cardBody.officialAnthropic')}</code></div>
                <div className="admin-row"><span>{t('admin.cardBody.opusSonnet')}</span><code>{profile.mainModel}</code></div>
                <div className="admin-row"><span>{t('admin.cardBody.haiku')}</span><code>{profile.fastModel}</code></div>
                <div className="admin-row"><span>{t('admin.cardBody.context')}</span><code>{t('admin.cardBody.contextUnit', { n: profile.contextWindow.toLocaleString() })}</code></div>
                <div className="admin-row">
                  <span>{t('admin.cardBody.costSession')}</span>
                  <code>
                    {formatUSD(cost.perTypicalSession)}
                    {saving && <span className="admin-saving"> · {saving}</span>}
                  </code>
                </div>
                {profile.note && <div className="admin-note">{profile.note}</div>}
              </div>
            </div>
          );
        })}
      </div>

      {editingId && draft && (
        <div className="admin-editor">
          <div className="section-title">{editingId === '__new__' ? t('admin.form.newProfile') : t('admin.form.editing', { name: draft.name })}</div>
          <div className="admin-form">
            <label>{t('admin.form.labels.name')}
              <input className="input" value={draft.name} onChange={e => updateDraft('name', e.target.value)} placeholder={t('admin.form.namePlaceholder')} />
            </label>
            <label>{t('admin.form.labels.kind')}
              <select className="input" value={draft.kind} onChange={e => updateDraft('kind', e.target.value as ProviderProfile['kind'])}>
                {PROVIDER_KIND_VALUES.map(v => <option key={v} value={v}>{t(`admin.providerKinds.${v}`)}</option>)}
              </select>
            </label>
            <label>{t('admin.form.labels.id')}
              <input className="input" value={draft.id} onChange={e => updateDraft('id', slugify(e.target.value))} placeholder={t('admin.form.idPlaceholder')} disabled={!!draft.builtin} />
            </label>
            <label>{t('admin.form.labels.baseUrl')}
              <input className="input" value={draft.baseUrl} onChange={e => updateDraft('baseUrl', e.target.value)} placeholder={t('admin.form.baseUrlPlaceholder')} />
            </label>
            <label>{t('admin.form.labels.apiKey')}
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  className="input"
                  type={showKey ? 'text' : 'password'}
                  value={draft.apiKey}
                  onChange={e => updateDraft('apiKey', e.target.value)}
                  placeholder={t('admin.form.apiKeyPlaceholder')}
                  autoComplete="off"
                />
                <button className="btn btn-sm" type="button" onClick={() => setShowKey(v => !v)}>{showKey ? '🙈' : '👁'}</button>
              </div>
            </label>
            <label>{t('admin.form.labels.mainModel')}
              <input
                className="input"
                value={draft.mainModel}
                onChange={e => updateDraft('mainModel', e.target.value)}
                placeholder={t('admin.form.mainModelPlaceholder')}
                list={`models-main-${draft.kind}`}
              />
              <datalist id={`models-main-${draft.kind}`}>
                {hintsFor(draft.kind, 'main').map(m => <option key={m} value={m} />)}
              </datalist>
            </label>
            <label>{t('admin.form.labels.fastModel')}
              <input
                className="input"
                value={draft.fastModel}
                onChange={e => updateDraft('fastModel', e.target.value)}
                placeholder={t('admin.form.smallModelPlaceholder')}
                list={`models-fast-${draft.kind}`}
              />
              <datalist id={`models-fast-${draft.kind}`}>
                {hintsFor(draft.kind, 'fast').map(m => <option key={m} value={m} />)}
              </datalist>
            </label>
            <label>{t('admin.form.labels.contextWindow')}
              <input
                className="input"
                type="number"
                value={draft.contextWindow}
                onChange={e => updateDraft('contextWindow', parseInt(e.target.value || '0', 10))}
              />
            </label>
            <label>{t('admin.form.labels.priceInput')}
              <input
                className="input"
                type="number"
                step="0.01"
                value={draft.priceInPerM ?? 0}
                onChange={e => updateDraft('priceInPerM', parseFloat(e.target.value || '0'))}
              />
            </label>
            <label>{t('admin.form.labels.priceOutput')}
              <input
                className="input"
                type="number"
                step="0.01"
                value={draft.priceOutPerM ?? 0}
                onChange={e => updateDraft('priceOutPerM', parseFloat(e.target.value || '0'))}
              />
            </label>
            <label>{t('admin.form.labels.dailyBudget')}
              <input
                className="input"
                type="number"
                step="0.5"
                min="0"
                value={draft.dailyBudget ?? 0}
                onChange={e => updateDraft('dailyBudget', parseFloat(e.target.value || '0'))}
                placeholder={t('admin.form.dailyBudgetPlaceholder')}
              />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>{t('admin.form.labels.note')}
              <input className="input" value={draft.note || ''} onChange={e => updateDraft('note', e.target.value)} placeholder={t('admin.form.notePlaceholder')} />
            </label>

            <div style={{ gridColumn: '1 / -1' }}>
              <div className="section-title" style={{ marginTop: 12 }}>{t('admin.form.extraEnvTitle')}</div>
              <div className="admin-extra-env">
                {Object.entries(draft.extraEnv || {}).map(([k, v]) => (
                  <div key={`env-${k}`} className="admin-env-row">
                    <input className="input" value={k} onChange={e => updateExtraEnvKey(k, e.target.value.toUpperCase())} placeholder={t('admin.form.envKeyPlaceholder')} />
                    <input className="input" value={v} onChange={e => updateExtraEnvVal(k, e.target.value)} placeholder={t('admin.form.envValuePlaceholder')} />
                    <button
                      className="btn btn-sm btn-danger"
                      type="button"
                      onClick={() => removeExtraEnv(k)}
                      title={t('admin.form.removeEnvTitle')}
                      aria-label={t('admin.form.removeEnvLabel', { key: k || t('admin.form.emptyPlaceholder') })}
                    >×</button>
                  </div>
                ))}
                <button className="btn btn-sm" type="button" onClick={addExtraEnv}>{t('admin.form.addEnv')}</button>
              </div>
            </div>
          </div>

          <div className="admin-editor-actions">
            <button className="btn" onClick={() => handleTest(draft)} disabled={testing}>{testing ? t('admin.testing') : t('admin.testConnection')}</button>
            <div style={{ flex: 1 }} />
            <button className="btn" onClick={cancelEdit}>{t('admin.form.cancel')}</button>
            <button className="launch-btn" onClick={commitDraft}>{t('admin.form.save')}</button>
          </div>
          {testResult && <div className="admin-test-result">{testResult}</div>}
        </div>
      )}

      <div className="admin-card admin-debug">
        <div className="section-title">{t('admin.form.envPreviewTitle')}</div>
        {liveEnv
          ? (
            <pre className="admin-env-pre">
              {Object.entries(redactEnv(liveEnv)).map(([k, v]) => `${k}=${v}`).join('\n')}
            </pre>
          )
          : <div className="admin-note">{t('admin.form.noEnvs')}</div>}
      </div>

      <AppearanceSection />

      <section className="admin-section admin-settings">
        <h3 className="admin-section__title">
          <span>{t('admin.settings.title')}</span>
        </h3>
        <div className="admin-settings__fields">
          <label className="admin-settings__field">
            <span className="admin-settings__label">{t('admin.settings.maxHistory')}</span>
            <input
              type="number"
              min="1"
              max="1000"
              className="admin-settings__input"
              value={settings.maxHistory}
              onChange={e =>
                updateSetting(
                  'maxHistory',
                  Math.max(1, parseInt(e.target.value, 10) || DEFAULT_SETTINGS.maxHistory),
                )
              }
            />
            <span className="admin-settings__hint">{t('admin.settings.maxHistoryHint')}</span>
          </label>
          <label className="admin-settings__field">
            <span className="admin-settings__label">{t('admin.settings.refreshInterval')}</span>
            <input
              type="number"
              min="0"
              max="3600"
              className="admin-settings__input"
              value={settings.refreshInterval}
              onChange={e =>
                updateSetting('refreshInterval', Math.max(0, parseInt(e.target.value, 10) || 0))
              }
            />
            <span className="admin-settings__hint">{t('admin.settings.refreshIntervalHint')}</span>
          </label>
          <label className="admin-settings__field">
            <span className="admin-settings__label">{t('admin.settings.commandTimeout')}</span>
            <input
              type="number"
              min="1"
              max="600"
              className="admin-settings__input"
              value={settings.commandTimeout}
              onChange={e =>
                updateSetting(
                  'commandTimeout',
                  Math.max(1, parseInt(e.target.value, 10) || DEFAULT_SETTINGS.commandTimeout),
                )
              }
            />
            <span className="admin-settings__hint">{t('admin.settings.commandTimeoutHint')}</span>
          </label>
        </div>
        <button type="button" className="btn" onClick={handleResetSettings}>
          {t('admin.settings.resetBtn')}
        </button>
      </section>

      <section className="admin-section admin-custom-clis">
        <h3 className="admin-section__title">
          <span>{t('customCli.addTitle')}</span>
        </h3>
        {customClis.length === 0 ? (
          <p className="admin-section__hint">{t('customCli.emptyState')}</p>
        ) : (
          <ul className="admin-custom-list">
            {customClis.map(c => (
              <li key={c.key} className="admin-custom-list__item">
                <span className="admin-custom-list__icon" aria-hidden="true">{c.iconEmoji || '\u25B6'}</span>
                <span className="admin-custom-list__name">{c.name}</span>
                <code className="admin-custom-list__key">{c.key}</code>
                <span className="admin-custom-list__spacer" />
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => openEditCustomCli(c)}
                >
                  {t('common.edit')}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={() => handleDeleteCustomCli(c.key)}
                >
                  {t('customCli.delete')}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="admin-custom-list__actions">
          <button type="button" className="btn" onClick={openAddCustomCli}>
            {t('customCli.addBtn')}
          </button>
        </div>
      </section>

      <CustomCliModal
        open={customModalOpen}
        editing={editingCustomCli}
        existingKeys={customClis.map(c => c.key)}
        onSave={handleSaveCustomCli}
        onCancel={closeCustomCliModal}
      />

      <section className="admin-section admin-backup">
        <h3 className="admin-section__title">
          <Download size={14} strokeWidth={1.5} aria-hidden="true" />
          <span>{t('admin.backup.title')}</span>
        </h3>
        <p className="admin-section__hint">
          {t('admin.backup.hint')}
        </p>
        <div className="admin-backup__actions">
          <button type="button" className="btn" onClick={handleBackupExport}>
            <Download size={12} strokeWidth={1.5} aria-hidden="true" /> {t('admin.backup.exportBtn')}
          </button>
          <button type="button" className="btn" onClick={handleBackupImport}>
            <Upload size={12} strokeWidth={1.5} aria-hidden="true" /> {t('admin.backup.importBtn')}
          </button>
        </div>
      </section>
    </div>
  );
}
