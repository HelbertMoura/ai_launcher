import { beforeEach, describe, expect, it } from "vitest";
import {
  clearAll,
  getInboxSnapshot,
  markAllRead,
  markRead,
  pushEvent,
  reportDoctorResults,
  unreadCount,
  __resetForTests,
} from "./inboxStore";

function evt(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    type: "update" as const,
    titleKey: "inbox.updateTitle",
    targetTab: "updates" as const,
    ...extra,
  };
}

describe("inboxStore", () => {
  beforeEach(() => {
    localStorage.clear();
    __resetForTests();
  });

  it("pushEvent adds an unread event with timestamp", () => {
    pushEvent(evt("update:claude:2.0.0"));
    const snap = getInboxSnapshot();
    expect(snap.events).toHaveLength(1);
    expect(snap.events[0].read).toBe(false);
    expect(snap.events[0].ts).toBeGreaterThan(0);
    expect(unreadCount()).toBe(1);
  });

  it("dedups by id: never duplicates", () => {
    pushEvent(evt("update:claude:2.0.0"));
    pushEvent(evt("update:claude:2.0.0"));
    expect(getInboxSnapshot().events).toHaveLength(1);
  });

  it("re-push with IDENTICAL content preserves read (no re-unread on every boot)", () => {
    pushEvent(evt("update:claude:2.0.0", { titleParams: { cli: "claude", version: "2.0.0" } }));
    markRead("update:claude:2.0.0");
    pushEvent(evt("update:claude:2.0.0", { titleParams: { cli: "claude", version: "2.0.0" } }));
    const snap = getInboxSnapshot();
    expect(snap.events).toHaveLength(1);
    expect(snap.events[0].read).toBe(true);
  });

  it("re-push with DIFFERENT content re-marks unread", () => {
    pushEvent(evt("budget:anthropic:2026-06", { bodyParams: { percent: 80 } }));
    markRead("budget:anthropic:2026-06");
    pushEvent(evt("budget:anthropic:2026-06", { bodyParams: { percent: 95 } }));
    const snap = getInboxSnapshot();
    expect(snap.events).toHaveLength(1);
    expect(snap.events[0].read).toBe(false);
    expect(snap.events[0].bodyParams).toEqual({ percent: 95 });
  });

  it("caps at 50 events, evicting oldest read first", () => {
    for (let i = 0; i < 50; i += 1) pushEvent(evt(`e${i}`, { ts: 1000 + i }));
    markRead("e0");
    pushEvent(evt("e50", { ts: 2000 }));
    const snap = getInboxSnapshot();
    expect(snap.events).toHaveLength(50);
    expect(snap.events.find((e) => e.id === "e0")).toBeUndefined();
    expect(snap.events.find((e) => e.id === "e50")).toBeDefined();
  });

  it("caps at 50 evicting oldest overall when none are read", () => {
    for (let i = 0; i < 51; i += 1) pushEvent(evt(`e${i}`, { ts: 1000 + i }));
    const snap = getInboxSnapshot();
    expect(snap.events).toHaveLength(50);
    expect(snap.events.find((e) => e.id === "e0")).toBeUndefined();
  });

  it("markAllRead and clearAll work", () => {
    pushEvent(evt("a"));
    pushEvent(evt("b"));
    markAllRead();
    expect(unreadCount()).toBe(0);
    clearAll();
    expect(getInboxSnapshot().events).toHaveLength(0);
  });

  it("reportDoctorResults only notifies on ok->fail transition", () => {
    reportDoctorResults([
      { key: "node", name: "Node.js", installed: false },
      { key: "git", name: "Git", installed: true },
    ]);
    expect(getInboxSnapshot().events).toHaveLength(1);
    // Same failure reported again: no new event, no re-unread
    markAllRead();
    reportDoctorResults([{ key: "node", name: "Node.js", installed: false }]);
    expect(unreadCount()).toBe(0);
    // Recovers, then fails again: new notification
    reportDoctorResults([{ key: "node", name: "Node.js", installed: true }]);
    reportDoctorResults([{ key: "node", name: "Node.js", installed: false }]);
    expect(unreadCount()).toBe(1);
  });

  it("doctorFailing keys not present in a later run are carried over", () => {
    reportDoctorResults([{ key: "node", name: "Node.js", installed: false }]);
    markAllRead();
    // A run that doesn't include "node" must not forget it's failing.
    reportDoctorResults([{ key: "git", name: "Git", installed: true }]);
    reportDoctorResults([{ key: "node", name: "Node.js", installed: false }]);
    expect(unreadCount()).toBe(0);
  });

  it("persists through storage and survives reload (new module read)", () => {
    pushEvent(evt("persisted"));
    __resetForTests(); // drops in-memory cache, forces re-read from localStorage
    expect(getInboxSnapshot().events.find((e) => e.id === "persisted")).toBeDefined();
  });
});
