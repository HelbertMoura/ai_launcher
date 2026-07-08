import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_HISTORY_FILTERS,
  loadHistoryFilters,
  normalizeHistoryFilters,
  saveHistoryFilters,
} from "./historyFilters";

describe("historyFilters", () => {
  beforeEach(() => localStorage.clear());

  it("normalizes invalid persisted filters", () => {
    expect(
      normalizeHistoryFilters({
        cli: "",
        provider: 1,
        range: "forever",
        timelineRange: "12h",
        timelineOpen: "yes",
      }),
    ).toEqual(DEFAULT_HISTORY_FILTERS);
  });

  it("round trips valid filters through localStorage", () => {
    saveHistoryFilters({
      cli: "claude",
      provider: "anthropic",
      range: "week",
      timelineRange: "7d",
      timelineOpen: false,
    });

    expect(loadHistoryFilters()).toEqual({
      cli: "claude",
      provider: "anthropic",
      range: "week",
      timelineRange: "7d",
      timelineOpen: false,
    });
  });
});
