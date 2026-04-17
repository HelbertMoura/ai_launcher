import { useEffect } from 'react';
import { Command } from 'cmdk';
import './CommandPalette.css';

// ==================== TYPES (locais, compatíveis com App.tsx) ====================

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

interface ToolInfo {
  key: string;
  name: string;
  command: string;
  install_hint: string;
  install_url: string | null;
}

interface InstallStatus {
  installed: boolean;
  version: string | null;
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clis: CliInfo[];
  tools: ToolInfo[];
  installed: Record<string, InstallStatus>;
  onLaunchCli: (key: string) => void;
  onLaunchTool?: (key: string) => void;
  onOpenTab: (tab: string) => void;
  onToggleTheme: () => void;
  onReloadStatus: () => void;
  onUpdateAll: () => void;
}

// Paleta de cores (duplicada aqui para evitar acoplamento com App.tsx)
const CLI_COLORS_FALLBACK: Record<string, string> = {
  claude: '#CC785C',
  codex: '#10A37F',
  gemini: '#4285F4',
  qwen: '#615CED',
  kilocode: '#5BA4FC',
  opencode: '#E8E6E3',
  crush: '#FF4FA3',
  droid: '#FF5722',
};

function cliColor(key: string): string {
  return CLI_COLORS_FALLBACK[key] || '#8B1E2A';
}

export default function CommandPalette(props: CommandPaletteProps) {
  const {
    open, onOpenChange,
    clis, tools, installed,
    onLaunchCli, onLaunchTool,
    onOpenTab, onToggleTheme, onReloadStatus, onUpdateAll,
  } = props;

  // ESC fecha (redundante com cmdk, mas garante comportamento consistente)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  if (!open) return null;

  function run(fn: () => void) {
    fn();
    onOpenChange(false);
  }

  const installedClis = clis.filter(c => installed[c.key]?.installed);

  return (
    <div
      className="cmdk-ail-overlay"
      role="dialog"
      aria-label="Paleta de comandos"
      aria-modal="true"
      onClick={(e) => {
        // Click no backdrop fecha
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div className="cmdk-ail-panel">
        <Command
          label="Paleta de comandos"
          shouldFilter={true}
          className="cmdk-ail-root"
        >
          <Command.Input
            className="cmdk-ail-input"
            placeholder="Digite um comando ou pesquise..."
            autoFocus
          />
          <Command.List className="cmdk-ail-list">
            <Command.Empty className="cmdk-ail-empty">
              Nenhum resultado encontrado.
            </Command.Empty>

            {installedClis.length > 0 && (
              <Command.Group heading="Lançar CLI" className="cmdk-ail-group">
                {installedClis.map(cli => (
                  <Command.Item
                    key={`launch-${cli.key}`}
                    value={`lancar ${cli.name} ${cli.key}`}
                    onSelect={() => run(() => onLaunchCli(cli.key))}
                    className="cmdk-ail-item"
                  >
                    <span
                      className="cmdk-ail-dot"
                      style={{ background: cliColor(cli.key) }}
                      aria-hidden="true"
                    />
                    <span className="cmdk-ail-label">Lançar {cli.name}</span>
                    <span className="cmdk-ail-shortcut" aria-hidden="true">↵</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {tools.length > 0 && onLaunchTool && (
              <Command.Group heading="Tools" className="cmdk-ail-group">
                {tools.map(tool => (
                  <Command.Item
                    key={`tool-${tool.key}`}
                    value={`abrir tool ${tool.name} ${tool.key}`}
                    onSelect={() => run(() => onLaunchTool(tool.key))}
                    className="cmdk-ail-item"
                  >
                    <span className="cmdk-ail-icon" aria-hidden="true">🛠</span>
                    <span className="cmdk-ail-label">Abrir {tool.name}</span>
                    <span className="cmdk-ail-shortcut" aria-hidden="true">↵</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            <Command.Group heading="Navegação" className="cmdk-ail-group">
              <Command.Item
                value="ir para launcher status"
                onSelect={() => run(() => onOpenTab('launcher'))}
                className="cmdk-ail-item"
              >
                <span className="cmdk-ail-icon" aria-hidden="true">⚡</span>
                <span className="cmdk-ail-label">Ir para Launcher</span>
              </Command.Item>
              <Command.Item
                value="ir para instalar install"
                onSelect={() => run(() => onOpenTab('install'))}
                className="cmdk-ail-item"
              >
                <span className="cmdk-ail-icon" aria-hidden="true">📦</span>
                <span className="cmdk-ail-label">Ir para Instalar</span>
              </Command.Item>
              <Command.Item
                value="ir para ferramentas tools"
                onSelect={() => run(() => onOpenTab('tools'))}
                className="cmdk-ail-item"
              >
                <span className="cmdk-ail-icon" aria-hidden="true">🛠️</span>
                <span className="cmdk-ail-label">Ir para Ferramentas</span>
              </Command.Item>
              <Command.Item
                value="ir para historico history"
                onSelect={() => run(() => onOpenTab('history'))}
                className="cmdk-ail-item"
              >
                <span className="cmdk-ail-icon" aria-hidden="true">📜</span>
                <span className="cmdk-ail-label">Ir para Histórico</span>
              </Command.Item>
              <Command.Item
                value="ir para atualizacoes updates"
                onSelect={() => run(() => onOpenTab('updates'))}
                className="cmdk-ail-item"
              >
                <span className="cmdk-ail-icon" aria-hidden="true">🔔</span>
                <span className="cmdk-ail-label">Ir para Atualizações</span>
              </Command.Item>
              <Command.Item
                value="ir para ajuda help config"
                onSelect={() => run(() => onOpenTab('help'))}
                className="cmdk-ail-item"
              >
                <span className="cmdk-ail-icon" aria-hidden="true">❓</span>
                <span className="cmdk-ail-label">Ir para Ajuda</span>
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Ações" className="cmdk-ail-group">
              <Command.Item
                value="atualizar todos clis update all"
                onSelect={() => run(() => onUpdateAll())}
                className="cmdk-ail-item"
              >
                <span className="cmdk-ail-icon" aria-hidden="true">⬆</span>
                <span className="cmdk-ail-label">Atualizar todos os CLIs</span>
              </Command.Item>
              <Command.Item
                value="recarregar status verificar"
                onSelect={() => run(() => onReloadStatus())}
                className="cmdk-ail-item"
              >
                <span className="cmdk-ail-icon" aria-hidden="true">🔄</span>
                <span className="cmdk-ail-label">Recarregar status</span>
              </Command.Item>
              <Command.Item
                value="alternar tema escuro claro theme"
                onSelect={() => run(() => onToggleTheme())}
                className="cmdk-ail-item"
              >
                <span className="cmdk-ail-icon" aria-hidden="true">🌓</span>
                <span className="cmdk-ail-label">Alternar tema (escuro/claro)</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
