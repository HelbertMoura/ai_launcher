export type TabId =
  | "launcher"
  | "tools"
  | "mcp"
  | "history"
  | "costs"
  | "workspace"
  | "doctor"
  | "updates"
  | "prereqs"
  | "admin"
  | "help";

export const TAB_ORDER: TabId[] = ["launcher", "tools", "mcp", "history", "costs", "workspace", "doctor", "updates", "prereqs", "admin", "help"];

export const TAB_LABELS: Record<TabId, string> = {
  launcher: "Launch",
  tools: "Tools",
  mcp: "MCP",
  history: "History",
  costs: "Costs",
  workspace: "Workspace",
  doctor: "Doctor",
  updates: "Updates",
  prereqs: "Prereqs",
  admin: "Admin",
  help: "Help",
};

/** i18n keys for each tab (used by Sidebar + CommandPalette). */
export const TAB_I18N_KEYS: Record<TabId, string> = {
  launcher: "nav.launcher",
  tools: "nav.tools",
  mcp: "nav.mcp",
  history: "nav.history",
  costs: "nav.costs",
  workspace: "nav.workspace",
  doctor: "nav.doctor",
  updates: "nav.updates",
  prereqs: "nav.prereqs",
  admin: "nav.admin",
  help: "nav.help",
};

const MOD = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform)
  ? "⌘"
  : "Ctrl";

export const TAB_KEYS: Record<TabId, string> = {
  launcher: `${MOD}+1`,
  tools: `${MOD}+2`,
  mcp: `${MOD}+3`,
  history: `${MOD}+4`,
  costs: `${MOD}+5`,
  workspace: `${MOD}+6`,
  doctor: `${MOD}+7`,
  updates: `${MOD}+8`,
  prereqs: `${MOD}+9`,
  admin: `${MOD}+,`,
  help: "?",
};
