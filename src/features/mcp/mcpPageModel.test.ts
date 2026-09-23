import { describe, expect, it } from "vitest";
import { buildMcpOverview, mcpHealthKey } from "./mcpPageModel";
import type { McpServer } from "./types";

const server = (cli: McpServer["cli"], name: string): McpServer => ({
  cli,
  name,
  transport: "stdio",
  command: "npx",
  args: [],
  env_keys: [],
  headers_keys: [],
  enabled: true,
});

describe("buildMcpOverview", () => {
  it("separates healthy, unavailable and unchecked servers across CLIs", () => {
    const github = server("claude", "github");
    const memory = server("codex", "memory");
    const filesystem = server("claude", "filesystem");

    expect(buildMcpOverview([github, memory, filesystem], {
      [mcpHealthKey(github)]: { state: "ok", ok: true, detail: "ready" },
      [mcpHealthKey(memory)]: { state: "fail", ok: false, detail: "missing command" },
    })).toEqual({
      total: 3,
      healthy: 1,
      unavailable: 1,
      disabled: 0,
      unknown: 1,
      configuredClis: 2,
    });
  });

  it("counts disabled servers in their own neutral bucket", () => {
    const github = server("claude", "github");
    const memory = server("gemini", "memory");

    expect(buildMcpOverview([github, memory], {
      [mcpHealthKey(github)]: { state: "ok", ok: true, detail: "ready" },
      [mcpHealthKey(memory)]: { state: "disabled", ok: false, detail: "Servidor desativado: saúde não verificada" },
    })).toEqual({
      total: 2,
      healthy: 1,
      unavailable: 0,
      disabled: 1,
      unknown: 0,
      configuredClis: 2,
    });
  });
});
