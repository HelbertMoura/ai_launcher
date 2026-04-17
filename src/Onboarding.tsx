import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './Onboarding.css';

// ==================== TYPES ====================

type StepNum = 1 | 2 | 3 | 4;

interface CliCatalogItem {
  key: string;
  name: string;
}

// Catálogo mínimo embutido — mesmos keys/nomes de get_cli_definitions no backend.
// Usamos nomes amigáveis em pt-BR aqui; ícones vêm dos SVGs em /icons/cli.
const CLI_CATALOG: CliCatalogItem[] = [
  { key: 'claude', name: 'Claude Code' },
  { key: 'codex', name: 'Codex' },
  { key: 'gemini', name: 'Gemini' },
  { key: 'qwen', name: 'Qwen' },
  { key: 'kilocode', name: 'Kilo Code' },
  { key: 'opencode', name: 'OpenCode' },
  { key: 'crush', name: 'Crush' },
  { key: 'droid', name: 'Droid' },
];

interface OnboardingProps {
  onClose: () => void;
}

// ==================== COMPONENT ====================

export function Onboarding({ onClose }: OnboardingProps) {
  const [step, setStep] = useState<StepNum>(1);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);

  // Step 2 — CLIs selecionadas
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [installing, setInstalling] = useState(false);
  const [installingKey, setInstallingKey] = useState<string | null>(null);
  const [installResult, setInstallResult] = useState<{ ok: number; fail: number } | null>(null);
  const [installLog, setInstallLog] = useState<string[]>([]);

  // Foco inicial no primeiro botão a cada step
  useEffect(() => {
    const t = setTimeout(() => {
      firstFocusableRef.current?.focus();
    }, 30);
    return () => clearTimeout(t);
  }, [step]);

  // ESC não fecha — onboarding é obrigatório até "Começar a usar".
  // Bloqueia scroll do body enquanto aberto.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, []);

  // ============= Navegação =============

  const nextStep = useCallback(() => {
    setStep(curr => {
      if (curr === 1) return 2;
      if (curr === 2) return 4;
      if (curr === 3) return 4;
      return curr;
    });
  }, []);

  const prevStep = useCallback(() => {
    setStep(curr => {
      if (curr === 4) return 2;
      if (curr === 3) return 2;
      if (curr === 2) return 1;
      return curr;
    });
  }, []);

  const finish = useCallback(() => {
    onClose();
  }, [onClose]);

  // ============= Step 2 — Instalação =============

  const toggleCli = (key: string) => {
    setSelected(s => ({ ...s, [key]: !s[key] }));
  };

  const selectedKeys = CLI_CATALOG.filter(c => selected[c.key]).map(c => c.key);

  const runInstall = async () => {
    if (installing || selectedKeys.length === 0) return;
    setInstalling(true);
    setInstallResult(null);
    setInstallLog([]);
    let ok = 0;
    let fail = 0;
    for (const key of selectedKeys) {
      setInstallingKey(key);
      const name = CLI_CATALOG.find(c => c.key === key)?.name || key;
      setInstallLog(log => [...log, `Instalando ${name}...`]);
      try {
        await invoke<string>('install_cli', { cliKey: key });
        ok += 1;
        setInstallLog(log => [...log, `✓ ${name} instalado`]);
      } catch (e) {
        fail += 1;
        const msg = String(e).slice(0, 120);
        setInstallLog(log => [...log, `✗ ${name} falhou: ${msg}`]);
      }
    }
    setInstallingKey(null);
    setInstalling(false);
    setInstallResult({ ok, fail });
  };

  // ============= Render =============

  // Total de passos: 3
  const totalSteps = 3;
  // Índice visual: step 1 -> 1, step 2 -> 2, step 4 -> 3
  const visualIndex = (() => {
    if (step === 1) return 1;
    if (step === 2) return 2;
    return 3;
  })();

  return (
    <div className="onb-overlay" role="dialog" aria-modal="true" aria-labelledby="onb-title">
      <div className="onb-modal" role="document">
        <div className="onb-progress">
          {Array.from({ length: totalSteps }).map((_, i) => {
            const active = i + 1 === visualIndex;
            const done = i + 1 < visualIndex;
            return (
              <span
                key={i}
                className={`onb-dot${active ? ' onb-dot--active' : ''}${done ? ' onb-dot--done' : ''}`}
                aria-hidden="true"
              />
            );
          })}
          <span className="onb-progress-label">{visualIndex} / {totalSteps}</span>
        </div>

        {step === 1 && (
          <section className="onb-step">
            <div className="onb-hero">
              <div className="onb-hero-emoji" aria-hidden="true">🚀</div>
              <h1 id="onb-title" className="onb-title">Bem-vindo ao AI Launcher Pro</h1>
              <p className="onb-subtitle">Tudo fica na sua máquina. Zero telemetria.</p>
            </div>
            <ul className="onb-bullets">
              <li><span className="onb-bullet-icon">🔒</span> <span>Sem coleta de dados — nada sai do seu PC</span></li>
              <li><span className="onb-bullet-icon">👤</span> <span>Sem login, sem conta, sem servidor</span></li>
              <li><span className="onb-bullet-icon">🛠️</span> <span>Open-source — código auditável</span></li>
              <li><span className="onb-bullet-icon">📁</span> <span>Config local em <code>%APPDATA%</code></span></li>
            </ul>
            <div className="onb-actions onb-actions--end">
              <button ref={firstFocusableRef} className="onb-btn onb-btn--primary" onClick={nextStep}>
                Próximo →
              </button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="onb-step">
            <h1 id="onb-title" className="onb-title">Quais CLIs você quer?</h1>
            <p className="onb-subtitle">Selecione as que deseja instalar agora. Você pode pular e instalar depois.</p>

            <div className="onb-cli-grid">
              {CLI_CATALOG.map(cli => {
                const isSel = !!selected[cli.key];
                const isCurrent = installingKey === cli.key;
                const fileName = cli.key === 'kilocode' ? 'kilo' : cli.key;
                return (
                  <label
                    key={cli.key}
                    className={`onb-cli-item${isSel ? ' onb-cli-item--selected' : ''}${isCurrent ? ' onb-cli-item--busy' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSel}
                      disabled={installing}
                      onChange={() => toggleCli(cli.key)}
                    />
                    <img
                      src={`/icons/cli/${fileName}.svg`}
                      width={28}
                      height={28}
                      alt=""
                      aria-hidden="true"
                      className="onb-cli-icon"
                    />
                    <span className="onb-cli-name">{cli.name}</span>
                    {isCurrent && <span className="onb-cli-spinner" aria-hidden="true" />}
                  </label>
                );
              })}
            </div>

            {installLog.length > 0 && (
              <div className="onb-install-log" aria-live="polite">
                {installLog.slice(-4).map((line, i) => (
                  <div key={i} className="onb-install-line">{line}</div>
                ))}
              </div>
            )}

            {installResult && (
              <div className="onb-install-summary" role="status">
                {installResult.ok} instalado(s){installResult.fail > 0 ? `, ${installResult.fail} falhou` : ''}.
              </div>
            )}

            <div className="onb-actions onb-actions--split">
              <button className="onb-btn onb-btn--ghost" onClick={prevStep} disabled={installing}>
                ← Voltar
              </button>
              <div className="onb-actions-right">
                <button className="onb-btn onb-btn--ghost" onClick={nextStep} disabled={installing}>
                  Pular
                </button>
                {installResult ? (
                  <button ref={firstFocusableRef} className="onb-btn onb-btn--primary" onClick={nextStep}>
                    Próximo →
                  </button>
                ) : (
                  <button
                    ref={firstFocusableRef}
                    className="onb-btn onb-btn--primary"
                    onClick={runInstall}
                    disabled={installing || selectedKeys.length === 0}
                  >
                    {installing
                      ? `Instalando${installingKey ? ` ${CLI_CATALOG.find(c => c.key === installingKey)?.name || installingKey}` : ''}...`
                      : `Instalar marcados (${selectedKeys.length})`}
                  </button>
                )}
              </div>
            </div>
          </section>
        )}


        {step === 4 && (
          <section className="onb-step">
            <h1 id="onb-title" className="onb-title">Atalhos essenciais</h1>
            <p className="onb-subtitle">Memorize esses cinco. Tudo fica mais rápido.</p>

            <div className="onb-shortcuts">
              <div className="onb-shortcut">
                <kbd className="onb-kbd">Ctrl</kbd>
                <span className="onb-plus">+</span>
                <kbd className="onb-kbd">Shift</kbd>
                <span className="onb-plus">+</span>
                <kbd className="onb-kbd">P</kbd>
                <span className="onb-shortcut-desc">Command Palette</span>
              </div>
              <div className="onb-shortcut">
                <kbd className="onb-kbd">Ctrl</kbd>
                <span className="onb-plus">+</span>
                <kbd className="onb-kbd">Alt</kbd>
                <span className="onb-plus">+</span>
                <kbd className="onb-kbd">Space</kbd>
                <span className="onb-shortcut-desc">Mostrar/ocultar app (global, configurável em Ajuda)</span>
              </div>
              <div className="onb-shortcut">
                <kbd className="onb-kbd">Ctrl</kbd>
                <span className="onb-plus">+</span>
                <kbd className="onb-kbd">L</kbd>
                <span className="onb-shortcut-desc">Lançar CLI selecionada</span>
              </div>
              <div className="onb-shortcut">
                <kbd className="onb-kbd">Ctrl</kbd>
                <span className="onb-plus">+</span>
                <kbd className="onb-kbd">R</kbd>
                <span className="onb-shortcut-desc">Recarregar detecção</span>
              </div>
              <div className="onb-shortcut">
                <kbd className="onb-kbd">Ctrl</kbd>
                <span className="onb-plus">+</span>
                <kbd className="onb-kbd">U</kbd>
                <span className="onb-shortcut-desc">Verificar atualizações</span>
              </div>
            </div>

            <div className="onb-actions onb-actions--split">
              <button className="onb-btn onb-btn--ghost" onClick={prevStep}>
                ← Voltar
              </button>
              <button ref={firstFocusableRef} className="onb-btn onb-btn--primary" onClick={finish}>
                Começar a usar ✓
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default Onboarding;
