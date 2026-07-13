import { z } from "zod";
import { readScoped, writeScoped } from "../../lib/storage";

const KEY = (cliKey: string): string => `ai-launcher:pinned-dirs:${cliKey}`;
const MAX_PINS = 3;
const pinsSchema = z.array(z.string());

function readPins(cliKey: string): string[] {
  return readScoped(KEY(cliKey), pinsSchema, []);
}

function writePins(cliKey: string, pins: string[]): void {
  writeScoped(KEY(cliKey), pinsSchema, pins);
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
