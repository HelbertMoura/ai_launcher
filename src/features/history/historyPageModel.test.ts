import { describe, expect, it } from "vitest";
import { buildHistoryOverview, sortSessionsByPriority } from "./historyPageModel";
import type { HistoryItem } from "./useHistory";

const item = (status: HistoryItem["status"], timestamp: string, duration?: number): HistoryItem => ({
  cli: "Codex", cliKey: "codex", directory: "C:/deck", args: "", timestamp,
  startedAt: timestamp, status, duration,
});

describe("history page model", () => {
  it("summarizes outcomes without counting incomplete durations", () => {
    expect(buildHistoryOverview([
      item("running", "2026-01-01"), item("completed", "2026-01-02", 1000),
      item("failed", "2026-01-03", 3000),
    ])).toEqual({ active: 1, failed: 1, completed: 1, averageDuration: 2000 });
  });

  it("keeps active sessions ahead of newer completed sessions", () => {
    const ordered = sortSessionsByPriority([
      item("completed", "2026-01-03"), item("running", "2026-01-01"),
    ]);
    expect(ordered.map((entry) => entry.status)).toEqual(["running", "completed"]);
  });
});
