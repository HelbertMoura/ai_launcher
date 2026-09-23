import { beforeEach, describe, expect, it, vi } from "vitest";

const readUsageStatsMock = vi.hoisted(() => vi.fn());

vi.mock("../../lib/tauri", () => ({
  readUsageStats: readUsageStatsMock,
}));

import { usageStore } from "./usageStore";
import type { UsageReport } from "./types";

const REPORT: UsageReport = {
  entries: [
    {
      date: "2026-09-23",
      cli: "codex",
      provider: "openai",
      model: "gpt-5",
      tokens_in: 12000,
      tokens_out: 4300,
      cost_estimate_usd: 4.6,
      project: "Command Deck",
      project_path: "C:/dev/command-deck",
    },
    {
      date: "2026-09-22",
      cli: "claude",
      provider: "anthropic",
      model: "opus",
      tokens_in: 9000,
      tokens_out: 3800,
      cost_estimate_usd: 5.2,
      project: "Command Deck",
      project_path: null,
    },
  ],
  total_tokens_in: 21000,
  total_tokens_out: 8100,
  total_cost_usd: 9.8,
  warnings: [],
};

beforeEach(() => {
  readUsageStatsMock.mockReset();
  usageStore.reset();
});

describe("usageStore", () => {
  it("refresh stores the validated report and stamps fetchedAt", async () => {
    readUsageStatsMock.mockResolvedValue(REPORT);

    await usageStore.refresh();

    // Default refresh keeps the legacy cached read (no force on the wire).
    expect(readUsageStatsMock).toHaveBeenCalledWith(undefined);
    const s = usageStore.getSnapshot();
    expect(s.error).toBeNull();
    expect(s.loading).toBe(false);
    expect(s.report).toEqual(REPORT);
    expect(typeof s.fetchedAt).toBe("number");
  });

  it("rejects a contract-breaking payload: error set, report stays null", async () => {
    readUsageStatsMock.mockResolvedValue({ entries: [{ cli: "codex" }] }); // missing fields

    await usageStore.refresh();

    const s = usageStore.getSnapshot();
    expect(s.loading).toBe(false);
    expect(s.report).toBeNull();
    expect(s.error).toContain("date");
    expect(s.fetchedAt).toBeNull();
  });

  it("surfaces command failures but keeps a previously valid report", async () => {
    readUsageStatsMock.mockResolvedValueOnce(REPORT);
    await usageStore.refresh();

    readUsageStatsMock.mockRejectedValue(new Error("leitura falhou"));
    await usageStore.refresh();

    const s = usageStore.getSnapshot();
    expect(s.error).toBe("leitura falhou");
    expect(s.report).toEqual(REPORT); // stale data survives transient failures
    expect(s.loading).toBe(false);
  });

  it("dedupes concurrent refreshes into a single invoke", async () => {
    let resolve!: (value: UsageReport) => void;
    readUsageStatsMock.mockReturnValue(
      new Promise<UsageReport>((r) => {
        resolve = r;
      }),
    );

    expect(usageStore.getSnapshot().loading).toBe(false);
    const first = usageStore.refresh();
    expect(usageStore.getSnapshot().loading).toBe(true);
    const second = usageStore.refresh(); // shares the in-flight request
    resolve(REPORT);
    await Promise.all([first, second]);

    expect(readUsageStatsMock).toHaveBeenCalledTimes(1);
    expect(usageStore.getSnapshot().report).toEqual(REPORT);
    expect(usageStore.getSnapshot().loading).toBe(false);
  });

  it("propagates force to the wrapper to bypass the backend cache", async () => {
    readUsageStatsMock.mockResolvedValue(REPORT);

    await usageStore.refresh(true);

    expect(readUsageStatsMock).toHaveBeenCalledWith(true);
    expect(usageStore.getSnapshot().error).toBeNull();

    readUsageStatsMock.mockClear();
    await usageStore.refresh();
    expect(readUsageStatsMock).toHaveBeenCalledWith(undefined);
  });

  it("notifies subscribers on state transitions until unsubscribe", async () => {
    const loadingStates: boolean[] = [];
    const unsubscribe = usageStore.subscribe((s) => loadingStates.push(s.loading));
    readUsageStatsMock.mockResolvedValue(REPORT);

    await usageStore.refresh();
    unsubscribe();

    expect(loadingStates).toEqual([true, false]);
  });

  it("reset returns the store to its pristine state", async () => {
    readUsageStatsMock.mockResolvedValue(REPORT);
    await usageStore.refresh();

    usageStore.reset();

    expect(usageStore.getSnapshot()).toEqual({
      report: null,
      loading: false,
      error: null,
      fetchedAt: null,
    });
  });
});
