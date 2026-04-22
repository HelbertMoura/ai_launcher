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

export const TAB_KEYS: Record<TabId, string> = {
  launcher: "⌘1",
  tools: "⌘2",
  history: "⌘3",
  costs: "⌘4",
  admin: "⌘,",
  help: "?",
};
