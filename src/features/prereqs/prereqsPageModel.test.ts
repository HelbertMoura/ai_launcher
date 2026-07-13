import { describe, expect, it } from "vitest";
import { buildPrereqsPageSummary } from "./prereqsPageModel";
import type { PrereqCheck } from "./usePrerequisites";

function item(partial: Partial<PrereqCheck>): PrereqCheck {
  return {
    key: "node",
    name: "Node.js",
    installed: true,
    version: "24.0.0",
    install_command: null,
    ...partial,
  };
}

describe("buildPrereqsPageSummary", () => {
  it("summarizes readiness and missing impact groups", () => {
    const summary = buildPrereqsPageSummary([
      item({ key: "node", installed: false }),
      item({ key: "python", installed: false }),
      item({ key: "vscode", installed: false }),
      item({ key: "git", installed: true }),
    ]);

    expect(summary).toEqual({
      total: 4,
      installed: 1,
      missing: 3,
      readinessPct: 25,
      requiredMissing: 1,
      recommendedMissing: 1,
      optionalMissing: 1,
    });
  });
});
