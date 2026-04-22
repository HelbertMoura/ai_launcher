export type BuiltinIconKind = 'cli' | 'tool';

export interface BuiltinIconDefinition {
  key: string;
  kind: BuiltinIconKind;
  assetPath: string;
}

const BUILTIN_ICONS: readonly BuiltinIconDefinition[] = [
  { key: 'claude', kind: 'cli', assetPath: '/icons/cli/claude.svg' },
  { key: 'codex', kind: 'cli', assetPath: '/icons/cli/codex.svg' },
  { key: 'gemini', kind: 'cli', assetPath: '/icons/cli/gemini.svg' },
  { key: 'qwen', kind: 'cli', assetPath: '/icons/cli/qwen.svg' },
  { key: 'kilocode', kind: 'cli', assetPath: '/icons/cli/kilo.svg' },
  { key: 'opencode', kind: 'cli', assetPath: '/icons/cli/opencode.svg' },
  { key: 'crush', kind: 'cli', assetPath: '/icons/cli/crush.svg' },
  { key: 'droid', kind: 'cli', assetPath: '/icons/cli/droid.svg' },
  { key: 'cursor', kind: 'tool', assetPath: '/icons/tool/cursor.svg' },
  { key: 'vscode', kind: 'tool', assetPath: '/icons/tool/vscode.svg' },
  { key: 'windsurf', kind: 'tool', assetPath: '/icons/tool/windsurf.svg' },
  { key: 'antgravity', kind: 'tool', assetPath: '/icons/tool/antgravity.svg' },
] as const;

export function getBuiltinIconAsset(kind: BuiltinIconKind, key: string): string | null {
  return BUILTIN_ICONS.find((item) => item.kind === kind && item.key === key)?.assetPath ?? null;
}
