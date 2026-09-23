import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invokeOrFallbackMock = vi.hoisted(() => vi.fn());

vi.mock("../../lib/tauri", () => ({
  invokeOrFallback: invokeOrFallbackMock,
}));

import i18n from "../../i18n";
import type { McpServer } from "./types";

/**
 * The MCP store keeps module-level state, so every test pulls a fresh module
 * instance (vi.resetModules) instead of sharing a dirty singleton.
 */
async function freshStore() {
  vi.resetModules();
  const module = await import("./mcpStore");
  return module.mcpStore;
}

const SERVER: McpServer = {
  name: "filesystem",
  cli: "codex",
  transport: "stdio",
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-filesystem"],
  headers_keys: [],
  env_keys: [],
  enabled: true,
};

beforeEach(() => {
  invokeOrFallbackMock.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("mcpStore error surfacing", () => {
  it("contract drift shows the friendly config error, not raw Zod JSON", async () => {
    invokeOrFallbackMock.mockResolvedValue([SERVER]); // legacy array payload

    const store = await freshStore();
    await store.ensureLoaded();

    const s = store.getSnapshot();
    expect(s.loading).toBe(false);
    expect(s.error).toBe(i18n.t("mcp.configError"));
    expect(s.error).not.toContain("[");
    expect(s.error).not.toContain("expected");
    // Technical detail goes to the console for debugging, never to the UI.
    expect(console.warn).toHaveBeenCalledTimes(1);
    const firstWarn = vi.mocked(console.warn).mock.calls[0]?.[0];
    expect(String(firstWarn)).toContain("[mcp]");
  });

  it("invoke failures show the friendly config error with the cause logged", async () => {
    invokeOrFallbackMock.mockRejectedValue(new Error("Falha ao ler config"));

    const store = await freshStore();
    await store.ensureLoaded();

    const s = store.getSnapshot();
    expect(s.loading).toBe(false);
    expect(s.error).toBe(i18n.t("mcp.configError"));
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("a valid payload still loads servers with no error", async () => {
    invokeOrFallbackMock.mockResolvedValue({ servers: [SERVER], warnings: [] });

    const store = await freshStore();
    await store.ensureLoaded();

    const s = store.getSnapshot();
    expect(s.error).toBeNull();
    expect(s.servers).toEqual([SERVER]);
    expect(s.warnings).toEqual([]);
  });
});
