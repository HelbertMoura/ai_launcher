export interface SessionTemplate {
  id: string;
  name: string;
  cliKey: string;
  cliName: string;
  directory: string;
  args: string;
  noPerms: boolean;
  providerId: string | null;
  createdAt: string;
}

const KEY = "ai-launcher:session-templates";

function readAll(): SessionTemplate[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SessionTemplate[]) : [];
  } catch {
    return [];
  }
}

function writeAll(items: SessionTemplate[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

export function getTemplates(): SessionTemplate[] {
  return readAll();
}

export function getTemplatesForCli(cliKey: string): SessionTemplate[] {
  return readAll().filter((t) => t.cliKey === cliKey);
}

export function saveTemplate(
  input: Omit<SessionTemplate, "id" | "createdAt">,
): SessionTemplate {
  const full: SessionTemplate = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  writeAll([full, ...readAll()]);
  return full;
}

export function deleteTemplate(id: string): void {
  writeAll(readAll().filter((t) => t.id !== id));
}
