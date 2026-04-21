// ==============================================================================
// AI Launcher Pro - LauncherTab
// Extraído de App.tsx (Task 8 do split). JSX IDÊNTICO ao original.
// ==============================================================================

import { useTranslation } from 'react-i18next';
import { open as openUrl } from '@tauri-apps/plugin-shell';
import { EmptyState } from '../EmptyState';
import { Skeleton } from '../Skeleton';
import { PresetsBar } from '../presets/PresetsBar';
import { ProviderSelector } from '../providers/ProviderSelector';
import { CliIcon, CLI_COLORS } from '../App';
import { Play, ExternalLink } from '../icons';
import type { LaunchPreset } from '../presets/types';
import type { ProvidersState } from '../providers/types';
import './LauncherTab.css';

// Tipos compartilhados com App.tsx — duplicados aqui pra não criar arquivo
// shared ainda (pode ser extraído em task futura).
interface CliInfo {
  key: string;
  name: string;
  command: string;
  flag: string | null;
  install_cmd: string;
  version_cmd: string;
  npm_pkg: string | null;
  pip_pkg: string | null;
  install_method: string;
  install_url: string | null;
}

interface UpdateInfo {
  cli: string;
  current: string | null;
  latest: string | null;
  has_update: boolean;
  method: string;
  no_api: boolean;
  key?: string;
}

interface UpdatesSummary {
  cli_updates: UpdateInfo[];
  env_updates: UpdateInfo[];
  tool_updates: UpdateInfo[];
  checked_at: string;
  total_with_updates: number;
}

export interface LauncherTabProps {
  // Boot / meta
  bootReady: boolean;
  hasChecked: boolean;
  adminMode: boolean;

  // CLIs / installed
  clis: CliInfo[];
  installed: Record<string, { installed: boolean; version: string | null }>;
  installedClis: CliInfo[];
  updatesSummary: UpdatesSummary | null;

  // Launcher state
  selectedCli: string;
  setSelectedCli: (v: string) => void;
  directory: string;
  setDirectory: (v: string) => void;
  args: string;
  setArgs: (v: string) => void;
  noPerms: boolean;
  setNoPerms: (v: boolean) => void;
  multiSelected: string[];
  toggleMultiCli: (key: string) => void;

  // Diretório / recentes
  directoryInputRef: React.RefObject<HTMLInputElement | null>;
  recentProjects: string[];
  removeRecent: (p: string) => void;
  basenameOf: (p: string) => string;

  // Providers
  providers: ProvidersState;
  updateProviders: (next: ProvidersState) => void;

  // Presets
  presets: LaunchPreset[];
  launchFromPreset: (p: LaunchPreset) => void;
  removePresetById: (id: string) => void;
  savePresetFromCurrent: (name: string, emoji: string) => void;
  renamePreset: (id: string, name: string) => void;

  // Ações
  pickDir: () => void;
  launch: () => void;
  launchMulti: () => void;
  setDryRunOpen: (v: boolean) => void;
  setActiveTab: (tab: string) => void;

  // Helpers / callbacks
  saveConfigDirectory: (dir: string) => void;
  openInExplorer: (path: string) => void;
}

export function LauncherTab(props: LauncherTabProps) {
  const {
    bootReady,
    hasChecked,
    adminMode,
    clis,
    installed,
    installedClis,
    updatesSummary,
    selectedCli,
    setSelectedCli,
    directory,
    setDirectory,
    args,
    setArgs,
    noPerms,
    setNoPerms,
    multiSelected,
    toggleMultiCli,
    directoryInputRef,
    recentProjects,
    removeRecent,
    basenameOf,
    providers,
    updateProviders,
    presets,
    launchFromPreset,
    removePresetById,
    savePresetFromCurrent,
    renamePreset,
    pickDir,
    launch,
    launchMulti,
    setDryRunOpen,
    setActiveTab,
    saveConfigDirectory,
    openInExplorer,
  } = props;

  const { t } = useTranslation();

  function cliDescription(key: string): string {
    return t(`launcher.cliDescriptions.${key}`, { defaultValue: '' });
  }

  const selectedCliData = clis.find(c => c.key === selectedCli);
  const cliInfo = installed[selectedCli] || { installed: false, version: null };

  // Empty-state: nenhum CLI instalado ainda
  if (bootReady && hasChecked && installedClis.length === 0 && clis.length > 0) {
    return (
      <div className="content">
        <div style={{ flex: 1 }}>
          <EmptyState onInstallClick={() => setActiveTab('install')} />
        </div>
      </div>
    );
  }

  return (
    <div className="content">
      <div className="left-col">
        <PresetsBar
          presets={presets}
          onLaunch={launchFromPreset}
          onRemove={removePresetById}
          onSave={savePresetFromCurrent}
          onRename={renamePreset}
        />
        <div className="section">
          <div className="section-title">{t('launcher.sectionClis')}</div>
          <div className="launcher-cli-grid">
            {clis.map(cli => {
              const info = installed[cli.key] || { installed: false, version: null };
              const hasUpdate = updatesSummary?.cli_updates.find(u => {
                const k = clis.find(c => c.name === u.cli)?.key;
                return k === cli.key && u.has_update;
              });
              const isSelected = selectedCli === cli.key;
              const stateClass = info.installed ? 'is-installed' : 'is-missing';
              return (
                <article
                  key={cli.key}
                  className={`launcher-cli-card ${isSelected ? 'is-selected' : ''} ${stateClass}`}
                  style={{ '--c': CLI_COLORS[cli.key] || '#8B1E2A' } as React.CSSProperties}
                  onClick={() => setSelectedCli(cli.key)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedCli(cli.key);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                >
                  <header className="launcher-cli-card__head">
                    <span className="launcher-cli-card__prompt" aria-hidden="true">&gt;</span>
                    <span className="launcher-cli-card__icon">
                      <CliIcon cliKey={cli.key} size={20} />
                    </span>
                    <h3 className="launcher-cli-card__name">{cli.name.toUpperCase()}</h3>
                    <span className="launcher-cli-card__version">
                      {!hasChecked
                        ? <Skeleton width={40} height={10} />
                        : (info.version ? `v${info.version}` : '—')}
                    </span>
                  </header>
                  <div className="launcher-cli-card__status-row">
                    <span
                      className="launcher-cli-card__status"
                      aria-label={info.installed ? t('launcher.installed') : t('launcher.missing')}
                    >
                      {info.installed ? t('launcher.installed') : t('launcher.missing')}
                    </span>
                    {hasUpdate && (
                      <span className="launcher-cli-card__update" title={t('launcher.updateTitle')}>
                        {t('launcher.update')}
                      </span>
                    )}
                  </div>
                  <p className="launcher-cli-card__desc">{cliDescription(cli.key)}</p>
                  <div className="launcher-cli-card__actions">
                    <button
                      type="button"
                      className="btn-cli-primary"
                      disabled={!info.installed}
                      onClick={e => {
                        e.stopPropagation();
                        setSelectedCli(cli.key);
                        launch();
                      }}
                      title={info.installed ? t('launcher.launchCtaTitle') : t('launcher.launchCtaDisabled')}
                    >
                      <Play size={12} strokeWidth={1.5} />
                      <span>{t('launcher.launch')}</span>
                    </button>
                    {cli.install_url && (
                      <button
                        type="button"
                        className="btn-cli-ghost"
                        onClick={e => {
                          e.stopPropagation();
                          if (cli.install_url) {
                            openUrl(cli.install_url).catch(() => {
                              /* silently fail — fallback to no-op */
                            });
                          }
                        }}
                        title={t('launcher.docsTitle')}
                      >
                        <ExternalLink size={12} strokeWidth={1.5} />
                        <span>{t('launcher.docs')}</span>
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="section">
          <div className="section-title">{t('launcher.sectionMulti')}</div>
          <div className="multi-list">
            {clis.map(cli => {
              const canUse = installed[cli.key]?.installed || false;
              return (
                <label key={cli.key} className={`multi-item ${!canUse ? 'disabled' : ''}`}>
                  <input type="checkbox"
                    checked={multiSelected.includes(cli.key)}
                    onChange={() => canUse ? toggleMultiCli(cli.key) : undefined}
                    disabled={!canUse} />
                  <span>{cli.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      <div className="right-col">
        <div className="section">
          <div className="section-title">{t('launcher.sectionDirectory')}</div>
          <div className="dir-row">
            <input ref={directoryInputRef} className="input" value={directory} onChange={e => setDirectory(e.target.value)} placeholder={t('launcher.directoryPlaceholder')} />
            <button className="btn btn-labeled" onClick={pickDir} title={t('launcher.pickFolder')}>
              <span>📂</span><small>{t('launcher.pickFolderLabel')}</small>
            </button>
            <button className="btn btn-labeled" onClick={() => {
              if (directory) {
                openInExplorer(directory);
              }
            }} title={t('launcher.openInExplorer')}>
              <span>📁</span><small>{t('launcher.openInExplorerLabel')}</small>
            </button>
          </div>
          {recentProjects.length > 0 && (
            <div className="recent-list">
              {recentProjects.map(p => (
                <span key={p} className="recent-pill" title={p}>
                  <button
                    className="recent-pill-main"
                    onClick={() => { setDirectory(p); saveConfigDirectory(p); }}
                  >
                    📁 {basenameOf(p)}
                  </button>
                  <button
                    className="recent-pill-x"
                    onClick={() => removeRecent(p)}
                    title={t('launcher.removeFromHistory')}
                    aria-label={t('launcher.removeEntry', { name: basenameOf(p) })}
                  >✕</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="section">
          <div className="section-title">{t('launcher.sectionArgs')}</div>
          <input className="input" placeholder={t('launcher.argsPlaceholder')} value={args} onChange={e => setArgs(e.target.value)} />
        </div>

        <div className="section">
          <label className="checkbox">
            <input type="checkbox" checked={noPerms} onChange={e => setNoPerms(e.target.checked)} />
            <span>{t('launcher.noPerms')}</span>
          </label>
        </div>

        {adminMode && (
          <ProviderSelector
            state={providers}
            onChange={updateProviders}
            selectedCli={selectedCli}
          />
        )}

        {selectedCliData && (
          <div className="cli-info" style={{ '--c': CLI_COLORS[selectedCli] || '#8B1E2A' } as React.CSSProperties}>
            <div className="cli-info-header">
              <div className="cli-icon-lg"><CliIcon cliKey={selectedCli} size={48} /></div>
              <div>
                <div className="cli-info-name">{selectedCliData.name}</div>
                <div className="cli-info-version">
                  {installed[selectedCli]?.version || t('launcher.notInstalled')}
                </div>
              </div>
            </div>
            <div className="cli-info-flag">{t('launcher.flagLabel')}<code>{selectedCliData.flag || t('common.none')}</code></div>
          </div>
        )}

        <div className="preview">
          <div className="preview-title">{t('launcher.sectionPreview')}</div>
          <code>{selectedCliData?.command} {args} {noPerms && selectedCliData?.flag}</code>
        </div>

        <div className="launch-row">
          <button className="launch-btn" onClick={launch} disabled={!cliInfo.installed}>
            {t('launcher.startCli', { name: selectedCliData?.name?.toUpperCase() ?? '' })} <small style={{opacity:0.6, marginLeft:8}}>Ctrl+K</small>
          </button>
          <button
            className="btn btn-preview"
            onClick={() => setDryRunOpen(true)}
            title={t('launcher.previewTitle')}
          >{t('launcher.preview')}</button>
        </div>

        {multiSelected.length > 0 && (
          <button className="launch-btn multi" onClick={launchMulti}>
            {t('launcher.startMulti', { count: multiSelected.length })}
          </button>
        )}
      </div>
    </div>
  );
}
