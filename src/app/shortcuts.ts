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

import type { TabId } from "./layout/TabId";

const IS_MAC =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/i.test(navigator.platform);

/** Ctrl+1..9,0 -> canonical tab id, in declaration order. */
export const DIGIT_TABS: Record<string, TabId> = {
  "1": "command-center",
  "2": "launcher",
  "3": "tools",
  "4": "mcp",
  "5": "history",
  "6": "costs",
  "7": "workspace",
  "8": "doctor",
  "9": "updates",
  "0": "prereqs",
};

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
export function useGlobalShortcuts(onNavigate: (tab: TabId) => void): void {
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

      if ((IS_MAC ? e.metaKey : e.ctrlKey) && DIGIT_TABS[e.key]) {
        e.preventDefault();
        onNavigate(DIGIT_TABS[e.key]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onNavigate]);
}
