import { describe, expect, it } from "vitest";
import { buildDoctorItems, buildDoctorSummary, classifyDoctorCheck } from "./doctorPageModel";
import type { PrereqCheck } from "../prereqs/usePrerequisites";

function check(partial: Partial<PrereqCheck>): PrereqCheck {
  return {
    key: "node",
    name: "Node.js",
    installed: true,
    version: "24.0.0",
    install_command: null,
    ...partial,
  };
}

describe("doctorPageModel", () => {
  it("classifies required, recommended and optional checks", () => {
    expect(classifyDoctorCheck("node")).toBe("critical");
    expect(classifyDoctorCheck("rust")).toBe("warning");
    expect(classifyDoctorCheck("vscode")).toBe("info");
  });

  it("builds an environment readiness summary", () => {
    const items = buildDoctorItems([
      check({ key: "node", installed: false }),
      check({ key: "rust", installed: false }),
      check({ key: "vscode", installed: true }),
    ]);

    expect(buildDoctorSummary(items)).toEqual({
      total: 3,
      installed: 1,
      missing: 2,
      criticalMissing: 1,
      warningMissing: 1,
      optionalMissing: 0,
      readinessPct: 33,
      status: "critical",
    });
  });
});
