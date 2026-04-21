// ==============================================================================
// AI Launcher Pro - Dry-Run Preview
// Mostra o CMD completo + envs (redacted) que serão usados no launch.
// ==============================================================================

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProvidersState } from './types';
import { buildLaunchEnv, redactEnv } from './storage';

interface DryRunModalProps {
  open: boolean;
  state: ProvidersState;
  selectedCli: string;
  command: string;
  flag: string | null;
  noPerms: boolean;
  args: string;
  directory: string;
  onClose: () => void;
}

export function DryRunModal({
  open, state, selectedCli, command, flag, noPerms, args, directory, onClose,
}: DryRunModalProps) {
  const { t } = useTranslation();
  const envVars = useMemo(
    () => (selectedCli === 'claude' ? buildLaunchEnv(state) : undefined),
    [state, selectedCli],
  );
  const redacted = useMemo(() => redactEnv(envVars), [envVars]);
  const fullCmd = useMemo(() => {
    const parts = [command];
    if (args) parts.push(args);
    if (noPerms && flag) parts.push(flag);
    return parts.join(' ');
  }, [command, args, noPerms, flag]);

  if (!open) return null;

  function copyAll() {
    const envBlock = Object.entries(envVars || {}).map(([k, v]) => `set ${k}=${v}`).join('\r\n');
    const txt = [
      envBlock,
      `cd /d "${directory || t('dryRun.cwdFallback')}"`,
      fullCmd,
    ].filter(Boolean).join('\r\n');
    navigator.clipboard?.writeText(txt).catch(() => prompt(t('dryRun.copyPrompt'), txt));
  }

  return (
    <div className="dryrun-overlay" onClick={onClose}>
      <div className="dryrun-modal" onClick={e => e.stopPropagation()}>
        <div className="dryrun-head">
          <h3>{t('dryRun.title')}</h3>
          <button
            className="btn btn-sm"
            onClick={onClose}
            title={t('dryRun.closeTitle')}
            aria-label={t('dryRun.closeLabel')}
          >✕</button>
        </div>
        <div className="dryrun-body">
          <div>
            <div className="section-title">{t('dryRun.cli')}</div>
            <code className="dryrun-code">{fullCmd}</code>
          </div>
          <div>
            <div className="section-title">{t('dryRun.directory')}</div>
            <code className="dryrun-code">{directory || t('dryRun.directoryFallback')}</code>
          </div>
          <div>
            <div className="section-title">{t('dryRun.envVars')}</div>
            {envVars
              ? (
                <pre className="dryrun-env">
                  {Object.entries(redacted).map(([k, v]) => `${k}=${v}`).join('\n')}
                </pre>
              )
              : <div className="admin-note">{t('dryRun.noEnvs', { cli: selectedCli })}</div>}
          </div>
        </div>
        <div className="dryrun-actions">
          <button className="btn" onClick={copyAll}>{t('dryRun.copyScript')}</button>
          <button className="btn" onClick={onClose}>{t('dryRun.close')}</button>
        </div>
      </div>
    </div>
  );
}
