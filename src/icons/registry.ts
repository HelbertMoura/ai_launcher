export function getCliIcon(key: string): string {
  return `/icons/cli/${key}.svg`;
}

export function getToolIcon(key: string): string {
  return `/icons/tool/${key}.svg`;
}

const CLI_KEYS = new Set([
  "claude",
  "codex",
  "gemini",
  "qwen",
  "crush",
  "droid",
  "kilocode",
  "opencode",
]);

export function hasCliIcon(key: string): boolean {
  return CLI_KEYS.has(key);
}

const TOOL_KEYS = new Set([
  "vscode",
  "cursor",
  "windsurf",
  "antgravity",
  "jetbrains-ai",
]);

export function hasToolIcon(key: string): boolean {
  return TOOL_KEYS.has(key);
}
