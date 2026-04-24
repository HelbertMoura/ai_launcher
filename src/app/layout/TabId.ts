export type TabId =
  | "launcher"
  | "tools"
  | "history"
  | "costs"
  | "workspace"
  | "doctor"
  | "updates"
  | "prereqs"
  | "admin"
  | "help";

export const TAB_ORDER: TabId[] = ["launcher", "tools", "history", "costs", "workspace", "doctor", "updates", "prereqs", "admin", "help"];

export const TAB_LABELS: Record<TabId, string> = {
  launcher: "Launch",
  tools: "Tools",
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
  history: `${MOD}+3`,
  costs: `${MOD}+4`,
  workspace: `${MOD}+5`,
  doctor: `${MOD}+6`,
  updates: `${MOD}+7`,
  prereqs: `${MOD}+8`,
  admin: `${MOD}+,`,
  help: "?",
};
