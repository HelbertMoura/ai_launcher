import { describe, it, expect, beforeEach } from "vitest";
import { applySessionEnded } from "./useSessionEvents";
import type { HistoryItem } from "./useHistory";

const CONFIG_KEY = "ai-launcher-config";

function seedHistory(items: HistoryItem[]): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify({ history: items }));
}

function readHistory(): HistoryItem[] {
  const raw = localStorage.getItem(CONFIG_KEY);
  if (!raw) return [];
  return (JSON.parse(raw) as { history: HistoryItem[] }).history;
}

function baseItem(overrides: Partial<HistoryItem>): HistoryItem {
  const now = new Date(Date.now() - 5000).toISOString();
  return {
    cli: "Claude Code",
    cliKey: "claude",
    directory: "C:\\projects",
    args: "",
    timestamp: now,
    status: "starting",
    startedAt: now,
    ...overrides,
  };
}

describe("applySessionEnded", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("marks a session completed with backend duration", () => {
    seedHistory([baseItem({ sessionId: "s1" })]);
    applySessionEnded({
      session_id: "s1",
      status: "completed",
      exit_code: 0,
      duration_secs: 12,
    });
    const item = readHistory()[0];
    expect(item.status).toBe("completed");
    expect(item.exitCode).toBe(0);
    expect(item.duration).toBe(12000);
    expect(item.completedAt).toBeTruthy();
  });

  it("marks a session failed and preserves a non-zero exit code", () => {
    seedHistory([baseItem({ sessionId: "s2" })]);
    applySessionEnded({
      session_id: "s2",
      status: "failed",
      exit_code: 1,
      duration_secs: 3,
    });
    const item = readHistory()[0];
    expect(item.status).toBe("failed");
    expect(item.exitCode).toBe(1);
    expect(item.duration).toBe(3000);
  });

  it("marks a session detached without duration or exit code", () => {
    seedHistory([baseItem({ sessionId: "s3" })]);
    applySessionEnded({
      session_id: "s3",
      status: "detached",
      exit_code: null,
      duration_secs: null,
    });
    const item = readHistory()[0];
    expect(item.status).toBe("detached");
    expect(item.duration).toBeUndefined();
  });

  it("falls back to wall-clock duration when backend omits it", () => {
    seedHistory([baseItem({ sessionId: "s4" })]);
    applySessionEnded({ session_id: "s4", status: "completed", exit_code: 0 });
    const item = readHistory()[0];
    // startedAt was 5s ago, so the wall-clock fallback should be ~>= 5000ms.
    expect(item.duration).toBeGreaterThanOrEqual(4000);
  });

  it("is a no-op when no matching session id exists", () => {
    seedHistory([baseItem({ sessionId: "known" })]);
    applySessionEnded({ session_id: "unknown", status: "completed" });
    const item = readHistory()[0];
    expect(item.status).toBe("starting");
  });
});
