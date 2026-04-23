import { getCliIcon, getToolIcon, hasCliIcon, hasToolIcon } from "../icons/registry";

export type BuiltinIconKind = "cli" | "tool";

export interface BuiltinIconDefinition {
  key: string;
  kind: BuiltinIconKind;
  assetPath: string;
}

const CLI_KEYS = ["claude", "codex", "gemini", "qwen", "kilocode", "opencode", "crush", "droid"];
const TOOL_KEYS = ["vscode", "cursor", "windsurf", "antgravity", "jetbrains-ai"];

const BUILTIN_ICONS: readonly BuiltinIconDefinition[] = [
  ...CLI_KEYS.map((key) => ({ key, kind: "cli" as const, assetPath: getCliIcon(key) })),
  ...TOOL_KEYS.map((key) => ({ key, kind: "tool" as const, assetPath: getToolIcon(key) })),
];

export function getBuiltinIconAsset(kind: BuiltinIconKind, key: string): string | null {
  return BUILTIN_ICONS.find((item) => item.kind === kind && item.key === key)?.assetPath ?? null;
}

export { getCliIcon, getToolIcon, hasCliIcon, hasToolIcon };
