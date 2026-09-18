// ============================================================================
// MCP command layer — the only place in the MCP feature that touches
// `invoke` directly. Wire payloads are identical to the previous ad-hoc
// calls in useMcp.ts; errors keep surfacing as raw strings.
// ============================================================================

import { invoke } from "@tauri-apps/api/core";
import type { McpCli, McpServerInput } from "./types";

export function addMcpServer(cli: McpCli, server: McpServerInput): Promise<void> {
  return invoke("add_mcp_server", { cli, server });
}

export function updateMcpServer(
  cli: McpCli,
  name: string,
  server: McpServerInput,
): Promise<void> {
  return invoke("update_mcp_server", { cli, name, server });
}

export function removeMcpServer(cli: McpCli, name: string): Promise<void> {
  return invoke("remove_mcp_server", { cli, name });
}

/** Raw `mcp_health_check` payload — callers validate with `McpHealthSchema`. */
export function mcpHealthCheck(server: McpServerInput): Promise<unknown> {
  return invoke<unknown>("mcp_health_check", { server });
}
