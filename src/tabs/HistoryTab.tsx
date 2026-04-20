// ==============================================================================
// AI Launcher Pro - HistoryTab
// Extraído de App.tsx. JSX IDÊNTICO ao original.
// ==============================================================================

import type { LaunchProviderInfo } from '../providers/types';

// Tipo duplicado do App.tsx — evita criar arquivo shared por ora.
interface HistoryItem {
  cli: string;
  cliKey: string;
  directory: string;
  args: string;
  timestamp: string;
  provider?: LaunchProviderInfo;
}

export interface HistoryTabProps {
  history: HistoryItem[];
  clearHistory: () => void;
  relaunchFromHistory: (item: HistoryItem) => void;
}

export function HistoryTab({ history, clearHistory, relaunchFromHistory }: HistoryTabProps) {
  return (
    <div className="tab-scroll">
      <div className="tab-pad">
      <div className="history-header">
        <h2>📜 Histórico</h2>
        {history.length > 0 && <button className="btn btn-danger" onClick={clearHistory}>🗑️ Limpar</button>}
      </div>
      <div className="history-list">
        {history.length === 0 ? (
          <p className="empty">Nenhuma execução ainda.</p>
        ) : (
          history.map((item, i) => (
            <div key={i} className="history-item">
              <div className="history-left">
                <span className="history-cli">{item.cli}</span>
                <span className="history-dir">{item.directory}</span>
                {item.args && <span className="history-args">{item.args}</span>}
                {item.provider && (
                  <span className={`history-provider kind-${item.provider.providerKind}`}
                        title={`Provider: ${item.provider.providerName}`}>
                    via {item.provider.providerName} · {item.provider.mainModel}
                  </span>
                )}
              </div>
              <div className="history-right">
                <span className="history-time">{item.timestamp}</span>
                <button className="btn-relaunch" onClick={() => relaunchFromHistory(item)} title="Relançar">▶</button>
              </div>
            </div>
          ))
        )}
      </div>
      </div>
    </div>
  );
}
