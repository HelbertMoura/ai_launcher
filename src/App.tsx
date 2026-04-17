import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import CommandPalette from './CommandPalette';
import CostAggregator from './CostAggregator';
import Orchestrator from './Orchestrator';
import { Onboarding } from './Onboarding';
import { Skeleton } from './Skeleton';
import { EmptyState } from './EmptyState';

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
interface HistoryItem { cli: string; cliKey: string; directory: string; args: string; timestamp: string; }
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

const CLI_COLORS: Record<string, string> = {
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

function CliIcon({ cliKey, size = 32 }: { cliKey: string; size?: number }) {
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
  const [activeTab, setActiveTab] = useState('launcher');
  const [bootReady, setBootReady] = useState(false);

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

  // System Tray / Hotkey global
  const [trayHotkey, setTrayHotkey] = useState<string>('CommandOrControl+Alt+Space');
  const [minimizeToTray, setMinimizeToTray] = useState<boolean>(false);

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

  // Tray: carregar config inicial (hotkey + minimize-to-tray)
  useEffect(() => {
    (async () => {
      try {
        const hk = await invoke<string>('get_tray_hotkey');
        if (hk) setTrayHotkey(hk);
      } catch { /* ignore */ }
      try {
        const m = await invoke<boolean>('get_minimize_to_tray');
        setMinimizeToTray(Boolean(m));
      } catch { /* ignore */ }
    })();
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
          if (e.payload) setActiveTab(e.payload);
        });
        const u3 = await listen<null>('tray-update-all', () => {
          setActiveTab('updates');
          updateAllClis();
        });
        unlisteners.push(u1, u2, u3);
      } catch (err) {
        console.error('[tray] listen error:', err);
      }
    })();
    return () => { unlisteners.forEach(u => u()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tray: carrega hotkey/minimize flag do backend no boot
  useEffect(() => {
    (async () => {
      try {
        const hk = await invoke<string>('get_tray_hotkey').catch(() => 'CommandOrControl+Alt+Space');
        if (hk) setTrayHotkey(hk);
        const mm = await invoke<boolean>('get_minimize_to_tray').catch(() => false);
        setMinimizeToTray(Boolean(mm));
      } catch {
        /* silencioso — defaults permanecem */
      }
    })();
  }, []);

  async function saveTrayHotkey() {
    try {
      await invoke('set_tray_hotkey', { hotkey: trayHotkey });
      showToast('Atalho global atualizado');
    } catch (e) {
      showToast(`Erro ao salvar atalho: ${String(e).slice(0, 120)}`);
    }
  }

  async function resetTrayHotkey() {
    const def = 'CommandOrControl+Alt+Space';
    setTrayHotkey(def);
    try {
      await invoke('set_tray_hotkey', { hotkey: def });
      showToast('Atalho global resetado');
    } catch (e) {
      showToast(`Erro: ${String(e).slice(0, 120)}`);
    }
  }

  async function toggleMinimizeToTray(enabled: boolean) {
    setMinimizeToTray(enabled);
    try {
      await invoke('set_minimize_to_tray', { enabled });
    } catch (e) {
      showToast(`Erro: ${String(e).slice(0, 120)}`);
    }
  }

  // Auto-check updates ao ter clis carregados + checked
  useEffect(() => {
    if (bootReady && hasChecked && clis.length > 0 && !updatesSummary) {
      checkAllUpdates(true); // silent no boot
    }
  }, [bootReady, hasChecked, clis.length]);

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
        showToast(`${summary.total_with_updates} atualização(ões) disponível(eis)`);
      }
    } catch (e) {
      console.error(e);
      if (!silent) showToast(`Erro: ${String(e).slice(0, 120)}`);
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
      showToast(`${clis.find(c => c.key === cliKey)?.name || cliKey}: instalado`);
      await checkInstalled();
    } catch (e: unknown) {
      showToast(`Falhou: ${String(e).slice(0, 120)}`);
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
      showToast(`${clis.find(c => c.key === cliKey)?.name || cliKey}: atualizado`);
      markJustUpdated(cliKey);
      await checkInstalled();
      await checkAllUpdates(true);
    } catch (e: unknown) {
      showToast(`Falhou: ${String(e).slice(0, 120)}`);
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
      showToast(`Erro: ${String(e).slice(0, 120)}`);
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
      showToast(`Erro: ${String(e).slice(0, 120)}`);
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
      showToast(`${key}: pronto`);
      if (!isBrowser) await checkEnvironment();
    } catch (e) {
      showToast(`Erro: ${String(e).slice(0,120)}`);
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
      showToast(`Abrindo página de download`);
    } catch (e) { showToast(`Erro: ${String(e).slice(0, 120)}`); }
  }

  // ============= LAUNCH =============

  async function launch() {
    const cli = clis.find(c => c.key === selectedCli);
    if (!cli) return;
    try {
      await invoke('launch_cli', {
        cliKey: selectedCli, directory, args, noPerms,
        envVars: undefined,
      });
      if (directory) pushRecent(directory);
      const newItem: HistoryItem = {
        cli: cli.name, cliKey: cli.key, directory, args,
        timestamp: new Date().toLocaleString('pt-BR'),
      };
      const isDup = history[0] && history[0].cliKey === newItem.cliKey &&
        history[0].directory === newItem.directory && history[0].args === newItem.args;
      const newHistory = isDup ? history : [newItem, ...history.slice(0, 49)];
      setHistory(newHistory);
      saveConfig({ history: newHistory });
    } catch (e) { showToast(`Erro: ${String(e).slice(0,120)}`); }
  }

  async function relaunchFromHistory(item: HistoryItem) {
    try {
      await invoke('launch_cli', {
        cliKey: item.cliKey, directory: item.directory, args: item.args,
        noPerms: true, envVars: undefined,
      });
      if (item.directory) pushRecent(item.directory);
    } catch (e) { showToast(`Erro: ${String(e).slice(0,120)}`); }
  }

  function clearHistory() {
    if (confirm('Limpar todo o histórico?')) {
      setHistory([]);
      saveConfig({ history: [] });
    }
  }

  async function launchMulti() {
    if (multiSelected.length === 0) return;
    try {
      await invoke('launch_multi_clis', {
        cliKeys: multiSelected, directory, args, noPerms,
        envVars: undefined,
      });
      if (directory) pushRecent(directory);
    } catch (e) { showToast(`Erro: ${String(e).slice(0,120)}`); }
  }

  async function launchTool(toolKey: string) {
    try {
      await invoke('launch_tool', { toolKey });
      showToast(`Abrindo ${tools.find(t => t.key === toolKey)?.name || toolKey}`);
    } catch (e) { showToast(`Erro: ${String(e).slice(0,120)}`); }
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
    if (!confirm('Limpar TODAS as configurações (diretório, histórico, tema, welcome, API keys, log de instalação)?\n\nO app vai recarregar.')) return;
    try {
      await invoke('reset_all_config');
      localStorage.removeItem('ai-launcher-config');
      showToast('Configurações resetadas');
      setTimeout(() => window.location.reload(), 500);
    } catch (e) { showToast(`Erro: ${String(e).slice(0,120)}`); }
  }

  // ==================== RENDER ====================

  // Loading
  if (!bootReady) {
    return <div className="welcome-screen"><div className="welcome-box"><div className="spinner" /><p style={{marginTop:12}}>Carregando...</p></div></div>;
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
          <h1>{isFirstTime ? 'Bem-vindo ao' : ''} AI Launcher <span>Pro</span></h1>
          <p className="welcome-version">v{APP_VERSION}</p>
          <p className="welcome-brand">by Helbert Moura • Powered by DevManiac's</p>

          {isFirstTime && (
            <p className="welcome-note">
              <strong>Primeira vez aqui?</strong> Clique em "Validar Sistema" para o launcher detectar Node, Python, Git, Rust, CLIs instalados, etc. Leva poucos segundos e libera todas as funcionalidades.
            </p>
          )}

          {checkingEnv ? (
            <div className="welcome-loading"><div className="spinner" /><p>Validando sistema...</p></div>
          ) : envChecks.length > 0 ? (
            <div className="welcome-env">
              <div className="welcome-env-title">Ambiente Detectado</div>
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
                🚀 Continuar para o Launcher
              </button>
            </div>
          ) : (
            <>
              <button className="welcome-btn" onClick={() => { checkEnvironment(); checkInstalled(); }}>
                🔍 Validar Sistema
              </button>
              {!isFirstTime && (
                <button className="welcome-btn secondary" onClick={() => setWelcomeVisible(false)}>
                  ➜ Ir direto para o Launcher
                </button>
              )}
              {isFirstTime && (
                <button className="welcome-btn secondary" onClick={() => {
                  setHasChecked(true); setWelcomeVisible(false);
                  saveConfig({ hasChecked: true });
                }}>
                  Pular validação
                </button>
              )}
            </>
          )}

          <label className="welcome-checkbox">
            <input type="checkbox" checked={hideWelcome} onChange={e => {
              setHideWelcome(e.target.checked);
              saveConfig({ hideWelcome: e.target.checked });
            }} />
            <span>Não mostrar esta tela novamente (pode reativar em Ajuda)</span>
          </label>
        </div>
      </div>
    );
  }

  // ==================== MAIN APP ====================

  const selectedCliData = clis.find(c => c.key === selectedCli);
  const cliInfo = installed[selectedCli] || { installed: false, version: null };
  const notInstalledClis = clis.filter(c => !installed[c.key]?.installed);
  const installedClis = clis.filter(c => installed[c.key]?.installed);
  const currentInstallingLog = installingCli ? (installLog[installingCli] || []) : [];
  const updateCount = updatesSummary?.total_with_updates || 0;

  return (
    <div className={`app${isDragging ? ' dragging' : ''}`}>
      {showOnboarding && <Onboarding onClose={closeOnboarding} />}
      <header className="header">
        <div className="logo">
          <div className="logo-icon">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <rect width="24" height="24" rx="5" fill="#8B1E2A" />
              <path d="M7 7l-3 5 3 5M17 7l3 5-3 5" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
            </svg>
          </div>
          <div>
            <div className="logo-title">
              AI Launcher <span>Pro</span>
              <small className="logo-ver">v{APP_VERSION}</small>
              {/^\d+\.\d+\.\d+-(alpha|beta|rc)/i.test(APP_VERSION) && (
                <small className="logo-badge logo-badge-beta">BETA</small>
              )}
            </div>
            <div className="logo-sub">by Helbert Moura • Powered by DevManiac's</div>
          </div>
        </div>
        <div className="header-actions">
          <button className="theme-btn" onClick={() => { const t = theme === 'dark' ? 'light' : 'dark'; setTheme(t); saveConfig({ theme: t }); }} title="Alternar tema">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button className="btn" onClick={checkInstalled} title="Re-verificar CLIs (F5)">🔄</button>
        </div>
      </header>

      <div className="tabs">
        <div className={`tab ${activeTab === 'launcher' ? 'active' : ''}`} onClick={() => setActiveTab('launcher')}>⚡ Launcher</div>
        <div className={`tab ${activeTab === 'install' ? 'active' : ''}`} onClick={() => { setActiveTab('install'); if (envChecks.length === 0) checkEnvironment(); }}>📦 Instalar</div>
        <div className={`tab ${activeTab === 'tools' ? 'active' : ''}`} onClick={() => { setActiveTab('tools'); if (Object.keys(toolsChecked).length === 0) checkToolsInstalled(); }}>🛠️ Ferramentas</div>
        <div className={`tab ${activeTab === 'orchestrator' ? 'active' : ''}`} onClick={() => setActiveTab('orchestrator')}>🎛️ Orquestrador</div>
        <div className={`tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>📜 Histórico</div>
        <div className={`tab ${activeTab === 'updates' ? 'active' : ''}`} onClick={() => { setActiveTab('updates'); if (!updatesSummary) checkAllUpdates(false); }}>
          🔔 Atualizações
          {updateCount > 0 && <span className="tab-badge">{updateCount}</span>}
        </div>
        <div className={`tab ${activeTab === 'costs' ? 'active' : ''}`} onClick={() => setActiveTab('costs')}>💰 Custos</div>
        <div className={`tab ${activeTab === 'help' ? 'active' : ''}`} onClick={() => setActiveTab('help')}>❓ Ajuda</div>
      </div>

      {/* ========== LAUNCHER ========== */}
      {activeTab === 'launcher' && bootReady && hasChecked && installedClis.length === 0 && clis.length > 0 && (
        <div className="content">
          <div style={{ flex: 1 }}>
            <EmptyState onInstallClick={() => setActiveTab('install')} />
          </div>
        </div>
      )}
      {activeTab === 'launcher' && !(bootReady && hasChecked && installedClis.length === 0 && clis.length > 0) && (
        <div className="content">
          <div className="left-col">
            <div className="section">
              <div className="section-title">CLIs DE IA</div>
              <div className="cli-grid">
                {clis.map(cli => {
                  const info = installed[cli.key] || { installed: false, version: null };
                  const hasUpdate = updatesSummary?.cli_updates.find(u => {
                    const k = clis.find(c => c.name === u.cli)?.key;
                    return k === cli.key && u.has_update;
                  });
                  return (
                    <div
                      key={cli.key}
                      className={`cli-card ${selectedCli === cli.key ? 'selected' : ''} ${!info.installed ? 'not-installed' : ''}`}
                      style={{ '--c': CLI_COLORS[cli.key] || '#8B1E2A' } as React.CSSProperties}
                      onClick={() => setSelectedCli(cli.key)}
                    >
                      <div className="cli-icon-wrap">
                        <CliIcon cliKey={cli.key} size={40} />
                        {hasUpdate && <span className="cli-update-dot" />}
                      </div>
                      <div className="cli-name">{cli.name}</div>
                      <div className="cli-version">
                        {!hasChecked
                          ? <Skeleton width={60} height={10} />
                          : (info.version || (info.installed ? 'instalado' : 'não instalado'))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="section">
              <div className="section-title">MÚLTIPLOS CLIs</div>
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
              <div className="section-title">DIRETÓRIO</div>
              <div className="dir-row">
                <input ref={directoryInputRef} className="input" value={directory} onChange={e => setDirectory(e.target.value)} placeholder={`C:\\seu\\projeto (Ctrl+L para focar, ou arraste uma pasta)`} />
                <button className="btn btn-labeled" onClick={pickDir} title="Escolher pasta">
                  <span>📂</span><small>Escolher</small>
                </button>
                <button className="btn btn-labeled" onClick={async () => {
                  if (directory) {
                    try { await invoke('open_in_explorer', { path: directory }); }
                    catch (e) { showToast(`Erro: ${String(e).slice(0,120)}`); }
                  }
                }} title="Abrir no Explorer">
                  <span>📁</span><small>Explorar</small>
                </button>
              </div>
              {recentProjects.length > 0 && (
                <div className="recent-list">
                  {recentProjects.map(p => (
                    <span key={p} className="recent-pill" title={p}>
                      <button
                        className="recent-pill-main"
                        onClick={() => { setDirectory(p); saveConfig({ directory: p }); }}
                      >
                        📁 {basenameOf(p)}
                      </button>
                      <button
                        className="recent-pill-x"
                        onClick={() => removeRecent(p)}
                        title="Remover do histórico"
                        aria-label={`Remover ${basenameOf(p)}`}
                      >✕</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="section">
              <div className="section-title">ARGUMENTOS</div>
              <input className="input" placeholder="Ex: --verbose" value={args} onChange={e => setArgs(e.target.value)} />
            </div>

            <div className="section">
              <label className="checkbox">
                <input type="checkbox" checked={noPerms} onChange={e => setNoPerms(e.target.checked)} />
                <span>Sem pedir permissão</span>
              </label>
            </div>

            {selectedCliData && (
              <div className="cli-info" style={{ '--c': CLI_COLORS[selectedCli] || '#8B1E2A' } as React.CSSProperties}>
                <div className="cli-info-header">
                  <div className="cli-icon-lg"><CliIcon cliKey={selectedCli} size={48} /></div>
                  <div>
                    <div className="cli-info-name">{selectedCliData.name}</div>
                    <div className="cli-info-version">
                      {installed[selectedCli]?.version || 'não instalado'}
                    </div>
                  </div>
                </div>
                <div className="cli-info-flag">Flag: <code>{selectedCliData.flag || '(nenhuma)'}</code></div>
              </div>
            )}

            <div className="preview">
              <div className="preview-title">COMANDO</div>
              <code>{selectedCliData?.command} {args} {noPerms && selectedCliData?.flag}</code>
            </div>

            <button className="launch-btn" onClick={launch} disabled={!cliInfo.installed}>
              ▶ INICIAR {selectedCliData?.name?.toUpperCase()} <small style={{opacity:0.6, marginLeft:8}}>Ctrl+K</small>
            </button>

            {multiSelected.length > 0 && (
              <button className="launch-btn multi" onClick={launchMulti}>
                ▶▶ INICIAR {multiSelected.length} CLIs
              </button>
            )}
          </div>
        </div>
      )}

      {/* ========== INSTALL ========== */}
      {activeTab === 'install' && (
        <div className="tab-scroll">
          <div className="tab-pad">
          <div className="tab-section-header">
            <h2>📦 Instalar</h2>
            <p className="tab-section-sub">Gerencie pré-requisitos e CLIs de IA. Instalação silenciosa com log ao vivo.</p>
          </div>
          <div className="install-top-actions">
            <button className="btn" onClick={checkEnvironment} disabled={checkingEnv}>
              {checkingEnv ? <><span className="spinner-sm" /> <Skeleton width={84} height={10} /></> : '🔍 Re-verificar Pré-requisitos'}
            </button>
          </div>

          {envChecks.length > 0 && (
            <div className="prereq-section">
              <div className="prereq-title">Pré-requisitos do sistema</div>
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
                          <span className="installing-badge"><span className="spinner-sm" /> Instalando...</span>
                        ) : (
                          <button className="btn-prereq-install" disabled={!!installingCli} onClick={() => installPrerequisite(pKey)}>Instalar</button>
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
              <div className="install-highlight-title">⚠️ CLIs não instalados ({notInstalledClis.length})</div>
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
                        <span className="installing-badge"><span className="spinner-sm" /> Instalando...</span>
                      ) : (
                        <button className="btn-install" onClick={() => installCli(cli.key)} disabled={!!installingCli}>Instalar</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {installedClis.length > 0 && (
            <div className="install-section">
              <div className="install-section-title">✓ Instalados ({installedClis.length})</div>
              <div className="install-list">
                {installedClis.map(cli => {
                  const info = installed[cli.key];
                  return (
                    <div key={cli.key} className="install-item" style={{ borderLeftColor: CLI_COLORS[cli.key] || '#8B1E2A' }}>
                      <div className="install-icon"><CliIcon cliKey={cli.key} size={32} /></div>
                      <div className="install-info">
                        <div className="install-name">{cli.name}</div>
                        <div className="install-version">{info?.version || 'instalado'}</div>
                      </div>
                      <div className="install-action">
                        <span className="installed-badge">✓ Instalado</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {installingCli && currentInstallingLog.length > 0 && (
            <div className="install-log">
              <div className="install-log-title">Log de instalação — {installingCli}</div>
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
            <h2>🛠️ Ferramentas & IDEs</h2>
            <div className="tools-header-actions">
              <button className="btn" onClick={checkToolsInstalled} disabled={checkingTools}>
                {checkingTools ? <><span className="spinner-sm" /> <Skeleton width={60} height={10} /></> : '🔄 Re-verificar'}
              </button>
              {lastToolsCheck && <span className="last-check">Última: {lastToolsCheck}</span>}
            </div>
          </div>
          <div className="tools-grid">
            {tools.map(tool => {
              const info = toolsChecked[tool.key] || { installed: false, version: null };
              return (
                <div key={tool.key} className={`tool-card ${info.installed ? 'installed' : ''}`}>
                  <div className="tool-icon"><ToolIcon toolKey={tool.key} size={48} /></div>
                  <div className="tool-name">{tool.name}</div>
                  <div className="tool-status">{info.version || (info.installed ? 'Disponível' : 'Não instalado')}</div>
                  {info.installed ? (
                    <button className="tool-launch-btn" onClick={() => launchTool(tool.key)}>Abrir</button>
                  ) : (
                    <button className="tool-launch-btn install" onClick={() => installToolViaUrl(tool.key)}>Baixar</button>
                  )}
                </div>
              );
            })}
          </div>
          </div>
        </div>
      )}

      {/* ========== HISTORY ========== */}
      {activeTab === 'history' && (
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
      )}

      {/* ========== UPDATES (reformulado v3.2.1) ========== */}
      {activeTab === 'updates' && (
        <div className="tab-scroll">
          <div className="tab-pad">
          <div className="updates-global-header">
            <h2>🔔 Atualizações</h2>
            <div className="updates-global-actions">
              {updatesSummary && (
                <span className="updates-timestamp">
                  Última: {formatTimestamp(updatesSummary.checked_at)} · {updateCount} com update
                </span>
              )}
              <button className="btn" onClick={() => checkAllUpdates(false)} disabled={checkingAllUpdates}>
                {checkingAllUpdates ? <><span className="spinner-sm" /> <Skeleton width={72} height={10} /></> : '🔄 Verificar tudo'}
              </button>
              {updatesSummary && updatesSummary.cli_updates.some(u => u.has_update) && (
                <button className="btn btn-primary" onClick={updateAllClis} disabled={updatingAll || !!installingCli}>
                  {updatingAll ? <><span className="spinner-sm" /> Atualizando...</> : '⬆ Atualizar todos os CLIs'}
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
                  <span>🤖 CLIs de IA</span>
                  <span className="updates-section-counter">
                    {updatesSummary.cli_updates.filter(u => u.has_update).length} com update / {updatesSummary.cli_updates.length}
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
                            <span className="update-current">Atual: {u.current || '— (não instalado)'}</span>
                            {u.has_update && (<><span className="update-sep">→</span><span className="update-latest">{u.latest}</span></>)}
                            {!u.has_update && u.current && <span className="badge-uptodate-inline">✓</span>}
                          </div>
                        </div>
                        <div className="update-action">
                          {u.has_update ? (
                            <button className="btn-update" onClick={() => updateCli(cliKey)} disabled={isUpdating || !!installingCli}>
                              {isUpdating ? <><span className="spinner-sm" /> ...</> : '⬆ Atualizar'}
                            </button>
                          ) : !u.current ? (
                            <span className="badge-neutral">? não instalado</span>
                          ) : (
                            <span className="badge-uptodate">✓ Atualizado</span>
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
                  <span>⚙️ Pré-requisitos</span>
                  <span className="updates-section-counter">
                    {updatesSummary.env_updates.filter(u => u.has_update).length} com update / {updatesSummary.env_updates.length}
                  </span>
                </summary>
                <div className="updates-list">
                  {updatesSummary.env_updates.length === 0 ? (
                    <p className="empty-inline">Nenhum pré-requisito detectado.</p>
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
                            <span className="update-current">Atual: {u.current || '—'}</span>
                            {u.latest && (<><span className="update-sep">→</span><span className="update-latest">{u.latest}</span></>)}
                          </div>
                        </div>
                        <div className="update-action">
                          {u.has_update && isNpm ? (
                            <button
                              className="btn-update"
                              onClick={() => updatePrereq(prereqKey, 'npm')}
                              disabled={isUpdatingThis || !!installingCli}
                              title="Atualizar via npm global"
                              aria-label={`Atualizar ${u.cli}`}
                            >
                              {isUpdatingThis ? <><span className="spinner-sm" /> ...</> : '⬆ Atualizar'}
                            </button>
                          ) : u.has_update ? (
                            <button
                              className="btn btn-ghost"
                              onClick={() => updatePrereq(prereqKey, effectiveMethod)}
                              disabled={isUpdatingThis}
                              title="Abre a página oficial de download"
                              aria-label={`Abrir página de download de ${u.cli}`}
                            >
                              {isUpdatingThis ? <><span className="spinner-sm" /> abrindo...</> : '🌐 Abrir página'}
                            </button>
                          ) : u.latest ? (
                            <span className="badge-uptodate" title="Você está na versão mais recente">✓</span>
                          ) : (
                            <span className="badge-neutral" title="Sem API pública para comparar versão">? sem comparação</span>
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

      {activeTab === 'costs' && <CostAggregator />}

      {/* ========== HELP (reformulado v3.2.1 sem sidebar) ========== */}
      {activeTab === 'help' && (
        <div className="tab-scroll">
          <div className="tab-pad help-v2">
          <div className="help-v2-content">
            <div className="tab-section-header">
              <h2>❓ Ajuda & FAQ</h2>
              <p className="tab-section-sub">Tudo que você precisa saber para usar o AI Launcher Pro.</p>
            </div>

            <section id="help-intro">
              <h3>O que é o AI Launcher Pro?</h3>
              <p>Hub centralizado para gerenciar, instalar, atualizar e lançar CLIs de IA (Claude, Codex, Gemini, Qwen, Kilo, OpenCode, Crush, Factory Droid) e ferramentas de desenvolvimento (VS Code, Cursor, Windsurf, AntGravity). Tudo num único lugar, sem terminal piscando, com progress ao vivo.</p>
            </section>

            <section id="help-install">
              <h3>Como instalar um CLI</h3>
              <p>Aba <strong>📦 Instalar</strong> → seção <strong>"CLIs não instalados"</strong> → clique em <strong>"Instalar"</strong>. A instalação é silenciosa em background, com log ao vivo exibido abaixo. Pré-requisitos ausentes (Node, Git, Python, etc.) têm botão de instalação próprio.</p>
              <p><strong>Factory Droid</strong>: usa o script oficial (<code>irm https://app.factory.ai/cli/windows | iex</code>), nativo Windows. Ao clicar em Instalar, o launcher executa o script via PowerShell em background.</p>
            </section>

            <section id="help-launch">
              <h3>Como lançar um CLI</h3>
              <ol>
                <li>Aba <strong>⚡ Launcher</strong> → clique no card do CLI desejado</li>
                <li>Escolha o diretório (<kbd>Ctrl+L</kbd> foca o campo)</li>
                <li>Adicione argumentos opcionais (caracteres proibidos: <code>; & | ` $ &gt; &lt;</code>)</li>
                <li>Clique <strong>INICIAR</strong> (ou <kbd>Ctrl+K</kbd>). Abre em Windows Terminal se disponível, senão PowerShell, senão cmd.</li>
              </ol>
              <p>Para lançar <strong>múltiplos</strong>, marque checkboxes na seção "Múltiplos CLIs" e clique no segundo botão.</p>
            </section>

            <section id="help-updates">
              <h3>Verificar atualizações</h3>
              <p>Aba <strong>🔔 Atualizações</strong> → botão <strong>"Verificar tudo"</strong>. Consulta em paralelo:</p>
              <ul>
                <li><strong>CLIs</strong>: compara versão local vs npm registry</li>
                <li><strong>Pré-requisitos</strong>: versão local + latest de pacotes npm (pnpm, yarn, tauri)</li>
              </ul>
              <p><small>Nota: updates de IDE (VS Code / Cursor / Windsurf) foram removidos — faça direto na IDE.</small></p>
              <p>Quando houver múltiplos updates de CLI, use <strong>"Atualizar todos"</strong> para aplicar em lote.</p>
            </section>

            <section id="help-shortcuts">
              <h3>Atalhos de teclado</h3>
              <table className="shortcut-table">
                <tbody>
                  <tr><td><kbd>F5</kbd></td><td>Re-verificar CLIs instalados</td></tr>
                  <tr><td><kbd>Ctrl</kbd>+<kbd>L</kbd></td><td>Focar campo de diretório (Launcher)</td></tr>
                  <tr><td><kbd>Ctrl</kbd>+<kbd>K</kbd></td><td>Iniciar CLI selecionado (Launcher)</td></tr>
                </tbody>
              </table>
            </section>

            <section id="help-security">
              <h3>Segurança & alertas de vírus</h3>
              <p>Se o Windows Defender ou SmartScreen sinalizar o app: é falso-positivo típico de binários novos. O app é assinado com um cert self-signed (DevManiacs). Para eliminar o alerta nesta máquina, o cert já foi instalado no Trusted Root. Em outras máquinas, o usuário precisa importar o <code>.cer</code> manualmente, OU o autor precisa comprar cert real (Sectigo, DigiCert, SSL.com ou Azure Trusted Signing).</p>
              <p>Todo install/update agora roda via <code>tokio::process</code> direto, sem <code>cmd /C</code> intermediário — isso elimina a heurística "processo oculto → cmd invisível → baixa da internet" que disparava o Defender.</p>
            </section>

            <section id="help-troubleshoot">
              <h3>Solução de problemas</h3>
              <details><summary>Um CLI aparece como "detectado" mas sem versão</summary>
                <p>O binário existe no PATH mas o comando <code>--version</code> retornou output não parseável. Geralmente é benigno — o CLI funciona. Tente rodar o comando manualmente no terminal para confirmar.</p>
              </details>
              <details><summary>Instalação trava ou falha</summary>
                <p>Veja o log ao vivo na aba Instalar (painel embaixo). Log persistente em <code>%APPDATA%/ai-launcher/install.log</code>. Causas comuns: falta de permissão pro npm global, proxy corporativo, Defender bloqueando npm.</p>
              </details>
              <details><summary>"Diretório não existe" ao lançar</summary>
                <p>O caminho digitado não existe no disco ou foi deletado. Use o botão 📂 Escolher para selecionar uma pasta válida.</p>
              </details>
            </section>

            <section id="help-welcome">
              <h3>Tela de boas-vindas</h3>
              <p>A tela aparece sempre que você abre o app, a menos que você marque "Não mostrar esta tela novamente" nela. Você pode reativar a qualquer momento:</p>
              <button className="btn" onClick={() => {
                setHideWelcome(false);
                saveConfig({ hideWelcome: false });
                showToast('Welcome será mostrada na próxima abertura');
              }} disabled={!hideWelcome}>
                {hideWelcome ? '👋 Reativar welcome na próxima abertura' : '✓ Welcome já está ativa'}
              </button>
              <button className="btn" style={{marginLeft: 8}} onClick={() => setWelcomeVisible(true)}>
                ↺ Voltar para welcome agora
              </button>
            </section>

            <section id="help-tray">
              <h3>🖥️ System Tray & Atalho global</h3>
              <p>O app fica com um ícone ao lado do relógio. Clique esquerdo abre/foca a janela; clique direito mostra menu com lançamento rápido de CLIs e acesso às abas.</p>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0' }}>
                <input
                  type="checkbox"
                  checked={minimizeToTray}
                  onChange={(e) => toggleMinimizeToTray(e.target.checked)}
                />
                <span>Minimizar para a bandeja ao fechar (em vez de sair)</span>
              </label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                <label style={{ minWidth: 160 }}>Atalho global (abrir/fechar):</label>
                <input
                  className="input"
                  style={{ flex: 1, minWidth: 220 }}
                  type="text"
                  value={trayHotkey}
                  onChange={(e) => setTrayHotkey(e.target.value)}
                  onBlur={saveTrayHotkey}
                  placeholder="CommandOrControl+Alt+Space"
                />
                <button className="btn" onClick={resetTrayHotkey}>↺ Reset</button>
              </div>
              <p className="help-text" style={{ marginTop: 6, opacity: 0.75, fontSize: '0.85em' }}>
                Formato: modificadores separados por <code>+</code>. Ex: <code>CommandOrControl+Shift+L</code>, <code>Alt+F1</code>. Conflitos com outros apps (Raycast, AutoHotkey) podem impedir registro — escolha outra combinação se acontecer.
              </p>
            </section>

            <section id="help-onboarding">
              <h3>🎓 Onboarding</h3>
              <p>Reveja o tour de boas-vindas com atalhos e instalação guiada.</p>
              <button className="btn" onClick={reopenOnboarding}>↺ Reabrir onboarding</button>
            </section>

            <section id="help-reset">
              <h3>Resetar todas as configurações</h3>
              <p>Remove: diretório salvo, histórico, tema, preferência de welcome, log de instalação. O app recarrega.</p>
              <button className="btn btn-danger" onClick={resetAllConfig}>🗑️ Resetar tudo</button>
            </section>

            <section id="help-support">
              <h3>Suporte & contato</h3>
              <p>Desenvolvido por <strong>Helbert Moura</strong>. Marca <strong>DevManiac's</strong>.</p>
              <p>Versão atual: <strong>v{APP_VERSION}</strong>.</p>
            </section>
          </div>
          </div>
        </div>
      )}

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
              await invoke('launch_cli', {
                cliKey: key, directory, args, noPerms,
                envVars: undefined,
              });
              if (directory) pushRecent(directory);
              const newItem: HistoryItem = {
                cli: cli.name, cliKey: cli.key, directory, args,
                timestamp: new Date().toLocaleString('pt-BR'),
              };
              const isDup = history[0] && history[0].cliKey === newItem.cliKey &&
                history[0].directory === newItem.directory && history[0].args === newItem.args;
              const newHistory = isDup ? history : [newItem, ...history.slice(0, 49)];
              setHistory(newHistory);
              saveConfig({ history: newHistory });
            } catch (e) { showToast(`Erro: ${String(e).slice(0,120)}`); }
          })();
        }}
        onLaunchTool={(key) => { launchTool(key); }}
        onOpenTab={setActiveTab}
        onToggleTheme={() => {
          const t = theme === 'dark' ? 'light' : 'dark';
          setTheme(t);
          saveConfig({ theme: t });
        }}
        onReloadStatus={checkInstalled}
        onUpdateAll={updateAllClis}
      />

      <footer className="footer">
        <span>✓ {clis.filter(c => installed[c.key]?.installed).length}/{clis.length} CLIs{updateCount > 0 && <span className="footer-updates"> · {updateCount} atualização(ões)</span>}</span>
        <span>by <span>Helbert Moura</span> • Powered by DevManiac's</span>
      </footer>
    </div>
  );
}

export default App;
