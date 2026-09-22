// Persistence + mutation contract for the v23 sidebar layout state:
// pinned surfaces (ordered by insertion) and collapsed group ids. Both flow
// through the central storage registry, so the assertions check the real
// localStorage keys as well as the in-memory snapshot.
import { beforeEach, describe, expect, it } from "vitest";
import {
  getSidebarNavSnapshot,
  partitionSurfaces,
  pinSurface,
  toggleGroupAction,
  toggleGroupCollapsed,
  togglePinned,
  togglePinAction,
  unpinSurface,
  __resetSidebarNavForTests,
  type SidebarGroupId,
  type SidebarNavState,
} from "./sidebarNav";
import { STORAGE_KEYS } from "../../lib/storage";

function state(pinned: string[] = [], collapsed: SidebarGroupId[] = []): SidebarNavState {
  // Test inputs are plain strings on purpose; sanitizePinned is not in this
  // path (pure helpers), so the cast mirrors the persisted boundary.
  return { pinned: pinned as SidebarNavState["pinned"], collapsedGroups: collapsed };
}

describe("sidebarNav", () => {
  beforeEach(() => {
    localStorage.clear();
    __resetSidebarNavForTests();
  });

  it("pinSurface appends by insertion order and ignores Home", () => {
    let s = pinSurface(state(), "history");
    s = pinSurface(s, "launcher");
    expect(s.pinned).toEqual(["history", "launcher"]);
    // Home is fixed above the groups and can never be pinned.
    expect(pinSurface(s, "command-center").pinned).toEqual(["history", "launcher"]);
    // Pinning twice is a no-op (no duplicates).
    expect(pinSurface(s, "history").pinned).toEqual(["history", "launcher"]);
  });

  it("unpinSurface removes the surface; toggling flips membership", () => {
    const s = pinSurface(state(), "mcp");
    expect(unpinSurface(s, "mcp").pinned).toEqual([]);
    expect(unpinSurface(s, "history").pinned).toEqual(["mcp"]);
    expect(togglePinned(s, "mcp").pinned).toEqual([]);
    expect(togglePinned(state(), "mcp").pinned).toEqual(["mcp"]);
  });

  it("toggleGroupCollapsed adds and removes group ids", () => {
    let s = toggleGroupCollapsed(state(), "run");
    expect(s.collapsedGroups).toEqual(["run"]);
    s = toggleGroupCollapsed(s, "system");
    expect(s.collapsedGroups).toEqual(["run", "system"]);
    s = toggleGroupCollapsed(s, "run");
    expect(s.collapsedGroups).toEqual(["system"]);
  });

  it("partitionSurfaces moves pinned surfaces out of their groups and drops empty groups", () => {
    const s = state(["history", "launcher"]);
    const layout = partitionSurfaces(s);
    expect(layout.pinned).toEqual(["history", "launcher"]);
    // Read the FILTERED list (entry.surfaces), not the original group list.
    const ids = layout.groups.map((g) => g.surfaces);
    expect(ids).toEqual([
      ["tools", "workspace"], // run without launcher
      ["costs"], // observe without history
      ["mcp"],
      ["maintenance", "admin", "help"],
    ]);
  });

  it("persists pins and collapsed groups to the registered storage keys", () => {
    togglePinAction("mcp");
    togglePinAction("tools");
    toggleGroupAction("observe");

    const rawPinned = JSON.parse(localStorage.getItem(STORAGE_KEYS.sidebarPinned) ?? "[]");
    const rawGroups = JSON.parse(localStorage.getItem(STORAGE_KEYS.sidebarGroups) ?? "[]");
    expect(rawPinned).toEqual(["mcp", "tools"]);
    expect(rawGroups).toEqual(["observe"]);

    // Snapshot reads back from storage (after cache reset).
    __resetSidebarNavForTests();
    expect(getSidebarNavSnapshot()).toEqual({ pinned: ["mcp", "tools"], collapsedGroups: ["observe"] });
    togglePinAction("tools");
    toggleGroupAction("observe");
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.sidebarPinned) ?? "[]")).toEqual(["mcp"]);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.sidebarGroups) ?? "[]")).toEqual([]);
  });

  it("sanitizes corrupt or unknown persisted values", () => {
    localStorage.setItem(STORAGE_KEYS.sidebarPinned, JSON.stringify(["bogus", "history", "command-center", "history"]));
    localStorage.setItem(STORAGE_KEYS.sidebarGroups, JSON.stringify(["nope", "run"]));
    __resetSidebarNavForTests();
    const { pinned, collapsedGroups } = getSidebarNavSnapshot();
    expect(pinned).toEqual(["history"]);
    expect(collapsedGroups).toEqual(["run"]);
  });
});
