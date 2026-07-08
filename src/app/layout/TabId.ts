export type TabId =
  | "command-center"
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

export const TAB_ORDER: TabId[] = ["command-center", "launcher", "tools", "mcp", "history", "costs", "workspace", "doctor", "updates", "prereqs", "admin", "help"];

export const TAB_LABELS: Record<TabId, string> = {
  "command-center": "Command Center",
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
  "command-center": "nav.commandCenter",
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
  "command-center": `${MOD}+1`,
  launcher: `${MOD}+2`,
  tools: `${MOD}+3`,
  mcp: `${MOD}+4`,
  history: `${MOD}+5`,
  costs: `${MOD}+6`,
  workspace: `${MOD}+7`,
  doctor: `${MOD}+8`,
  updates: `${MOD}+9`,
  prereqs: `${MOD}+0`,
  admin: `${MOD}+,`,
  help: "?",
};
