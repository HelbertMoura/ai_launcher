export type TabId =
  | "command-center"
  | "launcher"
  | "tools"
  | "mcp"
  | "history"
  | "costs"
  | "workspace"
  | "maintenance"
  | "admin"
  | "help";

/**
 * Internal sections of the fused Maintenance surface (v23 "Fleet Command"):
 * Doctor (diagnostics), Prereqs (verifications) and Updates live there now.
 */
export type MaintenanceSection = "diagnostics" | "verifications" | "updates";

export const MAINTENANCE_SECTIONS: MaintenanceSection[] = [
  "diagnostics",
  "verifications",
  "updates",
];

/** A navigation request: a surface plus, for Maintenance, an optional section. */
export interface NavigateTarget {
  tab: TabId;
  section?: MaintenanceSection;
}

/** Common signature for navigation callbacks routed through the App shell. */
export type TabNavigator = (tab: TabId, section?: MaintenanceSection) => void;

export const TAB_ORDER: TabId[] = ["command-center", "launcher", "tools", "workspace", "mcp", "history", "costs", "maintenance", "admin", "help"];

export const TAB_LABELS: Record<TabId, string> = {
  "command-center": "Home",
  launcher: "Launch",
  tools: "Tools",
  mcp: "MCP",
  history: "History",
  costs: "Analytics",
  workspace: "Workspaces",
  maintenance: "Maintenance",
  admin: "Admin",
  help: "Help",
};

/** i18n keys for each tab (used by Sidebar + CommandPalette). */
export const TAB_I18N_KEYS: Record<TabId, string> = {
  "command-center": "nav.home",
  launcher: "nav.launcher",
  tools: "nav.tools",
  mcp: "nav.mcp",
  history: "nav.history",
  costs: "nav.costs",
  workspace: "nav.workspace",
  maintenance: "nav.maintenance",
  admin: "nav.admin",
  help: "nav.help",
};

/** i18n keys for each Maintenance section (sidebar-less sub-navigation). */
export const MAINTENANCE_SECTION_I18N_KEYS: Record<MaintenanceSection, string> = {
  diagnostics: "maintenance.sections.diagnostics",
  verifications: "maintenance.sections.verifications",
  updates: "maintenance.sections.updates",
};

const MOD = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform)
  ? "⌘"
  : "Ctrl";

/**
 * Stable shortcut map (documented in Help). Ctrl+1..7 keep their v22 meaning;
 * Ctrl+8/9/0 now open the fused Maintenance surface on the matching section
 * (Diagnostics / Updates / Verifications), preserving muscle memory.
 */
export const TAB_KEYS: Record<TabId, string> = {
  "command-center": `${MOD}+1`,
  launcher: `${MOD}+2`,
  tools: `${MOD}+3`,
  mcp: `${MOD}+4`,
  history: `${MOD}+5`,
  costs: `${MOD}+6`,
  workspace: `${MOD}+7`,
  maintenance: `${MOD}+8`,
  admin: `${MOD}+,`,
  help: "?",
};

/**
 * Legacy (v22) surface ids kept as navigation aliases for one version, so old
 * shortcuts/persisted inbox events keep working. Palette exposes them marked
 * as legacy names.
 */
export const LEGACY_TAB_TARGETS: Record<string, NavigateTarget> = {
  doctor: { tab: "maintenance", section: "diagnostics" },
  prereqs: { tab: "maintenance", section: "verifications" },
  updates: { tab: "maintenance", section: "updates" },
};

export function isTabId(value: string): value is TabId {
  return (TAB_ORDER as string[]).includes(value);
}

function isMaintenanceSection(value: string | undefined): value is MaintenanceSection {
  return value === "diagnostics" || value === "verifications" || value === "updates";
}

/**
 * Resolve any stored/legacy tab reference into a current navigation target.
 * Accepts current ids ("workspace"), fused ids with a section
 * ("maintenance:updates") and v22 legacy ids ("doctor", "prereqs", "updates").
 * Unknown values fall back to Home instead of throwing.
 */
export function resolveNavigationTarget(raw: string): NavigateTarget {
  if (Object.prototype.hasOwnProperty.call(LEGACY_TAB_TARGETS, raw)) {
    return LEGACY_TAB_TARGETS[raw];
  }
  const [head, section] = raw.split(":");
  if (isTabId(head)) {
    if (head === "maintenance" && isMaintenanceSection(section)) {
      return { tab: head, section };
    }
    return { tab: head };
  }
  return { tab: "command-center" };
}
