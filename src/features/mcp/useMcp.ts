import { useCallback, useEffect, useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import { mcpStore, type McpSnapshot } from "./mcpStore";
import {
  McpHealthSchema,
  type McpCli,
  type McpHealth,
  type McpServerInput,
} from "./types";

export interface UseMcpResult extends McpSnapshot {
  refresh: () => Promise<void>;
  addServer: (cli: McpCli, server: McpServerInput) => Promise<void>;
  updateServer: (cli: McpCli, name: string, server: McpServerInput) => Promise<void>;
  removeServer: (cli: McpCli, name: string) => Promise<void>;
  healthCheck: (server: McpServerInput) => Promise<McpHealth>;
}

/**
 * Subscribes to the shared MCP store and exposes the CRUD commands. Every
 * mutation re-lists from the backend so the UI reflects what is actually on
 * disk (the backend may rename, dedupe, or reject).
 */
export function useMcp(): UseMcpResult {
  const snapshot = useSyncExternalStore(
    mcpStore.subscribe,
    mcpStore.getSnapshot,
    mcpStore.getSnapshot,
  );

  useEffect(() => {
    void mcpStore.ensureLoaded();
  }, []);

  const refresh = useCallback(() => mcpStore.refresh(), []);

  const addServer = useCallback(async (cli: McpCli, server: McpServerInput) => {
    await invoke("add_mcp_server", { cli, server });
    await mcpStore.refresh();
  }, []);

  const updateServer = useCallback(
    async (cli: McpCli, name: string, server: McpServerInput) => {
      await invoke("update_mcp_server", { cli, name, server });
      await mcpStore.refresh();
    },
    [],
  );

  const removeServer = useCallback(async (cli: McpCli, name: string) => {
    await invoke("remove_mcp_server", { cli, name });
    await mcpStore.refresh();
  }, []);

  const healthCheck = useCallback(async (server: McpServerInput) => {
    const raw = await invoke<unknown>("mcp_health_check", { server });
    return McpHealthSchema.parse(raw);
  }, []);

  return {
    ...snapshot,
    refresh,
    addServer,
    updateServer,
    removeServer,
    healthCheck,
  };
}
