import type { McpHealth, McpServer } from "./types";

export interface McpOverview {
  total: number;
  healthy: number;
  unavailable: number;
  unknown: number;
  configuredClis: number;
}

export function mcpHealthKey(server: Pick<McpServer, "cli" | "name">): string {
  return `${server.cli}:${server.name}`;
}

export function buildMcpOverview(
  servers: McpServer[],
  health: Record<string, McpHealth>,
): McpOverview {
  let healthy = 0;
  let unavailable = 0;

  for (const server of servers) {
    const result = health[mcpHealthKey(server)];
    if (!result) continue;
    if (result.ok) healthy += 1;
    else unavailable += 1;
  }

  return {
    total: servers.length,
    healthy,
    unavailable,
    unknown: Math.max(0, servers.length - healthy - unavailable),
    configuredClis: new Set(servers.map((server) => server.cli)).size,
  };
}
