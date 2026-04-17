import { useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './Orchestrator.css';

// ==================== TYPES ====================

// Estes tipos são um subset dos do App.tsx — mantidos localmente para evitar
// acoplamento com o export padrão do App. Se o App eventualmente expuser os
// tipos via barrel, podemos importar dele.
interface CliInfoLite {
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

interface InstallStatus {
  installed: boolean;
  version: string | null;
}

interface OrchestratorProps {
  clis: CliInfoLite[];
  installed: Record<string, InstallStatus>;
  directory: string;
  setDirectory: (d: string) => void;
  pickDirectory: () => void | Promise<void>;
  onToast: (msg: string) => void;
}

type LaunchMode = 'split' | 'batch';

type PanelStatus = 'idle' | 'launching' | 'ok' | 'error';

interface PanelState {
  cliKey: string;
  status: PanelStatus;
  message: string;
}

// Cores CLI (subset; o App dono tem a fonte definitiva — aqui replicamos só o
// que precisamos para o border-left dos painéis, sem importar de App.tsx).
const ORCH_CLI_COLORS: Record<string, string> = {
  claude: '#CC785C',
  codex: '#10A37F',
  gemini: '#4285F4',
  qwen: '#615CED',
  kilocode: '#5BA4FC',
  opencode: '#E8E6E3',
  crush: '#FF4FA3',
  droid: '#FF5722',
};

const MAX_SELECTION = 4;
const MIN_SELECTION = 2;

function isWindows(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const platform = (navigator as unknown as { platform?: string }).platform || '';
  return ua.includes('Windows') || platform.includes('Win');
}

// ==================== COMPONENT ====================

function Orchestrator(props: OrchestratorProps) {
  const { clis, installed, directory, pickDirectory, onToast } = props;

  const [selected, setSelected] = useState<string[]>([]);
  const [sharedArgs, setSharedArgs] = useState('');
  const [mode, setMode] = useState<LaunchMode>('split');
  const [launching, setLaunching] = useState(false);
  const [panels, setPanels] = useState<Record<string, PanelState>>({});
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [handoffFrom, setHandoffFrom] = useState<string>('');
  const [handoffTo, setHandoffTo] = useState<string>('');
  const [handoffText, setHandoffText] = useState('');
  const [preferSplitPane, setPreferSplitPane] = useState(true);

  const installedList = useMemo(
    () => clis.filter(c => installed[c.key]?.installed),
    [clis, installed],
  );

  const selectionCountLabel = `${selected.length}/${MAX_SELECTION} selecionadas`;
  const canLaunch = selected.length >= MIN_SELECTION && directory.trim().length > 0 && !launching;

  function toggleSelect(key: string) {
    setSelected(prev => {
      if (prev.includes(key)) return prev.filter(k => k !== key);
      if (prev.length >= MAX_SELECTION) {
        onToast(`Máximo ${MAX_SELECTION} CLIs no orquestrador`);
        return prev;
      }
      return [...prev, key];
    });
  }

  function clearSelection() {
    setSelected([]);
    setPanels({});
  }

  async function handleLaunchMulti() {
    if (!canLaunch) {
      if (selected.length < MIN_SELECTION) {
        onToast(`Selecione pelo menos ${MIN_SELECTION} CLIs`);
      } else if (!directory.trim()) {
        onToast('Escolha um diretório antes de lançar');
      }
      return;
    }
    if (mode === 'batch' && !sharedArgs.trim()) {
      onToast('Modo batch requer um prompt/args compartilhado');
      return;
    }

    setLaunching(true);
    const initialPanels: Record<string, PanelState> = {};
    for (const key of selected) {
      initialPanels[key] = { cliKey: key, status: 'launching', message: 'Iniciando...' };
    }
    setPanels(initialPanels);

    try {
      const msg = await invoke<string>('launch_multi_clis', {
        cliKeys: selected,
        directory,
        args: sharedArgs,
        noPerms: true,
        envVars: undefined,
      });

      // Backend atual retorna só uma string agregada ("Iniciados N CLIs"),
      // sem resultado individual por CLI. Marcamos todos como ok; quando o
      // backend evoluir para retornar lista estruturada, adaptamos aqui.
      const ok: Record<string, PanelState> = {};
      for (const key of selected) {
        ok[key] = { cliKey: key, status: 'ok', message: 'Iniciado' };
      }
      setPanels(ok);
      onToast(msg || `Iniciados ${selected.length} CLIs`);
    } catch (e) {
      const errMsg = String(e).slice(0, 160);
      const fail: Record<string, PanelState> = {};
      for (const key of selected) {
        fail[key] = { cliKey: key, status: 'error', message: errMsg };
      }
      setPanels(fail);
      onToast(`Erro no multi-launch: ${errMsg}`);
    } finally {
      setLaunching(false);
    }
  }

  async function handleCopyHandoff() {
    if (!handoffFrom || !handoffTo) {
      onToast('Selecione a sessão de origem e destino');
      return;
    }
    if (handoffFrom === handoffTo) {
      onToast('Origem e destino precisam ser diferentes');
      return;
    }
    if (!handoffText.trim()) {
      onToast('Cole o contexto da sessão de origem antes de transferir');
      return;
    }
    const fromName = clis.find(c => c.key === handoffFrom)?.name || handoffFrom;
    const toName = clis.find(c => c.key === handoffTo)?.name || handoffTo;
    const payload =
      `--- CONTEXTO TRANSFERIDO DE ${fromName.toUpperCase()} ---\n` +
      `# Destino: ${toName}\n\n` +
      handoffText.trim() +
      `\n\n--- FIM DO CONTEXTO ---\n`;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(payload);
        onToast(`Contexto copiado. Cole na sessão ${toName}.`);
      } else {
        onToast('Clipboard indisponível neste ambiente');
      }
    } catch (e) {
      onToast(`Falha ao copiar: ${String(e).slice(0, 120)}`);
    }
  }

  const gridColsClass =
    selected.length <= 1 ? 'cols-1' :
    selected.length === 2 ? 'cols-2' :
    selected.length === 3 ? 'cols-3' : 'cols-4';

  return (
    <div className="orch-root tab-scroll">
      <div className="tab-pad">
        <div className="orch-header">
          <h2>⚡ Orquestrador Multi-CLI</h2>
          <p className="orch-sub">
            Lance 2 a {MAX_SELECTION} CLIs de uma vez sobre o mesmo diretório e
            acompanhe o status lado a lado. Ideal para comparar respostas ou
            trabalhar em paralelo.
          </p>
        </div>

        {/* ===== 1. SELEÇÃO ===== */}
        <div className="orch-card">
          <div className="orch-card-head">
            <div>
              <div className="orch-card-title">1. CLIs participantes</div>
              <div className="orch-card-sub">
                Selecione entre {MIN_SELECTION} e {MAX_SELECTION} CLIs instaladas.
              </div>
            </div>
            <div className="orch-counter" data-full={selected.length >= MAX_SELECTION}>
              {selectionCountLabel}
            </div>
          </div>

          {installedList.length === 0 ? (
            <div className="orch-empty">
              Nenhuma CLI instalada detectada. Instale ao menos duas na aba 📦 Instalar.
            </div>
          ) : (
            <div className="orch-cli-list">
              {installedList.map(cli => {
                const isOn = selected.includes(cli.key);
                const color = ORCH_CLI_COLORS[cli.key] || 'var(--brand)';
                const disabled = !isOn && selected.length >= MAX_SELECTION;
                return (
                  <label
                    key={cli.key}
                    className={`orch-cli-item ${isOn ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
                    style={{ ['--orch-accent' as string]: color }}
                  >
                    <input
                      type="checkbox"
                      checked={isOn}
                      disabled={disabled}
                      onChange={() => toggleSelect(cli.key)}
                    />
                    <span className="orch-cli-dot" />
                    <span className="orch-cli-name">{cli.name}</span>
                    {installed[cli.key]?.version && (
                      <span className="orch-cli-ver">v{installed[cli.key].version}</span>
                    )}
                  </label>
                );
              })}
            </div>
          )}

          {selected.length > 0 && (
            <button className="orch-btn-ghost" onClick={clearSelection}>
              Limpar seleção
            </button>
          )}
        </div>

        {/* ===== 2. DIRETÓRIO + ARGS ===== */}
        <div className="orch-card">
          <div className="orch-card-head">
            <div>
              <div className="orch-card-title">2. Diretório & args compartilhados</div>
              <div className="orch-card-sub">
                Todas as CLIs serão abertas nesse diretório com os mesmos args.
              </div>
            </div>
          </div>

          <div className="orch-row">
            <input
              className="orch-input"
              readOnly
              value={directory}
              placeholder="Nenhum diretório escolhido"
            />
            <button className="orch-btn" onClick={() => pickDirectory()}>
              📁 Escolher pasta
            </button>
          </div>

          <label className="orch-label">
            Args / prompt compartilhado (opcional)
          </label>
          <textarea
            className="orch-textarea"
            rows={3}
            value={sharedArgs}
            onChange={e => setSharedArgs(e.target.value)}
            placeholder="Ex: --print 'refatorar este módulo para usar repository pattern'"
          />
        </div>

        {/* ===== 3. MODO ===== */}
        <div className="orch-card">
          <div className="orch-card-head">
            <div>
              <div className="orch-card-title">3. Modo de execução</div>
              <div className="orch-card-sub">
                Split view abre cada CLI em seu próprio terminal. Batch usa
                --print/-p quando suportado (senão cai no split).
              </div>
            </div>
          </div>

          <div className="orch-modes">
            <label className={`orch-mode ${mode === 'split' ? 'active' : ''}`}>
              <input
                type="radio"
                name="orch-mode"
                checked={mode === 'split'}
                onChange={() => setMode('split')}
              />
              <div>
                <div className="orch-mode-title">🪟 Split view</div>
                <div className="orch-mode-desc">
                  Cada CLI abre em seu próprio terminal externo. O app atua como
                  cockpit com painéis de status lado a lado.
                </div>
              </div>
            </label>
            <label className={`orch-mode ${mode === 'batch' ? 'active' : ''}`}>
              <input
                type="radio"
                name="orch-mode"
                checked={mode === 'batch'}
                onChange={() => setMode('batch')}
              />
              <div>
                <div className="orch-mode-title">⚙️ Batch (--print)</div>
                <div className="orch-mode-desc">
                  Roda o mesmo prompt em todas as CLIs via flag --print/-p para
                  comparar saídas. Fallback automático: split view quando a CLI
                  não suporta.
                </div>
              </div>
            </label>
          </div>

          {isWindows() && (
            <label className="orch-check">
              <input
                type="checkbox"
                checked={preferSplitPane}
                onChange={e => setPreferSplitPane(e.target.checked)}
              />
              <span>
                Preferir split-pane do Windows Terminal (se disponível) — atualmente
                depende do backend. Checkbox serve como hint; hoje cada CLI abre
                janela própria.
              </span>
            </label>
          )}
        </div>

        {/* ===== 4. LANÇAR ===== */}
        <div className="orch-card orch-launch-card">
          <button
            className="orch-btn-primary"
            onClick={handleLaunchMulti}
            disabled={!canLaunch}
            title={canLaunch ? 'Lançar todas as CLIs selecionadas' : 'Selecione CLIs e diretório'}
          >
            {launching ? '⏳ Lançando...' : `▶▶ Lançar ${selected.length || ''} CLIs`}
          </button>
          <div className="orch-launch-hint">
            Cada CLI abre em seu terminal. Use o clipboard para fazer handoff.
          </div>
        </div>

        {/* ===== 5. PAINÉIS ===== */}
        {selected.length > 0 && (
          <div className="orch-card">
            <div className="orch-card-head">
              <div>
                <div className="orch-card-title">Painéis de execução</div>
                <div className="orch-card-sub">
                  Status individual por CLI selecionada.
                </div>
              </div>
            </div>

            <div className={`orch-panels ${gridColsClass}`}>
              {selected.map(key => {
                const cli = clis.find(c => c.key === key);
                const state = panels[key];
                const color = ORCH_CLI_COLORS[key] || 'var(--brand)';
                const statusText =
                  !state || state.status === 'idle' ? 'Aguardando lançamento' :
                  state.status === 'launching' ? 'Lançando...' :
                  state.status === 'ok' ? state.message :
                  `Erro: ${state.message}`;
                const statusClass = state?.status || 'idle';
                return (
                  <div
                    key={key}
                    className={`orch-panel status-${statusClass}`}
                    style={{ ['--orch-accent' as string]: color }}
                  >
                    <div className="orch-panel-head">
                      <span className="orch-panel-dot" />
                      <span className="orch-panel-title">{cli?.name || key}</span>
                      <span className="orch-panel-badge">{statusClass}</span>
                    </div>
                    <div className="orch-panel-body">{statusText}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== 6. HANDOFF ===== */}
        <div className="orch-card orch-handoff">
          <button
            className="orch-accordion-head"
            onClick={() => setHandoffOpen(o => !o)}
            aria-expanded={handoffOpen}
          >
            <span>🔁 Handoff de contexto entre sessões</span>
            <span>{handoffOpen ? '▾' : '▸'}</span>
          </button>

          {handoffOpen && (
            <div className="orch-accordion-body">
              <p className="orch-card-sub">
                Cole aqui o contexto copiado da sessão de origem (você copia
                manualmente do terminal). Ao clicar em "Copiar", o app formata
                com cabeçalho e coloca no clipboard prontinho pra colar na
                sessão de destino.
              </p>

              <div className="orch-row">
                <div className="orch-field">
                  <label className="orch-label">De</label>
                  <select
                    className="orch-select"
                    value={handoffFrom}
                    onChange={e => setHandoffFrom(e.target.value)}
                  >
                    <option value="">Selecione origem...</option>
                    {installedList.map(c => (
                      <option key={c.key} value={c.key}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="orch-field">
                  <label className="orch-label">Para</label>
                  <select
                    className="orch-select"
                    value={handoffTo}
                    onChange={e => setHandoffTo(e.target.value)}
                  >
                    <option value="">Selecione destino...</option>
                    {installedList.map(c => (
                      <option key={c.key} value={c.key}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <textarea
                className="orch-textarea"
                rows={6}
                value={handoffText}
                onChange={e => setHandoffText(e.target.value)}
                placeholder="Cole aqui o contexto (prompt, resumo, código) da sessão origem..."
              />

              <button
                className="orch-btn-primary orch-handoff-btn"
                onClick={handleCopyHandoff}
              >
                📋 Copiar contexto formatado para clipboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Orchestrator;
