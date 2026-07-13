import type { SessionStatus } from "../history/useHistory";
import { readKey, writeKey } from "../../lib/storage";

export interface HistoryItem {
  cli: string;
  cliKey: string;
  directory: string;
  args: string;
  timestamp: string;
  providerId?: string;
  status?: SessionStatus;
  sessionId?: string;
  startedAt?: string;
  errorMessage?: string;
}

function readConfig(): Record<string, unknown> {
  return readKey("config");
}

function writeConfig(cfg: Record<string, unknown>): void {
  writeKey("config", cfg);
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
