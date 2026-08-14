const CLI_PNG = new Set(["claude", "codex", "qwen"]);

export function getCliIcon(key: string): string {
  if (CLI_PNG.has(key)) return `/icons/cli/${key}.png`;
  return `/icons/cli/${key}.svg`;
}

export function getToolIcon(key: string): string {
  return `/icons/tool/${key}.svg`;
}

const CLI_KEYS = new Set([
  "claude",
  "codex",
  "antigravity",
  "aider",
  "goose",
  "cline",
  "roocode",
  "continue",
  "cody",
  "copilot",
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
  "jetbrains-ai",
  "antigravity",
]);

export function hasToolIcon(key: string): boolean {
  return TOOL_KEYS.has(key);
}
