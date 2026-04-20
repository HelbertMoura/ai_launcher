// ==============================================================================
// AI Launcher Pro - Dry-Run Preview
// Mostra o CMD completo + envs (redacted) que serão usados no launch.
// ==============================================================================

import { useMemo } from 'react';
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
      `cd /d "${directory || '(atual)'}"`,
      fullCmd,
    ].filter(Boolean).join('\r\n');
    navigator.clipboard?.writeText(txt).catch(() => prompt('Copie abaixo:', txt));
  }

  return (
    <div className="dryrun-overlay" onClick={onClose}>
      <div className="dryrun-modal" onClick={e => e.stopPropagation()}>
        <div className="dryrun-head">
          <h3>🔬 Preview do launch</h3>
          <button
            className="btn btn-sm"
            onClick={onClose}
            title="Fechar preview"
            aria-label="Fechar preview de launch"
          >✕</button>
        </div>
        <div className="dryrun-body">
          <div>
            <div className="section-title">CLI</div>
            <code className="dryrun-code">{fullCmd}</code>
          </div>
          <div>
            <div className="section-title">Diretório</div>
            <code className="dryrun-code">{directory || '(diretório atual)'}</code>
          </div>
          <div>
            <div className="section-title">Env vars injetadas</div>
            {envVars
              ? (
                <pre className="dryrun-env">
                  {Object.entries(redacted).map(([k, v]) => `${k}=${v}`).join('\n')}
                </pre>
              )
              : <div className="admin-note">Nenhuma env (usa config default do {selectedCli}).</div>}
          </div>
        </div>
        <div className="dryrun-actions">
          <button className="btn" onClick={copyAll}>📋 Copiar como script .bat</button>
          <button className="btn" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
