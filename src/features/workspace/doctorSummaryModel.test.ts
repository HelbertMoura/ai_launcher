import { describe, expect, it } from "vitest";
import { classifySeverity, summarizeDoctorSeverities } from "./doctorSummaryModel";
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

describe("doctorSummaryModel", () => {
  it("classifies severity by display name, case-insensitively", () => {
    expect(classifySeverity("node")).toBe("critical");
    expect(classifySeverity("Node.js")).toBe("critical");
    expect(classifySeverity("GIT")).toBe("critical");
    expect(classifySeverity("python3")).toBe("warning");
    expect(classifySeverity("rustc")).toBe("warning");
    expect(classifySeverity("vscode")).toBe("info");
  });

  it("summarizes missing checks by severity and keeps totals", () => {
    const items = [
      check({ key: "node", name: "Node.js", installed: false }),
      check({ key: "git", name: "git", installed: false }),
      check({ key: "rust", name: "rust", installed: false }),
      check({ key: "docker", name: "docker", installed: false }),
      check({ key: "pnpm", name: "pnpm", installed: true }),
    ];

    expect(summarizeDoctorSeverities(items)).toEqual({
      critical: 2,
      warning: 1,
      info: 1,
      missing: 4,
      total: 5,
    });
  });

  it("returns zeroed counters when everything is installed", () => {
    expect(summarizeDoctorSeverities([check({})])).toEqual({
      critical: 0,
      warning: 0,
      info: 0,
      missing: 0,
      total: 1,
    });
  });
});
