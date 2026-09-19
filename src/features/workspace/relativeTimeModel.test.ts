import { afterEach, describe, expect, it, vi } from "vitest";
import { timeAgo } from "./relativeTimeModel";

afterEach(() => {
  vi.useRealTimers();
});

describe("relativeTimeModel", () => {
  it("returns an em dash for invalid timestamps", () => {
    expect(timeAgo("not-a-date")).toBe("—");
  });

  it("formats elapsed time in seconds, minutes, hours and days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    expect(timeAgo("2026-01-01T11:59:30Z")).toBe("30s");
    expect(timeAgo("2026-01-01T11:30:00Z")).toBe("30m");
    expect(timeAgo("2026-01-01T05:00:00Z")).toBe("7h");
    expect(timeAgo("2025-12-30T12:00:00Z")).toBe("2d");
  });
});
