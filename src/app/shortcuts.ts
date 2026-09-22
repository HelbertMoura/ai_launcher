//! Global keyboard shortcuts for tab navigation. Extracted from `App.tsx`
//! as part of REF-002 so the App shell stays focused on routing/layout.
//!
//! Behaviour:
//!   - `?` opens Help (no modifiers).
//!   - `Ctrl+,` (or `Cmd+,` on macOS) opens Admin.
//!   - `Ctrl+1..9,0` (or `Cmd+1..9,0` on macOS) jumps to the matching tab.
//!   - All shortcuts are suppressed while focus is inside an input,
//!     textarea or select so they never intercept user typing.
//!
//! The hook is intentionally idempotent: mounting it twice in the same
//! React tree would create two listeners, so the App shell must own
//! exactly one instance. See `.wolf/audit-2026-08-10.md` (REF-002).

import { useEffect } from "react";

import type { NavigateTarget } from "./layout/TabId";

const IS_MAC =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/i.test(navigator.platform);

/**
 * Ctrl+1..9,0 -> navigation target, in declaration order. Digits 1..7 keep
 * their v22 meaning; 8/9/0 open the fused Maintenance surface on the section
 * the old Doctor/Updates/Prereqs tabs used to cover (stable mapping, see Help).
 */
export const DIGIT_TABS: Record<string, NavigateTarget> = {
  "1": { tab: "command-center" },
  "2": { tab: "launcher" },
  "3": { tab: "tools" },
  "4": { tab: "mcp" },
  "5": { tab: "history" },
  "6": { tab: "costs" },
  "7": { tab: "workspace" },
  "8": { tab: "maintenance", section: "diagnostics" },
  "9": { tab: "maintenance", section: "updates" },
  "0": { tab: "maintenance", section: "verifications" },
};

/**
 * Non-digit navigation shortcut: `Ctrl+Alt+R` opens the v23.2 Race surface.
 * Every digit 1..0 is already bound, and plain `Ctrl+R` is avoided for its
 * reload semantics — the extra Alt modifier keeps the binding collision-free
 * (see the shortcut map in `TabId.ts` and the Help page).
 */
export const RACE_TARGET: NavigateTarget = { tab: "race" };

/** Selector that returns true when the event target is a text input. */
function isTypingTarget(target: EventTarget | null): boolean {
  const tag = (target as HTMLElement | null)?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/**
 * Mounts a single window-level `keydown` listener that translates the
 * shortcuts above into `onNavigate(tab)` calls. Cleanup is automatic on
 * unmount; the effect re-binds only when `onNavigate` identity changes
 * (callers should wrap in `useCallback` if the closure captures state).
 */
export function useGlobalShortcuts(
  onNavigate: (tab: NavigateTarget["tab"], section?: NavigateTarget["section"]) => void,
): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;

      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        onNavigate("help");
        return;
      }

      if ((IS_MAC ? e.metaKey : e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        onNavigate("admin");
        return;
      }

      const target = (IS_MAC ? e.metaKey : e.ctrlKey) ? DIGIT_TABS[e.key] : undefined;
      if (target) {
        e.preventDefault();
        onNavigate(target.tab, target.section);
        return;
      }

      if (
        (IS_MAC ? e.metaKey : e.ctrlKey) &&
        e.altKey &&
        // Match by physical key code: with Option held, macOS layouts emit
        // composed characters (e.g. "®" on US), so e.key never equals "r".
        e.code === "KeyR"
      ) {
        e.preventDefault();
        onNavigate(RACE_TARGET.tab, RACE_TARGET.section);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onNavigate]);
}
