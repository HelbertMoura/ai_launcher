const KEY = (cliKey: string): string => `ai-launcher:pinned-dirs:${cliKey}`;
const MAX_PINS = 3;

function readPins(cliKey: string): string[] {
  try {
    const raw = localStorage.getItem(KEY(cliKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]).filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writePins(cliKey: string, pins: string[]): void {
  try {
    localStorage.setItem(KEY(cliKey), JSON.stringify(pins));
  } catch {
    /* ignore quota */
  }
}

export function getPinnedDirs(cliKey: string): string[] {
  return readPins(cliKey);
}

export function pinDir(cliKey: string, dir: string): boolean {
  const pins = readPins(cliKey);
  if (pins.includes(dir)) return false;
  if (pins.length >= MAX_PINS) return false;
  writePins(cliKey, [...pins, dir]);
  return true;
}

export function unpinDir(cliKey: string, dir: string): void {
  const pins = readPins(cliKey).filter((d) => d !== dir);
  writePins(cliKey, pins);
}

export function isPinned(cliKey: string, dir: string): boolean {
  return readPins(cliKey).includes(dir);
}

export { MAX_PINS };
