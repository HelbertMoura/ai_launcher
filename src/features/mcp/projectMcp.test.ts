import { describe, expect, it } from "vitest";
import {
  mcpServerKey,
  resolveProjectMcpServers,
  summarizeProjectMcpHealth,
} from "./projectMcp";
import type { McpServer } from "./types";

function server(patch: Partial<McpServer> = {}): McpServer {
  return {
    cli: "claude",
    name: "filesystem",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem"],
    headers_keys: [],
    env_keys: [],
    enabled: true,
    ...patch,
  };
}

describe("projectMcp", () => {
  it("matches project MCP ids by name or cli-qualified id", () => {
    const servers = [
      server(),
      server({ cli: "codex", name: "github", command: "uvx", args: ["mcp-server-github"] }),
    ];

    const resolution = resolveProjectMcpServers(servers, {
      version: 1,
      mcp: ["filesystem", "codex:github"],
    });

    expect(resolution.matched.map((item) => item.server.name)).toEqual([
      "filesystem",
      "github",
    ]);
    expect(resolution.missing).toEqual([]);
  });

  it("deduplicates expected ids and reports missing servers", () => {
    const resolution = resolveProjectMcpServers([server()], {
      version: 1,
      mcp: ["filesystem", " filesystem ", "memory"],
    });

    expect(resolution.expectedIds).toEqual(["filesystem", "memory"]);
    expect(resolution.matched).toHaveLength(1);
    expect(resolution.missing).toEqual(["memory"]);
  });

  it("summarizes health for project-scoped servers", () => {
    const filesystem = server();
    const github = server({ cli: "codex", name: "github", enabled: false });
    const resolution = resolveProjectMcpServers([filesystem, github], {
      version: 1,
      mcp: ["filesystem", "github", "memory"],
    });

    const summary = summarizeProjectMcpHealth(resolution, {
      [mcpServerKey(filesystem)]: { ok: true, detail: "ok" },
      [mcpServerKey(github)]: { ok: false, detail: "missing token" },
    });

    expect(summary).toMatchObject({
      expected: 3,
      matched: 2,
      enabled: 1,
      healthy: 1,
      unhealthy: 1,
      missing: 1,
      status: "warn",
    });
  });
});
