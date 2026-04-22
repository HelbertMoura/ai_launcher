// ==============================================================================
// AI Launcher Pro - Custom IDEs (v7.0)
// Storage + validation for user-defined IDE entries persisted in localStorage.
// Mirrors customClis.ts for API parity. Additive feature — does not alter
// existing tools/provider surfaces.
// ==============================================================================

export interface CustomIde {
  key: string;              // slug — lowercase letters/numbers/dashes
  name: string;             // display name (e.g. "Zed", "IntelliJ IDEA")
  detectCmd: string;        // e.g. "zed --version"
  launchCmd: string;        // e.g. "zed <dir>" — <dir> is a literal placeholder token
  docsUrl?: string;
  iconEmoji?: string;       // optional emoji/text icon; fallback to ▶
  iconDataUrl?: string;     // optional uploaded icon; wins over emoji
  createdAt: number;        // ms since epoch
}

const STORAGE_KEY = 'ai-launcher:custom-ides';

// Same-tab sync bus. Mirrors customClis.ts semantics.
export const CUSTOM_IDES_CHANGED_EVENT = 'ai-launcher:custom-ides-changed';

export function loadCustomIdes(): CustomIde[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is CustomIde => {
      return typeof item === 'object' && item !== null
        && typeof item.key === 'string' && typeof item.name === 'string'
        && typeof item.detectCmd === 'string' && typeof item.launchCmd === 'string';
    });
  } catch {
    return [];
  }
}

export function saveCustomIdes(ides: CustomIde[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ides));
    try {
      window.dispatchEvent(new CustomEvent(CUSTOM_IDES_CHANGED_EVENT, { detail: ides }));
    } catch {
      /* ignore */
    }
  } catch (e) {
    console.error('[customIdes] save failed', e);
  }
}

export function addCustomIde(ides: CustomIde[], ide: CustomIde): CustomIde[] {
  const idx = ides.findIndex(i => i.key === ide.key);
  if (idx >= 0) {
    const next = [...ides];
    next[idx] = ide;
    return next;
  }
  return [...ides, ide];
}

export function removeCustomIde(ides: CustomIde[], key: string): CustomIde[] {
  return ides.filter(i => i.key !== key);
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; field: keyof CustomIde; messageKey: string };

export function validateCustomIde(
  input: Partial<CustomIde>,
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
  if (!input.detectCmd || !input.detectCmd.trim()) {
    return { ok: false, field: 'detectCmd', messageKey: 'customCli.validation.installCmdRequired' };
  }
  return { ok: true };
}
