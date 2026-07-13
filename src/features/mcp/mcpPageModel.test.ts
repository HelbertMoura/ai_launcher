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
      [mcpHealthKey(github)]: { ok: true, detail: "ready" },
      [mcpHealthKey(memory)]: { ok: false, detail: "missing command" },
    })).toEqual({
      total: 3,
      healthy: 1,
      unavailable: 1,
      unknown: 1,
      configuredClis: 2,
    });
  });
});
