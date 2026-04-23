export interface HistoryItem {
  cli: string;
  cliKey: string;
  directory: string;
  args: string;
  timestamp: string;
  providerId?: string;
}

const CONFIG_KEY = "ai-launcher-config";

function readConfig(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function writeConfig(cfg: Record<string, unknown>): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  } catch {
    /* quota or private mode — ignore */
  }
}

export function appendHistory(item: HistoryItem): void {
  const cfg = readConfig();
  const list = Array.isArray(cfg.history) ? (cfg.history as HistoryItem[]) : [];
  const prev = list[0];
  if (prev && prev.cliKey === item.cliKey && prev.directory === item.directory && prev.args === item.args) {
    const dt = Date.parse(item.timestamp) - Date.parse(prev.timestamp);
    if (!Number.isNaN(dt) && Math.abs(dt) < 5000) return;
  }
  cfg.history = [item, ...list].slice(0, 200);
  writeConfig(cfg);
}
