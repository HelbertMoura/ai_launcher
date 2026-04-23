export type TabId =
  | "launcher"
  | "tools"
  | "history"
  | "costs"
  | "updates"
  | "prereqs"
  | "admin"
  | "help";

export const TAB_ORDER: TabId[] = ["launcher", "tools", "history", "costs", "updates", "prereqs", "admin", "help"];

export const TAB_LABELS: Record<TabId, string> = {
  launcher: "Launch",
  tools: "Tools",
  history: "History",
  costs: "Costs",
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
  updates: `${MOD}+6`,
  prereqs: `${MOD}+5`,
  admin: `${MOD}+,`,
  help: "?",
};
