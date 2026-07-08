import type { ProjectProfile } from "../../lib/projectProfile";
import type { McpHealth, McpServer, McpServerInput } from "./types";

export interface ProjectMcpMatch {
  expectedId: string;
  server: McpServer;
}

export interface ProjectMcpResolution {
  expectedIds: string[];
  matched: ProjectMcpMatch[];
  missing: string[];
}

export interface ProjectMcpHealthSummary {
  expected: number;
  matched: number;
  enabled: number;
  healthy: number;
  unhealthy: number;
  unknown: number;
  missing: number;
  status: "none" | "ok" | "warn" | "unknown";
}

export function mcpServerKey(server: Pick<McpServer, "cli" | "name">): string {
  return `${server.cli}:${server.name}`;
}

export function serverToHealthInput(server: McpServer): McpServerInput {
  return {
    name: server.name,
    transport: server.transport,
    command: server.command,
    args: server.args,
    url: server.url,
    enabled: server.enabled,
  };
}

function normalizeId(value: string): string {
  return value.trim().toLowerCase();
}

function serverAliases(server: McpServer): string[] {
  return [server.name, mcpServerKey(server)].map(normalizeId);
}

function uniqueIds(ids: string[] | undefined): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of ids ?? []) {
    const id = raw.trim();
    const key = normalizeId(id);
    if (!id || seen.has(key)) continue;
    seen.add(key);
    result.push(id);
  }
  return result;
}

export function resolveProjectMcpServers(
  servers: McpServer[],
  profile: ProjectProfile | null | undefined,
): ProjectMcpResolution {
  const expectedIds = uniqueIds(profile?.mcp);
  const matched: ProjectMcpMatch[] = [];
  const missing: string[] = [];
  const usedServers = new Set<string>();

  for (const expectedId of expectedIds) {
    const expectedKey = normalizeId(expectedId);
    const server = servers.find((candidate) => {
      const key = mcpServerKey(candidate);
      return !usedServers.has(key) && serverAliases(candidate).includes(expectedKey);
    });
    if (!server) {
      missing.push(expectedId);
      continue;
    }
    usedServers.add(mcpServerKey(server));
    matched.push({ expectedId, server });
  }

  return { expectedIds, matched, missing };
}

export function summarizeProjectMcpHealth(
  resolution: ProjectMcpResolution,
  healthByServerKey: Record<string, McpHealth | undefined>,
): ProjectMcpHealthSummary {
  const expected = resolution.expectedIds.length;
  const matched = resolution.matched.length;
  const enabled = resolution.matched.filter(({ server }) => server.enabled).length;
  const healthResults = resolution.matched
    .map(({ server }) => healthByServerKey[mcpServerKey(server)])
    .filter((health): health is McpHealth => Boolean(health));
  const healthy = healthResults.filter((health) => health.ok).length;
  const unhealthy = healthResults.filter((health) => !health.ok).length;
  const missing = resolution.missing.length;
  const unknown = Math.max(0, matched - healthy - unhealthy);
  const status =
    expected === 0
      ? "none"
      : missing > 0 || unhealthy > 0
        ? "warn"
        : unknown > 0
          ? "unknown"
          : "ok";

  return {
    expected,
    matched,
    enabled,
    healthy,
    unhealthy,
    unknown,
    missing,
    status,
  };
}
