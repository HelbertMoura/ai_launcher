// ==============================================================================

import { readKey, writeKey } from './storage';
// AI Launcher Pro - Custom CLIs (v7.0)
// Storage + validation for user-defined CLI entries persisted in localStorage.
// Additive feature — does not alter existing provider/config surfaces.
// ==============================================================================

export interface CustomCli {
  key: string;              // slug — lowercase letters/numbers/dashes
  name: string;             // display name
  installCmd: string;       // e.g. "npm install -g my-cli"
  versionCmd: string;       // e.g. "my-cli --version"
  launchArgs?: string;      // optional default args
  docsUrl?: string;
  iconEmoji?: string;       // optional emoji/text icon; fallback to ▶
  iconDataUrl?: string;     // optional uploaded icon; wins over emoji
  createdAt: number;        // ms since epoch
}

// Same-tab sync bus. Consumers (App.tsx, LauncherTab) subscribe to react to
// AdminPanel edits without requiring a reload.
export const CUSTOM_CLIS_CHANGED_EVENT = 'ai-launcher:custom-clis-changed';

export function loadCustomClis(): CustomCli[] {
  return readKey('customClis') as CustomCli[];
}

export function saveCustomClis(clis: CustomCli[]): void {
  if (writeKey('customClis', clis)) {
    try {
      window.dispatchEvent(new CustomEvent(CUSTOM_CLIS_CHANGED_EVENT, { detail: clis }));
    } catch {
      /* ignore */
    }
  }
}

export function addCustomCli(clis: CustomCli[], cli: CustomCli): CustomCli[] {
  const idx = clis.findIndex(c => c.key === cli.key);
  if (idx >= 0) {
    const next = [...clis];
    next[idx] = cli;
    return next;
  }
  return [...clis, cli];
}

export function removeCustomCli(clis: CustomCli[], key: string): CustomCli[] {
  return clis.filter(c => c.key !== key);
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; field: keyof CustomCli; messageKey: string };

export function validateCustomCli(
  input: Partial<CustomCli>,
  existingKeys: string[],
  originalKey?: string
): ValidationResult {
  if (!input.name || !input.name.trim()) {
    return { ok: false, field: 'name', messageKey: 'customCli.validation.nameRequired' };
  }
  if (!input.key || !input.key.trim()) {
    return { ok: false, field: 'key', messageKey: 'customCli.validation.keyRequired' };
  }
  if (!/^[a-z0-9-]+$/.test(input.key)) {
    return { ok: false, field: 'key', messageKey: 'customCli.validation.keyInvalid' };
  }
  if (input.key !== originalKey && existingKeys.includes(input.key)) {
    return { ok: false, field: 'key', messageKey: 'customCli.validation.keyDuplicate' };
  }
  if (!input.installCmd || !input.installCmd.trim()) {
    return { ok: false, field: 'installCmd', messageKey: 'customCli.validation.installCmdRequired' };
  }
  return { ok: true };
}
