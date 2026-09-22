// ==============================================================================
// AI Launcher Pro - Sidebar layout state (v23 "Fleet Command")
// Pinned surfaces + collapsed group ids, persisted through the central storage
// registry. One tiny observable store shared by Sidebar and CommandPalette via
// useSyncExternalStore (snapshots are cached and swap only on mutation).
//
// Sanitization happens on load: unknown ids (from future/older versions or
// corrupt blobs) are dropped instead of crashing or leaking into the UI.
// ==============================================================================

import { useSyncExternalStore } from "react";
import { readKey, writeKey } from "../../lib/storage";
import { isTabId, TAB_ORDER, type TabId } from "./TabId";

export type SidebarGroupId = "run" | "observe" | "connect" | "system";

export interface SidebarGroup {
  id: SidebarGroupId;
  labelKey: string;
  surfaces: TabId[];
}

/**
 * Fixed group structure approved in the v23 menu modeling. Home
 * (command-center) is intentionally absent: it sits above the groups and can
 * never be pinned or grouped.
 */
export const SIDEBAR_GROUPS: SidebarGroup[] = [
  { id: "run", labelKey: "nav.groupRun", surfaces: ["launcher", "tools", "workspace", "race"] },
  { id: "observe", labelKey: "nav.groupObserve", surfaces: ["history", "costs"] },
  { id: "connect", labelKey: "nav.groupConnect", surfaces: ["mcp"] },
  { id: "system", labelKey: "nav.groupSystem", surfaces: ["maintenance", "admin", "help"] },
];

const GROUP_IDS: SidebarGroupId[] = SIDEBAR_GROUPS.map((g) => g.id);

/** Surfaces that can be pinned (everything except Home). */
export const PINNABLE_SURFACES: TabId[] = TAB_ORDER.filter((id) => id !== "command-center");

export interface SidebarNavState {
  pinned: TabId[];
  collapsedGroups: SidebarGroupId[];
}

function sanitizePinned(raw: string[]): TabId[] {
  const seen = new Set<string>();
  const out: TabId[] = [];
  for (const value of raw) {
    if (!isTabId(value) || value === "command-center" || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function sanitizeGroups(raw: string[]): SidebarGroupId[] {
  return raw.filter((value): value is SidebarGroupId =>
    (GROUP_IDS as string[]).includes(value),
  );
}

let cache: SidebarNavState | null = null;
const listeners = new Set<() => void>();

function loadState(): SidebarNavState {
  return {
    pinned: sanitizePinned(readKey("sidebarPinned")),
    collapsedGroups: sanitizeGroups(readKey("sidebarGroups")),
  };
}

function getSnapshot(): SidebarNavState {
  if (cache === null) cache = loadState();
  return cache;
}

function mutate(next: SidebarNavState): void {
  cache = next;
  writeKey("sidebarPinned", next.pinned);
  writeKey("sidebarGroups", next.collapsedGroups);
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// --- Pure mutations (exported for tests) -------------------------------------

/** Pin a surface: appends to the Pinned section, removing it from its group. */
export function pinSurface(state: SidebarNavState, id: TabId): SidebarNavState {
  if (id === "command-center" || state.pinned.includes(id)) return state;
  return { ...state, pinned: [...state.pinned, id] };
}

/** Unpin a surface: it simply returns to its group (groups derive from this). */
export function unpinSurface(state: SidebarNavState, id: TabId): SidebarNavState {
  if (!state.pinned.includes(id)) return state;
  return { ...state, pinned: state.pinned.filter((p) => p !== id) };
}

export function togglePinned(state: SidebarNavState, id: TabId): SidebarNavState {
  return state.pinned.includes(id) ? unpinSurface(state, id) : pinSurface(state, id);
}

export function toggleGroupCollapsed(
  state: SidebarNavState,
  group: SidebarGroupId,
): SidebarNavState {
  const next = state.collapsedGroups.includes(group)
    ? state.collapsedGroups.filter((g) => g !== group)
    : [...state.collapsedGroups, group];
  return { ...state, collapsedGroups: next };
}

/**
 * Distribute surfaces between the Pinned section and their groups. A pinned
 * surface leaves its group; empty groups are dropped from the result.
 */
export function partitionSurfaces(
  state: SidebarNavState,
): { pinned: TabId[]; groups: Array<{ group: SidebarGroup; surfaces: TabId[] }> } {
  const pinned = state.pinned.filter((id) => PINNABLE_SURFACES.includes(id));
  const groups = SIDEBAR_GROUPS
    .map((group) => ({ group, surfaces: group.surfaces.filter((id) => !pinned.includes(id)) }))
    .filter((entry) => entry.surfaces.length > 0);
  return { pinned, groups };
}

// --- React binding ------------------------------------------------------------

/** Module-level actions so non-hook callers (tests, palette) share one path. */
export function togglePinAction(id: TabId): void {
  mutate(togglePinned(getSnapshot(), id));
}

export function toggleGroupAction(group: SidebarGroupId): void {
  mutate(toggleGroupCollapsed(getSnapshot(), group));
}

/** Test-only: drop the in-memory cache so the next read hits localStorage. */
export function __resetSidebarNavForTests(): void {
  cache = null;
}

/** Test-only snapshot read (hook-free). */
export function getSidebarNavSnapshot(): SidebarNavState {
  return getSnapshot();
}

export function useSidebarNav(): SidebarNavState & {
  togglePin: (id: TabId) => void;
  toggleGroup: (group: SidebarGroupId) => void;
} {
  const state = useSyncExternalStore(subscribe, getSnapshot);
  return {
    ...state,
    togglePin: togglePinAction,
    toggleGroup: toggleGroupAction,
  };
}
