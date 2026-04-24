// ==============================================================================
// AI Launcher Pro - Runbook Store
// CRUD operations for agent runbooks. Persisted in localStorage.
// ==============================================================================

import type { Runbook, RunbookStep } from '../../domain/types';

const STORAGE_KEY = 'ai-launcher:v15:runbooks';

// --- Storage -----------------------------------------------------------------

interface RunbookStore {
  runbooks: Runbook[];
}

function loadStore(): RunbookStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { runbooks: [] };
    const parsed = JSON.parse(raw) as Partial<RunbookStore>;
    return { runbooks: Array.isArray(parsed.runbooks) ? parsed.runbooks : [] };
  } catch {
    return { runbooks: [] };
  }
}

function saveStore(store: RunbookStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    console.error('[runbooks] failed to save', e);
  }
}

// --- Helpers -----------------------------------------------------------------

function generateId(): string {
  return `rb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function generateStepId(): string {
  return `step-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isoNow(): string {
  return new Date().toISOString();
}

// --- CRUD --------------------------------------------------------------------

export function getRunbooks(): Runbook[] {
  return loadStore().runbooks;
}

export function getRunbook(id: string): Runbook | undefined {
  return loadStore().runbooks.find((r) => r.id === id);
}

export function createRunbook(partial?: Partial<Pick<Runbook, 'name' | 'description' | 'tags' | 'steps'>>): Runbook {
  const store = loadStore();
  const now = isoNow();
  const runbook: Runbook = {
    id: generateId(),
    name: partial?.name ?? 'Untitled Runbook',
    description: partial?.description,
    steps: partial?.steps ?? [],
    tags: partial?.tags ?? [],
    createdAt: now,
    updatedAt: now,
  };
  store.runbooks = [...store.runbooks, runbook];
  saveStore(store);
  return runbook;
}

export function updateRunbook(id: string, patch: Partial<Pick<Runbook, 'name' | 'description' | 'tags' | 'steps'>>): Runbook | null {
  const store = loadStore();
  const idx = store.runbooks.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  const existing = store.runbooks[idx];
  const updated: Runbook = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: isoNow(),
  };
  store.runbooks = store.runbooks.map((r, i) => (i === idx ? updated : r));
  saveStore(store);
  return updated;
}

export function deleteRunbook(id: string): boolean {
  const store = loadStore();
  const before = store.runbooks.length;
  store.runbooks = store.runbooks.filter((r) => r.id !== id);
  if (store.runbooks.length === before) return false;
  saveStore(store);
  return true;
}

// --- Steps -------------------------------------------------------------------

export function addStep(runbookId: string, partial?: Partial<RunbookStep>): Runbook | null {
  const store = loadStore();
  const idx = store.runbooks.findIndex((r) => r.id === runbookId);
  if (idx < 0) return null;
  const existing = store.runbooks[idx];
  const step: RunbookStep = {
    id: generateStepId(),
    label: partial?.label ?? 'New Step',
    type: partial?.type ?? 'check',
    command: partial?.command,
    toolKey: partial?.toolKey,
    cliKey: partial?.cliKey,
    auto: partial?.auto ?? false,
  };
  const updated: Runbook = {
    ...existing,
    steps: [...existing.steps, step],
    updatedAt: isoNow(),
  };
  store.runbooks = store.runbooks.map((r, i) => (i === idx ? updated : r));
  saveStore(store);
  return updated;
}

export function updateStep(runbookId: string, stepId: string, patch: Partial<RunbookStep>): Runbook | null {
  const store = loadStore();
  const idx = store.runbooks.findIndex((r) => r.id === runbookId);
  if (idx < 0) return null;
  const existing = store.runbooks[idx];
  const steps = existing.steps.map((s) =>
    s.id === stepId ? { ...s, ...patch, id: s.id } : s,
  );
  const updated: Runbook = {
    ...existing,
    steps,
    updatedAt: isoNow(),
  };
  store.runbooks = store.runbooks.map((r, i) => (i === idx ? updated : r));
  saveStore(store);
  return updated;
}

export function removeStep(runbookId: string, stepId: string): Runbook | null {
  const store = loadStore();
  const idx = store.runbooks.findIndex((r) => r.id === runbookId);
  if (idx < 0) return null;
  const existing = store.runbooks[idx];
  const updated: Runbook = {
    ...existing,
    steps: existing.steps.filter((s) => s.id !== stepId),
    updatedAt: isoNow(),
  };
  store.runbooks = store.runbooks.map((r, i) => (i === idx ? updated : r));
  saveStore(store);
  return updated;
}

export function moveStep(runbookId: string, stepId: string, direction: 'up' | 'down'): Runbook | null {
  const store = loadStore();
  const idx = store.runbooks.findIndex((r) => r.id === runbookId);
  if (idx < 0) return null;
  const existing = store.runbooks[idx];
  const steps = [...existing.steps];
  const currentIdx = steps.findIndex((s) => s.id === stepId);
  if (currentIdx < 0) return null;
  const targetIdx = direction === 'up' ? currentIdx - 1 : currentIdx + 1;
  if (targetIdx < 0 || targetIdx >= steps.length) return null;
  const temp = steps[currentIdx];
  steps[currentIdx] = steps[targetIdx];
  steps[targetIdx] = temp;
  const updated: Runbook = {
    ...existing,
    steps,
    updatedAt: isoNow(),
  };
  store.runbooks = store.runbooks.map((r, i) => (i === idx ? updated : r));
  saveStore(store);
  return updated;
}

// --- Import/Export -----------------------------------------------------------

export function exportRunbook(runbook: Runbook): string {
  return JSON.stringify(
    {
      version: 1,
      runbook: {
        name: runbook.name,
        description: runbook.description,
        steps: runbook.steps.map((s) => ({
          label: s.label,
          type: s.type,
          command: s.command,
          toolKey: s.toolKey,
          cliKey: s.cliKey,
          auto: s.auto,
        })),
        tags: runbook.tags,
      },
    },
    null,
    2,
  );
}

interface ImportedRunbookJson {
  version?: number;
  runbook?: {
    name?: string;
    description?: string;
    steps?: Partial<RunbookStep>[];
    tags?: string[];
  };
}

export function importRunbook(raw: string): Runbook {
  const parsed = JSON.parse(raw) as ImportedRunbookJson;
  if (!parsed.runbook || !Array.isArray(parsed.runbook.steps)) {
    throw new Error('Invalid runbook JSON: missing "runbook.steps" array.');
  }
  const steps: RunbookStep[] = parsed.runbook.steps.map((s, i) => ({
    id: generateStepId(),
    label: s.label ?? `Step ${i + 1}`,
    type: s.type ?? 'check',
    command: s.command,
    toolKey: s.toolKey,
    cliKey: s.cliKey,
    auto: s.auto ?? false,
  }));
  return createRunbook({
    name: parsed.runbook.name ?? 'Imported Runbook',
    description: parsed.runbook.description,
    tags: parsed.runbook.tags,
    steps,
  });
}
