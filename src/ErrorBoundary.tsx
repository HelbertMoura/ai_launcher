import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open as openUrl } from '@tauri-apps/plugin-shell';
import i18n from './i18n';
import './ErrorBoundary.css';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
  stack: string;
  logPath: string | null;
  copied: boolean;
}

/**
 * ErrorBoundary — captura erros de render do React.
 * Salva stack completa em %APPDATA%\ai-launcher\crash via save_crash_log.
 * Mostra modal com ações: copiar log, abrir pasta, reportar, recarregar.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      message: '',
      stack: '',
      logPath: null,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      message: error.message || 'Erro desconhecido',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    const fullStack =
      (error.message || '') +
      '\n' +
      (error.stack || '') +
      '\n\nComponentStack:' +
      (info.componentStack || '');

    this.setState({ stack: fullStack });

    // Salva log via Tauri. Se falhar (ex: dev sem Tauri), só loga no console.
    invoke<string>('save_crash_log', { stack: fullStack, context: 'react-render' })
      .then((path) => {
        this.setState({ logPath: path });
      })
      .catch((e) => {
        console.error('[ErrorBoundary] save_crash_log falhou:', e);
      });

    // Também loga no console para devs
    console.error('[ErrorBoundary] Render error:', error, info);
  }

  handleCopyLog = async (): Promise<void> => {
    try {
      let content = this.state.stack;
      if (this.state.logPath) {
        try {
          content = await invoke<string>('read_crash_log', { path: this.state.logPath });
        } catch (e) {
          console.error('[ErrorBoundary] read_crash_log falhou:', e);
        }
      }
      await navigator.clipboard.writeText(content);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch (e) {
      console.error('[ErrorBoundary] copy failed:', e);
    }
  };

  handleOpenDir = (): void => {
    invoke('open_crash_dir').catch((e) => {
      console.error('[ErrorBoundary] open_crash_dir falhou:', e);
    });
  };

  handleReport = (): void => {
    const title = encodeURIComponent(`Crash: ${this.state.message.slice(0, 80)}`);
    const bodyRaw =
      '## Descrição\nO app travou com um erro de render.\n\n' +
      '## Log (cole aqui o conteúdo)\n```\n' +
      this.state.stack.slice(0, 1800) +
      '\n```\n';
    const body = encodeURIComponent(bodyRaw);
    const url = `https://github.com/PLACEHOLDER_USER/ai-launcher/issues/new?title=${title}&body=${body}`;
    openUrl(url).catch((e) => {
      console.error('[ErrorBoundary] open url falhou:', e);
    });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="errbnd-overlay" role="alertdialog" aria-modal="true">
        <div className="errbnd-modal">
          <div className="errbnd-header">
            <span className="errbnd-emoji" aria-hidden="true">💥</span>
            <h2 className="errbnd-title">Algo quebrou</h2>
          </div>

          <p className="errbnd-desc">
            O app capturou um erro de render. Um log foi salvo localmente.
          </p>

          <div className="errbnd-msg">
            <strong>Mensagem:</strong> {this.state.message}
          </div>

          {this.state.logPath && (
            <div className="errbnd-path-wrap">
              <label className="errbnd-path-label">Arquivo de log:</label>
              <input
                className="errbnd-path"
                type="text"
                readOnly
                value={this.state.logPath}
                onFocus={(e) => e.currentTarget.select()}
              />
            </div>
          )}

          <div className="errbnd-actions">
            <button className="errbnd-btn" onClick={this.handleCopyLog}>
              {this.state.copied ? '✓ Copiado' : '📋 Copiar log'}
            </button>
            <button className="errbnd-btn" onClick={this.handleOpenDir}>
              📁 Abrir pasta de crashes
            </button>
            <button className="errbnd-btn" onClick={this.handleReport}>
              🐞 Reportar no GitHub
            </button>
            <button className="errbnd-btn errbnd-btn-primary" onClick={this.handleReload}>
              🔄 Recarregar app
            </button>
          </div>
        </div>
      </div>
    );
  }
}
  );
  }
}
rt', '🐞 Reportar no GitHub')}
            </button>
            <button className="errbnd-btn errbnd-btn-primary" onClick={this.handleReload}>
              {i18n.t('errorBoundary.reload', '🔄 Recarregar app')}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
