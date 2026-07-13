import { describe, expect, it } from "vitest";
import { buildUpdatesOverview } from "./updatesPageModel";
import type { UpdatesSummary } from "../../hooks/useUpdates";

const summary: UpdatesSummary = {
  cli_updates: [
    { cli: "Codex", current: "1", latest: "2", has_update: true, method: "npm", no_api: false, key: "codex" },
  ],
  env_updates: [
    { cli: "Node.js", current: "22", latest: "24", has_update: true, method: "winget", no_api: false, key: "node" },
  ],
  tool_updates: [
    { cli: "Git", current: "2", latest: "2", has_update: false, method: "winget", no_api: false, key: "git" },
  ],
  checked_at: "2026-07-13T12:00:00.000Z",
  total_with_updates: 2,
};

describe("buildUpdatesOverview", () => {
  it("includes environment updates and installation gaps in attention total", () => {
    const result = buildUpdatesOverview(summary, 1, 2);
    expect(result.total).toBe(5);
    expect(result.envUpdates).toHaveLength(1);
    expect(result.toolUpdates).toHaveLength(0);
    expect(result.checkedAt).toBe(summary.checked_at);
  });
});
