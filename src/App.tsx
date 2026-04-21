import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import i18nInstance from './i18n';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import CommandPalette from './CommandPalette';
import Orchestrator from './Orchestrator';
import { Onboarding } from './Onboarding';
import { Skeleton } from './Skeleton';
import { QuickSwitchModal } from './providers/QuickSwitchModal';
import { DryRunModal } from './providers/DryRunModal';
import { CustomIdeModal } from './providers/CustomIdeModal';
import { loadCustomIdes, saveCustomIdes, addCustomIde, removeCustomIde, CUSTOM_IDES_CHANGED_EVENT, type CustomIde } from './lib/customIdes';
import { loadAppSettings, SETTINGS_CHANGED_EVENT, type AppSettings } from './lib/appSettings';
// commandTimeout is wired through invoke() calls in v7.1 (see installCli/updateSingleCli).
import { buildLaunchEnv, loadProviders, redactEnv, saveProviders, setActive } from './providers/storage';
import { isAdminMode, setAdminMode, type LaunchProviderInfo, type ProvidersState } from './providers/types';
import { computeTodaySpend, shouldAlert } from './providers/budget';
import { addPreset, generatePresetId, loadPresets, removePreset, updatePreset } from './presets/storage';
import type { LaunchPreset } from './presets/types';
import { LauncherTab } from './tabs/LauncherTab';
import { HistoryTab } from './tabs/HistoryTab';
import { CostsTab } from './tabs/CostsTab';
import { AdminTab } from './tabs/AdminTab';
import { HelpTab } from './tabs/HelpTab';
import { HeaderBar, type HeaderTabId } from './layout/HeaderBar';
import { getLocale, setLocale, LOCALE_LABELS, type Locale } from './i18n';
import { StatusBar } from './layout/StatusBar';
import { HelpModal } from './layout/HelpModal';
import { applyFontStack, FONT_STORAGE_KEY, type FontId } from './providers/AppearanceSection';
import './providers/providers.css';

// Boot-time font restore (prevents FOUT on reload). Runs once at module load.
const savedFont = typeof localStorage !== 'undefined' ? localStorage.getItem(FONT_STORAGE_KEY) : null;
if (savedFont) applyFontStack(savedFont as FontId);

// ==================== TYPES ====================

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
interface CheckResult { name: string; installed: boolean; version: string | null; install_command: string | null; }
interface HistoryItem {
  cli: string;
  cliKey: string;
  directory: string;
  args: string;
  timestamp: string;
  provider?: LaunchProviderInfo;
}
interface UpdateInfo {
  cli: string;
  current: string | null;
  latest: string | null;
  has_update: boolean;
  method: string;       // 'npm' | 'pip' | 'browser' | 'script' | 'none'
  no_api: boolean;
  key?: string;         // só env_updates e tool_updates preenchem
}
interface UpdatesSummary {
  cli_updates: UpdateInfo[];
  env_updates: UpdateInfo[];
  tool_updates: UpdateInfo[];
  checked_at: string;
  total_with_updates: number;
}
interface ToolInfo { key: string; name: string; command: string; install_hint: string; install_url: string | null; }
interface ProgressEvent { key: string; phase: 'start' | 'stdout' | 'stderr' | 'done' | 'error'; line: string; }

// ==================== CONSTANTS ====================

const APP_VERSION = __APP_VERSION__;

export const CLI_COLORS: Record<string, string> = {
  claude: '#CC785C',
  codex: '#10A37F',
  gemini: '#4285F4',
  qwen: '#615CED',
  kilocode: '#5BA4FC',
  opencode: '#E8E6E3',
  crush: '#FF4FA3',
  droid: '#FF5722',
};

// ==================== ÍCONES ====================

export function CliIcon({ cliKey, size = 32 }: { cliKey: string; size?: number }) {
  const fileName = cliKey === 'kilocode' ? 'kilo' : cliKey;
  return <img src={`/icons/cli/${fileName}.svg`} width={size} height={size} alt={cliKey} style={{ display: 'block' }} />;
}
function ToolIcon({ toolKey, size = 40 }: { toolKey: string; size?: number }) {
  return <img src={`/icons/tool/${toolKey}.svg`} width={size} height={size} alt={toolKey} style={{ display: 'block' }} />;
}

// ==================== HELPERS ====================

function prereqKeyFor(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('node')) return 'node';
  if (n.includes('python')) return 'python';
  if (n.includes('git lfs')) return 'git-lfs';
  if (n.startsWith('git')) return 'git';
  if (n.includes('rust') || n.includes('cargo')) return 'rust';
  if (n.includes('pnpm')) return 'pnpm';
  if (n.includes('yarn')) return 'yarn';
  if (n.includes('bun')) return 'bun';
  if (n.includes('terminal')) return 'windows-terminal';
  if (n.includes('powershell')) return 'powershell';
  if (n.includes('docker')) return 'docker';
  if (n.includes('vs code')) return 'vscode';
  if (n.includes('tauri')) return 'tauri';
  return '';
}

function formatTimestamp(epochSecStr: string): string {
  const sec = parseInt(epochSecStr, 10);
  if (!isFinite(sec) || sec === 0) return '—';
  const now = Math.floor(Date.now() / 1000);
  const diff = now - sec;
  if (diff < 0) {
    const d = new Date(sec * 1000);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  if (diff < 60) return 'agora';
  if (diff < 3600) return `há ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `há ${Math.floor(diff / 86400)}d`;
  const d = new Date(sec * 1000);
  return d.toLocaleDateString('pt-BR');
}

// ==================== APP ====================

function App() {
  const { t } = useTranslation();
  const [, forceRerenderOnLangChange] = useState(0);
  const [activeTab, setActiveTab] = useState<HeaderTabId>('launcher');
  const [bootReady, setBootReady] = useState(false);

  // Defensive: force re-render across the entire tree when the language changes.
  // useTranslation() should already subscribe consumers, but some nested
  // components (tabs, modals) may hold stale closures. This guarantees
  // propagation on every languageChanged event.
  useEffect(() => {
    const onLangChange = () => forceRerenderOnLangChange(n => n + 1);
    i18nInstance.on('languageChanged', onLangChange);
    return () => {
      i18nInstance.off('languageChanged', onLangChange);
    };
  }, []);

  // Welcome: visível OU oculta. Usuário controla.
  // - Primeira vez (!hasChecked): visível OBRIGATÓRIA
  // - Reabertura + !hideWelcome: visível com botão "Continuar"
  // - Reabertura + hideWelcome: oculta
  const [welcomeVisible, setWelcomeVisible] = useState(true);

  const [hasChecked, setHasChecked] = useState(false);
  const [hideWelcome, setHideWelcome] = useState(false);

  const [selectedCli, setSelectedCli] = useState<string>('claude');
  const [directory, setDirectory] = useState('');
  const [args, setArgs] = useState('');
  const [noPerms, setNoPerms] = useState(true);
  const [multiSelected, setMultiSelected] = useState<string[]>([]);

  const [clis, setClis] = useState<CliInfo[]>([]);
  const [installed, setInstalled] = useState<Record<string, { installed: boolean; version: string | null }>>({});
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [toolsChecked, setToolsChecked] = useState<Record<string, { installed: boolean; version: string | null }>>({});
  const [checkingTools, setCheckingTools] = useState(false);
  const [lastToolsCheck, setLastToolsCheck] = useState('');

  const [envChecks, setEnvChecks] = useState<CheckResult[]>([]);
  const [checkingEnv, setCheckingEnv] = useState(false);

  const [updatesSummary, setUpdatesSummary] = useState<UpdatesSummary | null>(null);
  const [checkingAllUpdates, setCheckingAllUpdates] = useState(false);
  const [updatingCli, setUpdatingCli] = useState<string | null>(null);
  const [updatingAll, setUpdatingAll] = useState(false);
  const [updatingPrereq, setUpdatingPrereq] = useState<string | null>(null);
  const [justUpdated, setJustUpdated] = useState<Set<string>>(new Set());

  const [installingCli, setInstallingCli] = useState<string | null>(null);
  const [installLog, setInstallLog] = useState<Record<string, ProgressEvent[]>>({});
  const [toast, setToast] = useState<string | null>(null);

  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  // Onboarding: visível na primeira execução, reabrível via Ajuda.
  const [showOnboarding, setShowOnboarding] = useState<boolean>(
    () => !localStorage.getItem('onboardingCompleted')
  );
  const closeOnboarding = () => {
    localStorage.setItem('onboardingCompleted', 'true');
    setShowOnboarding(false);
  };
  const reopenOnboarding = () => {
    localStorage.removeItem('onboardingCompleted');
    setShowOnboarding(true);
  };

  // Admin: providers Anthropic-compatible (Z.AI, MiniMax, etc.)
  // Runtime toggle via ⌘⇧A — persisted in localStorage. VITE_ADMIN_MODE=1 build wins regardless.
  const [adminMode, setAdminModeState] = useState<boolean>(() => isAdminMode());
  const [providers, setProviders] = useState<ProvidersState>(() => loadProviders());
  const [quickSwitchOpen, setQuickSwitchOpen] = useState(false);
  const [dryRunOpen, setDryRunOpen] = useState(false);
  const [presets, setPresets] = useState<LaunchPreset[]>(() => loadPresets());
  const [customIdes, setCustomIdesState] = useState<CustomIde[]>(() => loadCustomIdes());
  const [customIdeModalOpen, setCustomIdeModalOpen] = useState(false);
  const [editingCustomIde, setEditingCustomIde] = useState<CustomIde | null>(null);
  function handleSaveCustomIde(ide: CustomIde) {
    const next = addCustomIde(customIdes, ide);
    setCustomIdesState(next);
    saveCustomIdes(next);
    setCustomIdeModalOpen(false);
    setEditingCustomIde(null);
  }
  async function handleLaunchCustomIde(ide: CustomIde) {
    try {
      await invoke('launch_custom_ide', {
        launchCmd: ide.launchCmd,
        directory: directory || '',
      });
      showToast(t('toasts.customLaunched', { name: ide.name }));
    } catch (e) {
      showToast(t('toasts.customLaunchFailed', { error: String(e).slice(0, 120) }));
    }
  }
  function handleDeleteCustomIde(key: string) {
    const target = customIdes.find(i => i.key === key);
    if (!target) return;
    if (!confirm(t('customIde.deleteConfirm', { name: target.name }))) return;
    const next = removeCustomIde(customIdes, key);
    setCustomIdesState(next);
    saveCustomIdes(next);
  }
  const updateProviders = (next: ProvidersState) => {
    setProviders(next);
    saveProviders(next);
  };
  const activeProvider = providers.profiles.find(p => p.id === providers.activeId);
  const currentProviderInfo = (): LaunchProviderInfo | undefined => {
    if (!activeProvider) return undefined;
    if (activeProvider.kind === 'anthropic' && !activeProvider.baseUrl) return undefined;
    return {
      providerId: activeProvider.id,
      providerName: activeProvider.name,
      providerKind: activeProvider.kind,
      mainModel: providers.overrideMainModel || activeProvider.mainModel,
      fastModel: providers.overrideFastModel || activeProvider.fastModel,
    };
  };

  // v7 preferences (maxHistory, refreshInterval, commandTimeout).
  // Stored via AdminPanel; cross-tab sync via storage event. Same-tab changes
  // take effect on reload (v7.1 TODO: event bus or lifted state for live sync).
  const [appSettings, setAppSettings] = useState(() => loadAppSettings());

  const installingRef = useRef<string | null>(null);
  const directoryInputRef = useRef<HTMLInputElement>(null);

  // C3 — QoL: drag-drop de pasta + projetos recentes
  const [isDragging, setIsDragging] = useState(false);
  const [recentProjects, setRecentProjects] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ai-launcher-config');
      if (!saved) return [];
      const conf = JSON.parse(saved) as Record<string, unknown>;
      const arr = conf.recentProjects;
      return Array.isArray(arr) ? (arr as string[]).filter(p => typeof p === 'string').slice(0, 5) : [];
    } catch { return []; }
  });

  // ============= BOOT =============
  useEffect(() => {
    const saved = localStorage.getItem('ai-launcher-config');
    let conf: Record<string, unknown> = {};
    if (saved) { try { conf = JSON.parse(saved); } catch { /* ignore */ } }

    setDirectory((conf.directory as string) || '');
    setHistory((conf.history as HistoryItem[]) || []);
    setTheme(((conf.theme as 'dark' | 'light') || 'dark'));
    const hw = Boolean(conf.hideWelcome);
    setHideWelcome(hw);

    const checkedBefore = Boolean(conf.hasChecked);
    if (checkedBefore) {
      setHasChecked(true);
      setInstalled((conf.installed as Record<string, { installed: boolean; version: string | null }>) || {});
      // Reabertura: oculta se user marcou "não mostrar"; senão mostra welcome com botão Continuar
      setWelcomeVisible(!hw);
    } else {
      // Primeira vez: welcome obrigatória
      setWelcomeVisible(true);
    }

    (async () => {
      try {
        const [cliList, toolList] = await Promise.all([
          invoke<CliInfo[]>('get_all_clis'),
          invoke<ToolInfo[]>('get_all_tools'),
        ]);
        setClis(cliList);
        setTools(toolList);
        setBootReady(true);
      } catch (e) {
        console.error('Boot error:', e);
        setBootReady(true);
      }
    })();

  }, []);

  // Tema
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Install progress listener
  useEffect(() => {
    const unlisten = listen<ProgressEvent>('install-progress', (ev) => {
      const p = ev.payload;
      setInstallLog(prev => {
        const lines = prev[p.key] || [];
        return { ...prev, [p.key]: [...lines, p].slice(-200) };
      });
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  // C3 — Drag-drop de pasta (Tauri v2 emite tauri://drag-* na webview)
  useEffect(() => {
    const unlisteners: Array<() => void> = [];
    (async () => {
      try {
        const uEnter = await listen('tauri://drag-enter', () => { setIsDragging(true); });
        const uOver  = await listen('tauri://drag-over',  () => { setIsDragging(true); });
        const uLeave = await listen('tauri://drag-leave', () => { setIsDragging(false); });
        const uDrop  = await listen<{ paths?: string[] }>('tauri://drag-drop', (e) => {
          setIsDragging(false);
          const paths = e.payload?.paths;
          if (paths && paths.length > 0) {
            const first = paths[0];
            if (typeof first === 'string' && first.trim().length > 0) {
              setDirectory(first);
              saveConfig({ directory: first });
            }
          }
        });
        unlisteners.push(uEnter, uOver, uLeave, uDrop);
      } catch (err) {
        console.error('[drag-drop] listen error:', err);
      }
    })();
    return () => { unlisteners.forEach(u => u()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tray: listeners de eventos emitidos pelo backend (menu do tray)
  useEffect(() => {
    const unlisteners: Array<() => void> = [];
    (async () => {
      try {
        const u1 = await listen<string>('tray-launch-cli', (e) => {
          const key = e.payload;
          if (key) {
            setSelectedCli(key);
          }
          setActiveTab('launcher');
        });
        const u2 = await listen<string>('tray-open-tab', (e) => {
          if (e.payload) setActiveTab(e.payload as HeaderTabId);
        });
        const u3 = await listen<null>('tray-update-all', () => {
          setActiveTab('updates');
          updateAllClis();
        });
        const u4 = await listen<string>('tray-set-provider', (e) => {
          const id = e.payload;
          if (!id) return;
          setProviders(prev => {
            const next = setActive(prev, id);
            saveProviders(next);
            const name = next.profiles.find(p => p.id === id)?.name || id;
            showToast(t('toasts.activeProvider', { name }));
            return next;
          });
        });
        unlisteners.push(u1, u2, u3, u4);
      } catch (err) {
        console.error('[tray] listen error:', err);
      }
    })();
    return () => { unlisteners.forEach(u => u()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-check updates ao ter clis carregados + checked
  useEffect(() => {
    if (bootReady && hasChecked && clis.length > 0 && !updatesSummary) {
      checkAllUpdates(true); // silent no boot
    }
  }, [bootReady, hasChecked, clis.length]);

  // v7 preferences: cross-tab sync via storage event.
  // Note: `storage` only fires in OTHER tabs — same-tab sync is handled by the
  // CustomEvent listeners below (v7.1).
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === 'ai-launcher:app-settings') setAppSettings(loadAppSettings());
      if (e.key === 'ai-launcher:custom-ides') setCustomIdesState(loadCustomIdes());
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // v7.1 same-tab sync: AdminPanel/other surfaces saving preferences or custom
  // definitions inside this window dispatch CustomEvents that we subscribe to
  // here so the app reacts live (no reload required).
  useEffect(() => {
    function onSettingsChanged(e: Event) {
      const detail = (e as CustomEvent<AppSettings>).detail;
      if (detail) setAppSettings(detail);
      else setAppSettings(loadAppSettings());
    }
    function onCustomIdesChanged(e: Event) {
      const detail = (e as CustomEvent<CustomIde[]>).detail;
      setCustomIdesState(detail ?? loadCustomIdes());
    }
    window.addEventListener(SETTINGS_CHANGED_EVENT, onSettingsChanged);
    window.addEventListener(CUSTOM_IDES_CHANGED_EVENT, onCustomIdesChanged);
    return () => {
      window.removeEventListener(SETTINGS_CHANGED_EVENT, onSettingsChanged);
      window.removeEventListener(CUSTOM_IDES_CHANGED_EVENT, onCustomIdesChanged);
    };
  }, []);

  // v7 preferences: auto-refresh CLI install state every N seconds (0 = disabled).
  useEffect(() => {
    if (appSettings.refreshInterval <= 0) return;
    const ms = appSettings.refreshInterval * 1000;
    const id = setInterval(() => {
      checkInstalled();
    }, ms);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appSettings.refreshInterval]);

  // Command Palette (Ctrl+Shift+P)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        e.preventDefault();
        setCommandPaletteOpen(o => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Global ⌘/Ctrl+Shift+1-4 tab switch (skip when typing in inputs)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (!e.shiftKey || e.altKey) return;
      if (!['1', '2', '3', '4'].includes(e.key)) return;
      const target = document.activeElement;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) return;
      e.preventDefault();
      const map: Record<string, HeaderTabId> = {
        '1': 'launcher',
        '2': 'install',
        '3': 'history',
        '4': 'costs',
      };
      setActiveTab(map[e.key]);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Admin mode runtime toggle (⌘⇧A / Ctrl+Shift+A)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (!e.shiftKey || e.altKey) return;
      if (e.key.toLowerCase() !== 'a') return;
      const target = document.activeElement;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) return;
      e.preventDefault();
      setAdminModeState((prev) => {
        const next = !prev;
        setAdminMode(next);
        showToast(next ? t('admin.mode.on') : t('admin.mode.off'));
        return next;
      });
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Language cycle (⌘⇧L / Ctrl+Shift+L)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (!e.shiftKey || e.altKey) return;
      if (e.key.toLowerCase() !== 'l') return;
      const target = document.activeElement;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) return;
      e.preventDefault();
      const current = getLocale();
      const next: Locale = current === 'en' ? 'pt-BR' : 'en';
      void setLocale(next);
      showToast(`Language: ${LOCALE_LABELS[next].native}`);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Help modal toggle (⌘/ or ⌘?)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key !== '/' && e.key !== '?') return;
      const target = document.activeElement;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) return;
      e.preventDefault();
      setHelpModalOpen((prev) => !prev);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // F5 = re-check installs
      if (e.key === 'F5') { e.preventDefault(); checkInstalled(); return; }
      // Ctrl+R = re-verifica updates de tudo
      if (e.ctrlKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        checkAllUpdates(false);
        return;
      }
      // Ctrl+U = abre aba Atualizações
      if (e.ctrlKey && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        setActiveTab('updates');
        return;
      }
      // Ctrl+L = foca diretório (no launcher tab)
      if (e.ctrlKey && e.key.toLowerCase() === 'l' && activeTab === 'launcher') {
        e.preventDefault();
        directoryInputRef.current?.focus();
        directoryInputRef.current?.select();
        return;
      }
      // Ctrl+P = Quick Switch de provider (admin only, sem shift pra não conflitar com Command Palette)
      if (adminMode && e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setQuickSwitchOpen(v => !v);
        return;
      }
      // Ctrl+1..9 = dispara preset N (tab switching uses Ctrl+Shift+1..4)
      if (e.ctrlKey && !e.shiftKey && !e.altKey && /^[1-9]$/.test(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        const target = presets[idx];
        if (target) {
          e.preventDefault();
          launchFromPreset(target);
          return;
        }
      }
      // Ctrl+K = lança (no launcher tab, se CLI instalado)
      if (e.ctrlKey && e.key.toLowerCase() === 'k' && activeTab === 'launcher') {
        e.preventDefault();
        launch();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, clis.length, installed, directory, args, noPerms, selectedCli]);

  // Marca CLI/prereq como "recém-atualizado" para animar o card por 3.2s
  function markJustUpdated(key: string) {
    if (!key) return;
    setJustUpdated(prev => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    setTimeout(() => {
      setJustUpdated(prev => {
        if (!prev.has(key)) return prev;
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, 3200);
  }

  // ============= PERSISTÊNCIA =============
  function saveConfig(extra: Record<string, unknown> = {}) {
    const saved = localStorage.getItem('ai-launcher-config');
    const current = saved ? (() => { try { return JSON.parse(saved); } catch { return {}; } })() : {};
    localStorage.setItem('ai-launcher-config', JSON.stringify({
      ...current, hasChecked: true, installed, history, directory, theme, hideWelcome, ...extra,
    }));
  }

  // ============= CHECKS =============
  async function checkInstalled() {
    try {
      const results = await invoke<CheckResult[]>('check_clis');
      const currentClis = clis.length > 0 ? clis : await invoke<CliInfo[]>('get_all_clis');
      if (clis.length === 0) setClis(currentClis);
      const map: Record<string, { installed: boolean; version: string | null }> = {};
      results.forEach(r => {
        const cli = currentClis.find(c => c.name === r.name);
        if (cli) map[cli.key] = { installed: r.installed, version: r.version };
      });
      setInstalled(map);
      setHasChecked(true);
      saveConfig({ installed: map });
    } catch (e) { console.error(e); }
  }

  async function checkEnvironment() {
    try {
      setCheckingEnv(true);
      const results = await invoke<CheckResult[]>('check_environment');
      setEnvChecks(results);
    } catch (e) { console.error(e); } finally { setCheckingEnv(false); }
  }

  async function checkToolsInstalled() {
    try {
      setCheckingTools(true);
      const results = await invoke<CheckResult[]>('check_tools');
      const map: Record<string, { installed: boolean; version: string | null }> = {};
      results.forEach(r => {
        const tool = tools.find(t => t.name === r.name);
        if (tool) map[tool.key] = { installed: r.installed, version: r.version };
      });
      setToolsChecked(map);
      setLastToolsCheck(new Date().toLocaleTimeString('pt-BR'));
    } catch (e) { console.error(e); } finally { setCheckingTools(false); }
  }

  async function checkAllUpdates(silent = false) {
    try {
      setCheckingAllUpdates(true);
      const summary = await invoke<UpdatesSummary>('check_all_updates');
      setUpdatesSummary(summary);
      if (!silent && summary.total_with_updates > 0) {
        showToast(t('toasts.updatesAvailable', { count: summary.total_with_updates }));
      }
    } catch (e) {
      console.error(e);
      if (!silent) showToast(t('toasts.genericError', { error: String(e).slice(0, 120) }));
    } finally { setCheckingAllUpdates(false); }
  }

  // ============= INSTALL / UPDATE =============
  async function installCli(cliKey: string) {
    if (installingRef.current) return;
    installingRef.current = cliKey;
    setInstallingCli(cliKey);
    setInstallLog(prev => ({ ...prev, [cliKey]: [] }));
    try {
      await invoke<string>('install_cli', { cliKey });
      showToast(t('toasts.installed', { name: clis.find(c => c.key === cliKey)?.name || cliKey }));
      await checkInstalled();
    } catch (e: unknown) {
      showToast(t('toasts.failed', { error: String(e).slice(0, 120) }));
    } finally {
      installingRef.current = null;
      setInstallingCli(null);
    }
  }

  async function updateCli(cliKey: string) {
    if (installingRef.current) return;
    installingRef.current = cliKey;
    setUpdatingCli(cliKey);
    setInstallLog(prev => ({ ...prev, [cliKey]: [] }));
    try {
      await invoke('update_cli', { cliKey });
      showToast(t('toasts.updated', { name: clis.find(c => c.key === cliKey)?.name || cliKey }));
      markJustUpdated(cliKey);
      await checkInstalled();
      await checkAllUpdates(true);
    } catch (e: unknown) {
      showToast(t('toasts.failed', { error: String(e).slice(0, 120) }));
    } finally {
      installingRef.current = null;
      setUpdatingCli(null);
    }
  }

  async function updateAllClis() {
    if (installingRef.current || updatingAll) return;
    setUpdatingAll(true);
    try {
      const result = await invoke<string>('update_all_clis');
      showToast(result);
      await checkInstalled();
      await checkAllUpdates(true);
    } catch (e) {
      showToast(t('toasts.genericError', { error: String(e).slice(0, 120) }));
    } finally { setUpdatingAll(false); }
  }

  async function updatePrereq(key: string, method: string) {
    if (!key) return;
    // Lock síncrono via ref — previne race de duplo-clique antes do setState
    if (installingRef.current) return;
    installingRef.current = key;
    const isNpm = method === 'npm';
    if (isNpm) {
      setInstallingCli(key);
      setInstallLog(prev => ({ ...prev, [key]: [] }));
    }
    setUpdatingPrereq(key);
    try {
      const result = await invoke<string>('update_prerequisite', { key });
      showToast(result);
      if (isNpm) {
        markJustUpdated(key);
        await checkEnvironment();
        await checkAllUpdates(true);
      }
    } catch (e) {
      showToast(t('toasts.genericError', { error: String(e).slice(0, 120) }));
    } finally {
      // Para browser: mantém o spinner por 1.2s pra dar feedback visual
      if (!isNpm) {
        setTimeout(() => setUpdatingPrereq(null), 1200);
      } else {
        setUpdatingPrereq(null);
        setInstallingCli(null);
      }
      installingRef.current = null;
    }
  }

  async function installPrerequisite(key: string) {
    if (!key) return;
    if (installingRef.current) return;
    const isBrowser = ['node','git','python','rust','bun','docker','windows-terminal','wt','vscode','git-lfs','powershell'].includes(key);
    if (!isBrowser) {
      installingRef.current = key;
      setInstallingCli(key);
      setInstallLog(prev => ({ ...prev, [key]: [] }));
    }
    try {
      await invoke('install_prerequisite', { key });
      showToast(t('toasts.ready', { key }));
      if (!isBrowser) await checkEnvironment();
    } catch (e) {
      showToast(t('toasts.genericError', { error: String(e).slice(0,120) }));
    } finally {
      if (!isBrowser) {
        installingRef.current = null;
        setInstallingCli(null);
      }
    }
  }

  async function installToolViaUrl(toolKey: string) {
    try {
      await invoke('install_tool', { toolKey });
      showToast(t('toasts.openingDownload'));
    } catch (e) { showToast(t('toasts.genericError', { error: String(e).slice(0, 120) })); }
  }

  // ============= LAUNCH =============

  // Budget alert: cruza usage.jsonl com preço do perfil ativo.
  async function checkBudgetAlert(): Promise<void> {
    const active = providers.profiles.find(p => p.id === providers.activeId);
    if (!active || !active.dailyBudget || active.dailyBudget <= 0) return;
    try {
      const report = await invoke<{ entries: Array<{ date: string; cli: string; model: string | null; tokens_in: number; tokens_out: number; cost_estimate_usd: number }> }>('read_usage_stats');
      const spend = computeTodaySpend(report.entries || [], active);
      if (shouldAlert(spend, active.dailyBudget)) {
        showToast(t('toasts.budgetExceeded', {
          today: spend.usd.toFixed(2),
          budget: active.dailyBudget.toFixed(2),
          name: active.name,
        }));
      }
    } catch { /* sem usage ainda = sem alerta */ }
  }

  async function launch() {
    const cli = clis.find(c => c.key === selectedCli);
    if (!cli) return;
    try {
      const envVars = selectedCli === 'claude' ? buildLaunchEnv(providers) : undefined;
      const providerInfo = selectedCli === 'claude' ? currentProviderInfo() : undefined;
      if (selectedCli === 'claude') checkBudgetAlert();
      await invoke('launch_cli', {
        cliKey: selectedCli, directory, args, noPerms,
        envVars,
      });
      if (envVars && providerInfo) {
        const red = redactEnv(envVars);
        const keys = Object.keys(red).join(', ');
        showToast(t('toasts.launchedWith', { cli: cli.name, provider: providerInfo.providerName, keys }));
      }
      if (directory) pushRecent(directory);
      const newItem: HistoryItem = {
        cli: cli.name, cliKey: cli.key, directory, args,
        timestamp: new Date().toLocaleString('pt-BR'),
        provider: providerInfo,
      };
      const isDup = history[0] && history[0].cliKey === newItem.cliKey &&
        history[0].directory === newItem.directory && history[0].args === newItem.args &&
        history[0].provider?.providerId === newItem.provider?.providerId;
      const cap = Math.max(1, appSettings.maxHistory);
      const newHistory = isDup ? history : [newItem, ...history.slice(0, cap - 1)];
      setHistory(newHistory);
      saveConfig({ history: newHistory });
    } catch (e) { showToast(t('toasts.genericError', { error: String(e).slice(0,120) })); }
  }

  async function relaunchFromHistory(item: HistoryItem) {
    try {
      // Re-aplica o provider ATUAL (não o registrado no histórico) pra evitar
      // usar chave/config antiga já excluída.
      const envVars = item.cliKey === 'claude' ? buildLaunchEnv(providers) : undefined;
      await invoke('launch_cli', {
        cliKey: item.cliKey, directory: item.directory, args: item.args,
        noPerms: true, envVars,
      });
      if (item.directory) pushRecent(item.directory);
    } catch (e) { showToast(t('toasts.genericError', { error: String(e).slice(0,120) })); }
  }

  function clearHistory() {
    if (confirm(t('history.clearAllConfirm'))) {
      setHistory([]);
      saveConfig({ history: [] });
    }
  }

  // ============= PRESETS =============

  function savePresetFromCurrent(name: string, emoji: string) {
    const preset: LaunchPreset = {
      id: generatePresetId(),
      name, emoji,
      cliKey: selectedCli,
      providerId: selectedCli === 'claude' ? providers.activeId : undefined,
      directory, args, noPerms,
      createdAt: new Date().toISOString(),
    };
    setPresets(prev => addPreset(prev, preset));
    showToast(t('toasts.presetSaved', { name }));
  }

  async function launchFromPreset(p: LaunchPreset) {
    setSelectedCli(p.cliKey);
    setDirectory(p.directory);
    setArgs(p.args);
    setNoPerms(p.noPerms);
    // Aplica provider do preset, se houver e existir ainda
    let stateForLaunch = providers;
    if (p.cliKey === 'claude' && p.providerId && providers.profiles.some(pp => pp.id === p.providerId)) {
      stateForLaunch = setActive(providers, p.providerId);
      setProviders(stateForLaunch);
      saveProviders(stateForLaunch);
    }
    const cli = clis.find(c => c.key === p.cliKey);
    if (!cli) { showToast(t('toasts.cliNotFound', { key: p.cliKey })); return; }
    try {
      const envVars = p.cliKey === 'claude' ? buildLaunchEnv(stateForLaunch) : undefined;
      const providerInfo = p.cliKey === 'claude' ? (() => {
        const ap = stateForLaunch.profiles.find(pp => pp.id === stateForLaunch.activeId);
        if (!ap || (ap.kind === 'anthropic' && !ap.baseUrl)) return undefined;
        return {
          providerId: ap.id, providerName: ap.name, providerKind: ap.kind,
          mainModel: stateForLaunch.overrideMainModel || ap.mainModel,
          fastModel: stateForLaunch.overrideFastModel || ap.fastModel,
        };
      })() : undefined;
      if (p.cliKey === 'claude') checkBudgetAlert();
      await invoke('launch_cli', { cliKey: p.cliKey, directory: p.directory, args: p.args, noPerms: p.noPerms, envVars });
      if (p.directory) pushRecent(p.directory);
      const newItem: HistoryItem = {
        cli: cli.name, cliKey: cli.key,
        directory: p.directory, args: p.args,
        timestamp: new Date().toLocaleString('pt-BR'),
        provider: providerInfo,
      };
      const cap = Math.max(1, appSettings.maxHistory);
      const newHistory = [newItem, ...history.slice(0, cap - 1)];
      setHistory(newHistory);
      saveConfig({ history: newHistory });
      showToast(t('toasts.launchedPreset', { emoji: p.emoji || '⚡', name: p.name }));
    } catch (e) {
      showToast(t('toasts.genericError', { error: String(e).slice(0, 120) }));
    }
  }

  function removePresetById(id: string) {
    setPresets(prev => removePreset(prev, id));
    showToast(t('toasts.presetDeleted'));
  }

  function renamePreset(id: string, name: string) {
    setPresets(prev => updatePreset(prev, id, { name }));
  }

  async function launchMulti() {
    if (multiSelected.length === 0) return;
    try {
      // Multi: só injeta env do provider se "claude" estiver no lote.
      const envVars = multiSelected.includes('claude') ? buildLaunchEnv(providers) : undefined;
      await invoke('launch_multi_clis', {
        cliKeys: multiSelected, directory, args, noPerms,
        envVars,
      });
      if (directory) pushRecent(directory);
    } catch (e) { showToast(t('toasts.genericError', { error: String(e).slice(0,120) })); }
  }

  async function launchTool(toolKey: string) {
    try {
      await invoke('launch_tool', { toolKey });
      showToast(t('toasts.openingTool', { name: tools.find(tl => tl.key === toolKey)?.name || toolKey }));
    } catch (e) { showToast(t('toasts.genericError', { error: String(e).slice(0,120) })); }
  }

  function toggleMultiCli(key: string) {
    setMultiSelected(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }

  async function pickDir() {
    const selected = await open({ directory: true });
    if (selected) {
      setDirectory(selected as string);
      saveConfig({ directory: selected });
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  // C3 — Projetos recentes (top 5, dedupe, mais recente primeiro)
  function pushRecent(path: string) {
    const p = (path || '').trim();
    if (!p) return;
    setRecentProjects(prev => {
      const next = [p, ...prev.filter(x => x !== p)].slice(0, 5);
      saveConfig({ recentProjects: next });
      return next;
    });
  }
  function removeRecent(path: string) {
    setRecentProjects(prev => {
      const next = prev.filter(x => x !== path);
      saveConfig({ recentProjects: next });
      return next;
    });
  }
  function basenameOf(p: string): string {
    if (!p) return '';
    const parts = p.replace(/\\/g, '/').split('/').filter(Boolean);
    return parts[parts.length - 1] || p;
  }

  // ============= RESET =============
  async function resetAllConfig() {
    if (!confirm(t('toasts.clearAllConfirm'))) return;
    try {
      await invoke('reset_all_config');
      localStorage.removeItem('ai-launcher-config');
      showToast(t('toasts.settingsReset'));
      setTimeout(() => window.location.reload(), 500);
    } catch (e) { showToast(t('toasts.genericError', { error: String(e).slice(0,120) })); }
  }

  // ==================== RENDER ====================

  // Loading
  if (!bootReady) {
    return <div className="welcome-screen"><div className="welcome-box"><div className="spinner" /><p style={{marginTop:12}}>{t('welcome.loading')}</p></div></div>;
  }

  // Welcome: visível (primeira vez OU usuário não ocultou)
  if (welcomeVisible) {
    const isFirstTime = !hasChecked;
    return (
      <div className="welcome-screen">
        <div className="welcome-box">
          <div className="welcome-logo">
            <svg viewBox="0 0 24 24" width="56" height="56">
              <rect width="24" height="24" rx="5" fill="#8B1E2A" />
              <path d="M7 7l-3 5 3 5M17 7l3 5-3 5" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
              <path d="M10 10h4M10 14h4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <h1>{isFirstTime ? `${t('welcome.greeting')} ` : ''}{t('welcome.brand')} <span>Pro</span></h1>
          <p className="welcome-version">v{APP_VERSION}</p>
          <p className="welcome-brand">{t('footer.by')} • {t('footer.poweredBy')}</p>

          {isFirstTime && (
            <p className="welcome-note">
              <strong>{t('welcome.firstTimeTitle')}</strong> {t('welcome.firstTimeBody')}
            </p>
          )}

          {checkingEnv ? (
            <div className="welcome-loading"><div className="spinner" /><p>{t('welcome.validating')}</p></div>
          ) : envChecks.length > 0 ? (
            <div className="welcome-env">
              <div className="welcome-env-title">{t('welcome.envDetected')}</div>
              <div className="env-grid">
                {envChecks.map((check) => (
                  <div key={check.name} className={`env-item ${check.installed ? 'ok' : 'missing'}`}>
                    <span className="env-status">{check.installed ? '✓' : '✗'}</span>
                    <span className="env-name">{check.name}</span>
                    {check.version && <span className="env-ver">{check.version}</span>}
                  </div>
                ))}
              </div>
              <button className="welcome-btn" onClick={() => { setWelcomeVisible(false); if (isFirstTime) checkInstalled(); }}>
                {t('welcome.continueToLauncher')}
              </button>
            </div>
          ) : (
            <>
              <button className="welcome-btn" onClick={() => { checkEnvironment(); checkInstalled(); }}>
                {t('welcome.validateSystem')}
              </button>
              {!isFirstTime && (
                <button className="welcome-btn secondary" onClick={() => setWelcomeVisible(false)}>
                  {t('welcome.goDirectly')}
                </button>
              )}
              {isFirstTime && (
                <button className="welcome-btn secondary" onClick={() => {
                  setHasChecked(true); setWelcomeVisible(false);
                  saveConfig({ hasChecked: true });
                }}>
                  {t('welcome.skipValidation')}
                </button>
              )}
            </>
          )}

          <label className="welcome-checkbox">
            <input type="checkbox" checked={hideWelcome} onChange={e => {
              setHideWelcome(e.target.checked);
              saveConfig({ hideWelcome: e.target.checked });
            }} />
            <span>{t('welcome.hideCheckbox')}</span>
          </label>
        </div>
      </div>
    );
  }

  // ==================== MAIN APP ====================

  const selectedCliData = clis.find(c => c.key === selectedCli);
  const notInstalledClis = clis.filter(c => !installed[c.key]?.installed);
  const installedClis = clis.filter(c => installed[c.key]?.installed);
  const currentInstallingLog = installingCli ? (installLog[installingCli] || []) : [];
  const updateCount = updatesSummary?.total_with_updates || 0;

  return (
    <div className={`app${isDragging ? ' dragging' : ''}`}>
      {showOnboarding && <Onboarding onClose={closeOnboarding} />}
      <HeaderBar
        activeTab={activeTab}
        onSelectTab={(tabId: HeaderTabId) => {
          setActiveTab(tabId);
          if (tabId === 'install' && envChecks.length === 0) checkEnvironment();
          if (tabId === 'tools' && Object.keys(toolsChecked).length === 0) checkToolsInstalled();
          if (tabId === 'updates' && !updatesSummary) checkAllUpdates(false);
        }}
        onThemeToggle={() => { const t = theme === 'dark' ? 'light' : 'dark'; setTheme(t); saveConfig({ theme: t }); }}
        onRefresh={checkInstalled}
        theme={theme}
        version={APP_VERSION}
        adminMode={adminMode}
        providers={providers}
        updateCount={updateCount}
        onOpenPalette={() => setCommandPaletteOpen(true)}
      />

      <main key={activeTab} className="tab-content">
      {/* ========== LAUNCHER ========== */}
      {activeTab === 'launcher' && (
        <LauncherTab
          bootReady={bootReady}
          hasChecked={hasChecked}
          adminMode={adminMode}
          clis={clis}
          installed={installed}
          installedClis={installedClis}
          updatesSummary={updatesSummary}
          selectedCli={selectedCli}
          setSelectedCli={setSelectedCli}
          directory={directory}
          setDirectory={setDirectory}
          args={args}
          setArgs={setArgs}
          noPerms={noPerms}
          setNoPerms={setNoPerms}
          multiSelected={multiSelected}
          toggleMultiCli={toggleMultiCli}
          directoryInputRef={directoryInputRef}
          recentProjects={recentProjects}
          removeRecent={removeRecent}
          basenameOf={basenameOf}
          providers={providers}
          updateProviders={updateProviders}
          presets={presets}
          launchFromPreset={launchFromPreset}
          removePresetById={removePresetById}
          savePresetFromCurrent={savePresetFromCurrent}
          renamePreset={renamePreset}
          pickDir={pickDir}
          launch={launch}
          launchMulti={launchMulti}
          setDryRunOpen={setDryRunOpen}
          setActiveTab={(t) => setActiveTab(t as HeaderTabId)}
          saveConfigDirectory={(dir) => saveConfig({ directory: dir })}
          openInExplorer={async (path) => {
            try { await invoke('open_in_explorer', { path }); }
            catch (e) { showToast(t('toasts.genericError', { error: String(e).slice(0,120) })); }
          }}
        />
      )}

      {/* ========== INSTALL ========== */}
      {activeTab === 'install' && (
        <div className="tab-scroll">
          <div className="tab-pad">
          <div className="tab-section-header">
            <h2>{t('header.tabs.install')}</h2>
            <p className="tab-section-sub">{t('installTab.sub')}</p>
          </div>
          <div className="install-top-actions">
            <button className="btn" onClick={checkEnvironment} disabled={checkingEnv}>
              {checkingEnv ? <><span className="spinner-sm" /> <Skeleton width={84} height={10} /></> : t('installTab.recheckPrereqs')}
            </button>
          </div>

          {envChecks.length > 0 && (
            <div className="prereq-section">
              <div className="prereq-title">{t('installTab.prereqTitle')}</div>
              <div className="prereq-grid">
                {envChecks.map(check => {
                  const pKey = prereqKeyFor(check.name);
                  return (
                    <div key={check.name} className={`prereq-item ${check.installed ? 'ok' : 'missing'}`}>
                      <span>{check.installed ? '✓' : '✗'}</span>
                      <span>{check.name}</span>
                      {check.version && <span className="prereq-ver">{check.version}</span>}
                      {!check.installed && pKey && (
                        installingCli === pKey ? (
                          <span className="installing-badge"><span className="spinner-sm" /> {t('installTab.installing')}</span>
                        ) : (
                          <button className="btn-prereq-install" disabled={!!installingCli} onClick={() => installPrerequisite(pKey)}>{t('installTab.installButton')}</button>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {notInstalledClis.length > 0 && (
            <div className="install-highlight">
              <div className="install-highlight-title">{t('installTab.cliNotInstalled')} ({notInstalledClis.length})</div>
              <div className="install-list">
                {notInstalledClis.map(cli => (
                  <div key={cli.key} className="install-item missing" style={{ borderLeftColor: CLI_COLORS[cli.key] || '#8B1E2A' }}>
                    <div className="install-icon"><CliIcon cliKey={cli.key} size={32} /></div>
                    <div className="install-info">
                      <div className="install-name">{cli.name}</div>
                      <div className="install-cmd">{cli.install_cmd}</div>
                    </div>
                    <div className="install-action">
                      {installingCli === cli.key ? (
                        <span className="installing-badge"><span className="spinner-sm" /> {t('installTab.installing')}</span>
                      ) : (
                        <button className="btn-install" onClick={() => installCli(cli.key)} disabled={!!installingCli}>{t('installTab.installButton')}</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {installedClis.length > 0 && (
            <div className="install-section">
              <div className="install-section-title">{t('installTab.installedSection', { n: installedClis.length })}</div>
              <div className="install-list">
                {installedClis.map(cli => {
                  const info = installed[cli.key];
                  return (
                    <div key={cli.key} className="install-item" style={{ borderLeftColor: CLI_COLORS[cli.key] || '#8B1E2A' }}>
                      <div className="install-icon"><CliIcon cliKey={cli.key} size={32} /></div>
                      <div className="install-info">
                        <div className="install-name">{cli.name}</div>
                        <div className="install-version">{info?.version || t('launcher.installed')}</div>
                      </div>
                      <div className="install-action">
                        <span className="installed-badge">{t('installTab.installedBadge')}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {installingCli && currentInstallingLog.length > 0 && (
            <div className="install-log">
              <div className="install-log-title">{t('installTab.logTitle', { cli: installingCli })}</div>
              <div className="install-log-body">
                {currentInstallingLog.slice(-40).map((line, i) => (
                  <div key={i} className={`log-line log-${line.phase}`}>{line.line}</div>
                ))}
              </div>
            </div>
          )}
          </div>
        </div>
      )}

      {/* ========== TOOLS ========== */}
      {activeTab === 'tools' && (
        <div className="tab-scroll">
          <div className="tab-pad">
          <div className="tools-header">
            <h2>{t('header.tabs.tools')}</h2>
            <div className="tools-header-actions">
              <button className="btn" onClick={checkToolsInstalled} disabled={checkingTools}>
                {checkingTools ? <><span className="spinner-sm" /> <Skeleton width={60} height={10} /></> : t('toolsTab.recheck')}
              </button>
              {lastToolsCheck && <span className="last-check">{t('toolsTab.lastCheck', { time: lastToolsCheck })}</span>}
            </div>
          </div>
          <div className="tools-grid">
            {tools.map(tool => {
              const info = toolsChecked[tool.key] || { installed: false, version: null };
              return (
                <div key={tool.key} className={`tool-card ${info.installed ? 'installed' : ''}`}>
                  <div className="tool-icon"><ToolIcon toolKey={tool.key} size={48} /></div>
                  <div className="tool-name">{tool.name}</div>
                  <div className="tool-status">{info.version || (info.installed ? t('toolsTab.available') : t('toolsTab.notInstalled'))}</div>
                  {info.installed ? (
                    <button className="tool-launch-btn" onClick={() => launchTool(tool.key)}>{t('toolsTab.open')}</button>
                  ) : (
                    <button className="tool-launch-btn install" onClick={() => installToolViaUrl(tool.key)}>{t('toolsTab.download')}</button>
                  )}
                </div>
              );
            })}
          </div>

          <section className="tools-custom-section">
            <h3 className="admin-section__title">
              <span>{t('customIde.addTitle')}</span>
            </h3>
            {customIdes.length === 0 ? (
              <p className="admin-section__hint">{t('customIde.emptyState')}</p>
            ) : (
              <ul className="admin-custom-list">
                {customIdes.map(ide => (
                  <li key={ide.key} className="admin-custom-list__item">
                    <span className="admin-custom-list__icon">{ide.iconEmoji || '▶'}</span>
                    <span className="admin-custom-list__name">{ide.name}</span>
                    <code className="admin-custom-list__key">{ide.key}</code>
                    <span className="admin-custom-list__spacer" />
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleLaunchCustomIde(ide)}
                    >
                      {t('launcher.launch')}
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => { setEditingCustomIde(ide); setCustomIdeModalOpen(true); }}
                    >
                      {t('common.edit')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => handleDeleteCustomIde(ide.key)}
                    >
                      {t('customIde.delete')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              className="btn"
              onClick={() => { setEditingCustomIde(null); setCustomIdeModalOpen(true); }}
            >
              {t('customIde.addBtn')}
            </button>
          </section>
          </div>
        </div>
      )}

      {/* ========== HISTORY ========== */}
      {activeTab === 'history' && (
        <HistoryTab
          history={history}
          clearHistory={clearHistory}
          relaunchFromHistory={relaunchFromHistory}
        />
      )}

      {/* ========== UPDATES (reformulado v3.2.1) ========== */}
      {activeTab === 'updates' && (
        <div className="tab-scroll">
          <div className="tab-pad">
          <div className="updates-global-header">
            <h2>{t('header.tabs.updates')}</h2>
            <div className="updates-global-actions">
              {updatesSummary && (
                <span className="updates-timestamp">
                  {t('updatesTab.lastCheck', { time: formatTimestamp(updatesSummary.checked_at), n: updateCount })}
                </span>
              )}
              <button className="btn" onClick={() => checkAllUpdates(false)} disabled={checkingAllUpdates}>
                {checkingAllUpdates ? <><span className="spinner-sm" /> <Skeleton width={72} height={10} /></> : t('updatesTab.checkAll')}
              </button>
              {updatesSummary && updatesSummary.cli_updates.some(u => u.has_update) && (
                <button className="btn btn-primary" onClick={updateAllClis} disabled={updatingAll || !!installingCli}>
                  {updatingAll ? <><span className="spinner-sm" /> {t('updatesTab.updating')}</> : t('updatesTab.updateAll')}
                </button>
              )}
            </div>
          </div>

          {checkingAllUpdates && !updatesSummary && (
            <div className="skeleton-group">
              {[1,2,3,4,5].map(i => <div key={i} className="skeleton-row" />)}
            </div>
          )}

          {updatesSummary && (
            <>
              {/* CLIs */}
              <details className="updates-section" open>
                <summary>
                  <span>{t('updatesTab.aiClisGroup')}</span>
                  <span className="updates-section-counter">
                    {t('updatesTab.counter', { n: updatesSummary.cli_updates.filter(u => u.has_update).length, total: updatesSummary.cli_updates.length })}
                  </span>
                </summary>
                <div className="updates-list">
                  {updatesSummary.cli_updates.map((u, i) => {
                    const cliKey = clis.find(c => c.name === u.cli)?.key || '';
                    const isUpdating = updatingCli === cliKey;
                    const flash = cliKey && justUpdated.has(cliKey) ? 'just-updated' : '';
                    return (
                      <div key={cliKey || i} className={`update-item ${u.has_update ? 'has-update' : ''} ${flash}`}>
                        <div className="update-icon">{cliKey && <CliIcon cliKey={cliKey} size={28} />}</div>
                        <div className="update-info">
                          <div className="update-name">{u.cli}</div>
                          <div className="update-versions">
                            <span className="update-current">{u.current ? t('updatesTab.current', { version: u.current }) : t('updatesTab.currentMissing')}</span>
                            {u.has_update && (<><span className="update-sep">→</span><span className="update-latest">{u.latest}</span></>)}
                            {!u.has_update && u.current && <span className="badge-uptodate-inline">✓</span>}
                          </div>
                        </div>
                        <div className="update-action">
                          {u.has_update ? (
                            <button className="btn-update" onClick={() => updateCli(cliKey)} disabled={isUpdating || !!installingCli}>
                              {isUpdating ? <><span className="spinner-sm" /> ...</> : t('updatesTab.updateBtn')}
                            </button>
                          ) : !u.current ? (
                            <span className="badge-neutral">{t('updatesTab.notInstalledBadge')}</span>
                          ) : (
                            <span className="badge-uptodate">{t('updatesTab.upToDateBadge')}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>

              {/* Pré-requisitos */}
              <details className="updates-section" open>
                <summary>
                  <span>{t('updatesTab.prereqsGroup')}</span>
                  <span className="updates-section-counter">
                    {t('updatesTab.counter', { n: updatesSummary.env_updates.filter(u => u.has_update).length, total: updatesSummary.env_updates.length })}
                  </span>
                </summary>
                <div className="updates-list">
                  {updatesSummary.env_updates.length === 0 ? (
                    <p className="empty-inline">{t('updatesTab.emptyPrereqs')}</p>
                  ) : updatesSummary.env_updates.map((u) => {
                    const prereqKey = u.key || prereqKeyFor(u.cli);
                    const isUpdatingThis = updatingPrereq === prereqKey;
                    // Normaliza método: 'npm' atualiza direto, qualquer outro → browser
                    const isNpm = u.method === 'npm';
                    const effectiveMethod = isNpm ? 'npm' : 'browser';
                    return (
                      <div key={prereqKey || u.cli} className={`update-item ${u.has_update ? 'has-update' : ''} ${justUpdated.has(prereqKey) ? 'just-updated' : ''}`}>
                        <div className="update-info">
                          <div className="update-name">{u.cli}</div>
                          <div className="update-versions">
                            <span className="update-current">{u.current ? t('updatesTab.current', { version: u.current }) : t('updatesTab.currentDash')}</span>
                            {u.latest && (<><span className="update-sep">→</span><span className="update-latest">{u.latest}</span></>)}
                          </div>
                        </div>
                        <div className="update-action">
                          {u.has_update && isNpm ? (
                            <button
                              className="btn-update"
                              onClick={() => updatePrereq(prereqKey, 'npm')}
                              disabled={isUpdatingThis || !!installingCli}
                              title={t('updatesTab.updateViaNpm')}
                              aria-label={t('updatesTab.updateCliLabel', { cli: u.cli })}
                            >
                              {isUpdatingThis ? <><span className="spinner-sm" /> ...</> : t('updatesTab.updateBtn')}
                            </button>
                          ) : u.has_update ? (
                            <button
                              className="btn btn-ghost"
                              onClick={() => updatePrereq(prereqKey, effectiveMethod)}
                              disabled={isUpdatingThis}
                              title={t('updatesTab.openDownloadPage')}
                              aria-label={t('updatesTab.openDownloadLabel', { cli: u.cli })}
                            >
                              {isUpdatingThis ? <><span className="spinner-sm" /> {t('updatesTab.opening')}</> : t('updatesTab.openPage')}
                            </button>
                          ) : u.latest ? (
                            <span className="badge-uptodate" title={t('updatesTab.upToDate')}>✓</span>
                          ) : (
                            <span className="badge-neutral" title={t('updatesTab.noComparisonTitle')}>{t('updatesTab.noComparison')}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>

              {/* Ferramentas/IDEs removidas da UI em v3.2.6 — APIs públicas
                  de versão não eram confiáveis e confundiam o usuário.
                  Updates de IDE devem ser feitos pela própria IDE. */}
            </>
          )}
          </div>
        </div>
      )}

      {/* ========== COSTS (v4.0 F4) ========== */}
      {activeTab === 'orchestrator' && (
        <Orchestrator
          clis={clis}
          installed={installed}
          directory={directory}
          setDirectory={setDirectory}
          pickDirectory={pickDir}
          onToast={showToast}
        />
      )}

      {activeTab === 'costs' && <CostsTab />}

      {activeTab === 'admin' && (
        <AdminTab
          adminMode={adminMode}
          providers={providers}
          updateProviders={updateProviders}
          showToast={showToast}
        />
      )}

      {/* ========== HELP (v7.0 2-pane FAQ) ========== */}
      {activeTab === 'help' && (
        <HelpTab
          onReopenOnboarding={reopenOnboarding}
          onReenableWelcome={() => {
            setHideWelcome(false);
            saveConfig({ hideWelcome: false });
            showToast(t('toasts.welcomeOnNext'));
          }}
          welcomeActive={!hideWelcome}
          onResetAll={resetAllConfig}
        />
      )}
      </main>

      <StatusBar
        version={APP_VERSION}
        provider={currentProviderInfo()?.providerName}
        activeTab={activeTab}
      />

      {adminMode && (
        <QuickSwitchModal
          open={quickSwitchOpen}
          state={providers}
          onChange={updateProviders}
          onClose={() => setQuickSwitchOpen(false)}
        />
      )}

      <DryRunModal
        open={dryRunOpen}
        state={providers}
        selectedCli={selectedCli}
        command={selectedCliData?.command || ''}
        flag={selectedCliData?.flag || null}
        noPerms={noPerms}
        args={args}
        directory={directory}
        onClose={() => setDryRunOpen(false)}
      />

      <CustomIdeModal
        open={customIdeModalOpen}
        editing={editingCustomIde}
        existingKeys={customIdes.map(i => i.key)}
        onSave={handleSaveCustomIde}
        onCancel={() => { setCustomIdeModalOpen(false); setEditingCustomIde(null); }}
      />

      {toast && <div className="toast show">{toast}</div>}

      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        clis={clis}
        tools={tools}
        installed={installed}
        onLaunchCli={(key) => {
          setSelectedCli(key);
          // Lança diretamente por key para evitar stale closure do state
          (async () => {
            const cli = clis.find(c => c.key === key);
            if (!cli) return;
            try {
              const envVars = key === 'claude' ? buildLaunchEnv(providers) : undefined;
              const providerInfo = key === 'claude' ? currentProviderInfo() : undefined;
              await invoke('launch_cli', {
                cliKey: key, directory, args, noPerms,
                envVars,
              });
              if (directory) pushRecent(directory);
              const newItem: HistoryItem = {
                cli: cli.name, cliKey: cli.key, directory, args,
                timestamp: new Date().toLocaleString('pt-BR'),
                provider: providerInfo,
              };
              const isDup = history[0] && history[0].cliKey === newItem.cliKey &&
                history[0].directory === newItem.directory && history[0].args === newItem.args &&
                history[0].provider?.providerId === newItem.provider?.providerId;
              const cap = Math.max(1, appSettings.maxHistory);
              const newHistory = isDup ? history : [newItem, ...history.slice(0, cap - 1)];
              setHistory(newHistory);
              saveConfig({ history: newHistory });
            } catch (e) { showToast(t('toasts.genericError', { error: String(e).slice(0,120) })); }
          })();
        }}
        onLaunchTool={(key) => { launchTool(key); }}
        onOpenTab={(t) => setActiveTab(t as HeaderTabId)}
        onToggleTheme={() => {
          const t = theme === 'dark' ? 'light' : 'dark';
          setTheme(t);
          saveConfig({ theme: t });
        }}
        onReloadStatus={checkInstalled}
        onUpdateAll={updateAllClis}
      />

      <HelpModal open={helpModalOpen} onClose={() => setHelpModalOpen(false)} />

      <footer className="footer">
        <span>{t('footer.clisCount', { n: clis.filter(c => installed[c.key]?.installed).length, total: clis.length })}{updateCount > 0 && <span className="footer-updates"> · {t('toasts.updatesAvailable', { count: updateCount })}</span>}</span>
        <span>{t('footer.by')} • {t('footer.poweredBy')}</span>
      </footer>
    </div>
  );
}

export default App;
