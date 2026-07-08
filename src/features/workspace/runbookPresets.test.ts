import { beforeEach, describe, expect, it } from "vitest";
import { getRunbooks } from "./runbookStore";
import {
  getSuggestedRunbookPresets,
  installRunbookPresets,
  materializeRunbookPreset,
  RUNBOOK_PRESETS,
} from "./runbookPresets";

describe("runbookPresets", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("materializes presets with stable step ids and marker tags", () => {
    const preset = RUNBOOK_PRESETS.find((item) => item.id === "node-setup");
    expect(preset).toBeDefined();

    const runbook = materializeRunbookPreset(preset!);

    expect(runbook.tags).toContain("preset:node-setup");
    expect(runbook.steps[0]).toMatchObject({
      id: "preset-node-setup-1",
      command: "node --version",
    });
  });

  it("deduplicates suggested preset ids while preserving order", () => {
    const presets = getSuggestedRunbookPresets([
      "tauri-setup",
      "node-setup",
      "tauri-setup",
      "missing",
    ]);

    expect(presets.map((preset) => preset.id)).toEqual(["tauri-setup", "node-setup"]);
  });

  it("installs presets once", () => {
    const first = installRunbookPresets(["node-setup", "python-setup"]);
    const second = installRunbookPresets(["node-setup"]);

    expect(first.created).toHaveLength(2);
    expect(second.created).toHaveLength(0);
    expect(second.skipped.map((preset) => preset.id)).toEqual(["node-setup"]);
    expect(getRunbooks()).toHaveLength(2);
  });
});
