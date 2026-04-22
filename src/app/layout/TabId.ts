export type TabId =
  | "launcher"
  | "tools"
  | "history"
  | "costs"
  | "admin"
  | "help";

export const TAB_ORDER: TabId[] = ["launcher", "tools", "history", "costs", "admin", "help"];

export const TAB_LABELS: Record<TabId, string> = {
  launcher: "Launch",
  tools: "Tools",
  history: "History",
  costs: "Costs",
  admin: "Admin",
  help: "Help",
};

const MOD = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform)
  ? "⌘"
  : "Ctrl";

export const TAB_KEYS: Record<TabId, string> = {
  launcher: `${MOD}+1`,
  tools: `${MOD}+2`,
  history: `${MOD}+3`,
  costs: `${MOD}+4`,
  admin: `${MOD}+,`,
  help: "?",
};
