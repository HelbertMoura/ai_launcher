import { describe, expect, it } from "vitest";
import { buildLauncherOverview } from "./launcherPageModel";
import type { CliInfo } from "./useClis";

const cli = (key: string, name: string): CliInfo => ({
  key, name, command: key, flag: null, install_cmd: "", version_cmd: "",
  npm_pkg: null, pip_pkg: null, install_method: "manual", install_url: null,
  extra_paths: [], update_manifest_url: null,
});

describe("buildLauncherOverview", () => {
  it("counts custom CLIs as launch-ready and never reports negative missing", () => {
    const result = buildLauncherOverview(
      [cli("codex", "Codex"), cli("gemini", "Gemini")],
      1,
      { Codex: { name: "Codex", installed: true, version: "1", install_command: null } },
      new Set(["Codex"]),
    );
    expect(result).toEqual({ total: 3, installed: 2, missing: 1, updates: 1 });
  });
});
