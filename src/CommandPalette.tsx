import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Command } from 'cmdk';
import {
  Play,
  Package,
  Settings,
  RefreshCw,
  Terminal,
  HelpCircle,
} from './icons';
import { KeyCap } from './shared/KeyCap';
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

interface HistoryItemLite {
  cli: string;
  cliKey: string;
  directory: string;
  args: string;
  timestamp: string;
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
  /** Optional: history items used to populate the "recent" section. */
  history?: HistoryItemLite[];
  /** Optional: current working directory shown in the launch preview. */
  directory?: string;
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

// ==================== COMMAND MODEL ====================

type CommandType = 'launch' | 'tool' | 'nav' | 'action';
type Section = 'pinned' | 'recent' | 'all';

interface PaletteCommand {
  id: string;
  /** Value used by cmdk for fuzzy matching (lowercased, joined keywords). */
  value: string;
  label: string;
  type: CommandType;
  section: Section;
  icon: 'launch' | 'tool' | 'nav' | 'updates' | 'reload' | 'theme' | 'help' | 'install' | 'terminal';
  /** Tint dot color (used for launch items). */
  dotColor?: string;
  /** Preview hint used in the right pane. */
  preview: string;
  /** Optional secondary preview line (directory / args for launches). */
  previewDetail?: string;
  pinned?: boolean;
  onSelect: () => void;
}

function IconFor({ name }: { name: PaletteCommand['icon'] }) {
  const size = 16;
  switch (name) {
    case 'launch':   return <Play size={size} aria-hidden="true" />;
    case 'tool':     return <Terminal size={size} aria-hidden="true" />;
    case 'install':  return <Package size={size} aria-hidden="true" />;
    case 'nav':      return <Terminal size={size} aria-hidden="true" />;
    case 'updates':  return <RefreshCw size={size} aria-hidden="true" />;
    case 'reload':   return <RefreshCw size={size} aria-hidden="true" />;
    case 'theme':    return <Settings size={size} aria-hidden="true" />;
    case 'help':     return <HelpCircle size={size} aria-hidden="true" />;
    case 'terminal': return <Terminal size={size} aria-hidden="true" />;
  }
}

export default function CommandPalette(props: CommandPaletteProps) {
  const {
    open, onOpenChange,
    clis, tools, installed,
    onLaunchCli, onLaunchTool,
    onOpenTab, onToggleTheme, onReloadStatus, onUpdateAll,
    history, directory,
  } = props;

  const { t } = useTranslation();
  const [selectedValue, setSelectedValue] = useState<string>('');

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

  const run = useMemo(
    () => (fn: () => void) => {
      fn();
      onOpenChange(false);
    },
    [onOpenChange],
  );

  // Build the full command list (stable per render).
  const allCommands = useMemo<PaletteCommand[]>(() => {
    const installedClis = clis.filter(c => installed[c.key]?.installed);
    const list: PaletteCommand[] = [];

    // Launch CLIs
    for (const cli of installedClis) {
      list.push({
        id: `launch-${cli.key}`,
        value: `lancar launch ${cli.name} ${cli.key}`,
        label: t('palette.commands.launchCli', { name: cli.name }),
        type: 'launch',
        section: 'all',
        icon: 'launch',
        dotColor: cliColor(cli.key),
        preview: `> ${cli.command}${directory ? ` in ${directory}` : ''}`,
        previewDetail: directory ? `dir: ${directory}` : undefined,
        onSelect: () => run(() => onLaunchCli(cli.key)),
      });
    }

    // Tools
    if (onLaunchTool) {
      for (const tool of tools) {
        list.push({
          id: `tool-${tool.key}`,
          value: `abrir tool ${tool.name} ${tool.key}`,
          label: t('palette.commands.openTool', { name: tool.name }),
          type: 'tool',
          section: 'all',
          icon: 'tool',
          preview: `> ${tool.command || tool.name}`,
          onSelect: () => run(() => onLaunchTool(tool.key)),
        });
      }
    }

    // Navigation
    const navItems: Array<{ id: string; value: string; label: string; icon: PaletteCommand['icon'] }> = [
      { id: 'nav-launcher', value: 'ir para launcher status',        label: t('palette.commands.navLauncher'), icon: 'launch'  },
      { id: 'nav-install',  value: 'ir para instalar install',       label: t('palette.commands.navInstall'),  icon: 'install' },
      { id: 'nav-tools',    value: 'ir para ferramentas tools',      label: t('palette.commands.navTools'),    icon: 'terminal'},
      { id: 'nav-history',  value: 'ir para historico history',      label: t('palette.commands.navHistory'),  icon: 'nav'     },
      { id: 'nav-updates',  value: 'ir para atualizacoes updates',   label: t('palette.commands.navUpdates'),  icon: 'updates' },
      { id: 'nav-help',     value: 'ir para ajuda help config',      label: t('palette.commands.navHelp'),     icon: 'help'    },
    ];
    for (const n of navItems) {
      const tabKey = n.id.replace('nav-', '');
      list.push({
        id: n.id,
        value: n.value,
        label: n.label,
        type: 'nav',
        section: 'all',
        icon: n.icon,
        preview: `> open ${tabKey}`,
        onSelect: () => run(() => onOpenTab(tabKey)),
      });
    }

    // Actions
    list.push({
      id: 'action-update-all',
      value: 'atualizar todos clis update all',
      label: t('palette.commands.updateAll'),
      type: 'action',
      section: 'all',
      icon: 'updates',
      preview: '> update --all',
      onSelect: () => run(() => onUpdateAll()),
    });
    list.push({
      id: 'action-reload',
      value: 'recarregar status verificar',
      label: t('palette.commands.reloadStatus'),
      type: 'action',
      section: 'all',
      icon: 'reload',
      preview: '> reload status',
      onSelect: () => run(() => onReloadStatus()),
    });
    list.push({
      id: 'action-theme',
      value: 'alternar tema escuro claro theme',
      label: t('palette.commands.toggleTheme'),
      type: 'action',
      section: 'all',
      icon: 'theme',
      preview: '> theme toggle',
      onSelect: () => run(() => onToggleTheme()),
    });

    return list;
  }, [t, clis, tools, installed, onLaunchTool, onLaunchCli, onOpenTab, onToggleTheme, onReloadStatus, onUpdateAll, run, directory]);

  // Build a synthetic "recent" section from history (max 5), mapped to existing launch commands when possible.
  const recentCommands = useMemo<PaletteCommand[]>(() => {
    if (!history || history.length === 0) return [];
    const byKey = new Map(allCommands.filter(c => c.type === 'launch').map(c => [c.id, c]));
    const seen = new Set<string>();
    const out: PaletteCommand[] = [];
    for (const h of history) {
      const base = byKey.get(`launch-${h.cliKey}`);
      if (!base) continue;
      const dedupKey = `${h.cliKey}|${h.directory}|${h.args}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);
      out.push({
        ...base,
        id: `recent-${out.length}-${h.cliKey}`,
        section: 'recent',
        value: `recente ${base.value} ${h.directory}`,
        preview: `> ${h.cli}${h.directory ? ` in ${h.directory}` : ''}${h.args ? ` -- ${h.args}` : ''}`,
        previewDetail: h.directory ? `dir: ${h.directory}` : undefined,
      });
      if (out.length >= 5) break;
    }
    return out;
  }, [history, allCommands]);

  const pinnedCommands = useMemo(
    () => allCommands.filter(c => c.pinned),
    [allCommands],
  );

  const restCommands = useMemo(
    () => allCommands.filter(c => !c.pinned),
    [allCommands],
  );

  // Compute preview for the currently selected item.
  const selected = useMemo(() => {
    const pool = [...pinnedCommands, ...recentCommands, ...restCommands];
    return pool.find(c => c.value === selectedValue) ?? pool[0];
  }, [selectedValue, pinnedCommands, recentCommands, restCommands]);

  if (!open) return null;

  return (
    <div
      className="cmdk-ail-overlay"
      role="dialog"
      aria-label={t('palette.ariaLabel')}
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div className="cmdk-ail-panel palette-panel--wide">
        <Command
          label={t('palette.ariaLabel')}
          shouldFilter={true}
          className="cmdk-ail-root"
          value={selectedValue}
          onValueChange={setSelectedValue}
        >
          <Command.Input
            className="cmdk-ail-input"
            placeholder={t('palette.placeholder')}
            autoFocus
          />

          <div className="palette-layout">
            <Command.List className="cmdk-ail-list palette-list">
              <Command.Empty className="cmdk-ail-empty">
                {t('palette.empty')}
              </Command.Empty>

              {pinnedCommands.length > 0 && (
                <Command.Group
                  heading={t('palette.sections.pinned')}
                  className="cmdk-ail-group palette-group--terminal"
                >
                  {pinnedCommands.map(cmd => (
                    <PaletteItem key={cmd.id} cmd={cmd} />
                  ))}
                </Command.Group>
              )}

              {recentCommands.length > 0 && (
                <Command.Group
                  heading={t('palette.sections.recent')}
                  className="cmdk-ail-group palette-group--terminal"
                >
                  {recentCommands.map(cmd => (
                    <PaletteItem key={cmd.id} cmd={cmd} />
                  ))}
                </Command.Group>
              )}

              {restCommands.length > 0 && (
                <Command.Group
                  heading={t('palette.sections.all')}
                  className="cmdk-ail-group palette-group--terminal"
                >
                  {restCommands.map(cmd => (
                    <PaletteItem key={cmd.id} cmd={cmd} />
                  ))}
                </Command.Group>
              )}
            </Command.List>

            <aside className="palette-preview" aria-live="polite">
              <span className="palette-preview__label">{t('palette.preview')}</span>
              <code className="palette-preview__cmd">
                {selected ? selected.preview : '—'}
              </code>
              {selected?.previewDetail && (
                <span className="palette-preview__detail">{selected.previewDetail}</span>
              )}
            </aside>
          </div>

          <footer className="palette-footer">
            <span><KeyCap keys={['\u21B5']} dimmed /> {t('palette.footer.launch')}</span>
            <span><KeyCap keys={['\u2318', '\u21E7', 'C']} dimmed /> {t('palette.footer.copy')}</span>
            <span><KeyCap keys={['esc']} dimmed /> {t('palette.footer.close')}</span>
          </footer>
        </Command>
      </div>
    </div>
  );
}

interface PaletteItemProps {
  cmd: PaletteCommand;
}

function PaletteItem({ cmd }: PaletteItemProps) {
  return (
    <Command.Item
      value={cmd.value}
      onSelect={cmd.onSelect}
      className="cmdk-ail-item"
    >
      {cmd.dotColor ? (
        <span
          className="cmdk-ail-dot"
          style={{ background: cmd.dotColor }}
          aria-hidden="true"
        />
      ) : (
        <span className="cmdk-ail-icon" aria-hidden="true">
          <IconFor name={cmd.icon} />
        </span>
      )}
      <span className="cmdk-ail-label">{cmd.label}</span>
      {cmd.type === 'launch' && (
        <span className="cmdk-ail-shortcut" aria-hidden="true">↵</span>
      )}
    </Command.Item>
  );
}
