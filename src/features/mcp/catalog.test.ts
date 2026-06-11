import { describe, it, expect } from "vitest";
import {
  MCP_CATALOG,
  findCatalogEntry,
  isCatalogEntryValid,
} from "./catalog";
import { isValidMcpName } from "./types";

describe("MCP catalog", () => {
  it("has a reasonable number of entries", () => {
    expect(MCP_CATALOG.length).toBeGreaterThanOrEqual(8);
    expect(MCP_CATALOG.length).toBeLessThanOrEqual(20);
  });

  it("every entry has a unique id and name", () => {
    const ids = new Set(MCP_CATALOG.map((e) => e.id));
    const names = new Set(MCP_CATALOG.map((e) => e.name));
    expect(ids.size).toBe(MCP_CATALOG.length);
    expect(names.size).toBe(MCP_CATALOG.length);
  });

  it("every entry name passes the backend name gate", () => {
    for (const entry of MCP_CATALOG) {
      expect(isValidMcpName(entry.name)).toBe(true);
    }
  });

  it("every entry is internally consistent for its transport", () => {
    for (const entry of MCP_CATALOG) {
      expect(isCatalogEntryValid(entry)).toBe(true);
    }
  });

  it("stdio entries carry a command; http entries carry a url", () => {
    for (const entry of MCP_CATALOG) {
      if (entry.transport === "stdio") {
        expect(entry.command, entry.id).toBeTruthy();
      } else {
        expect(entry.url, entry.id).toBeTruthy();
      }
    }
  });

  it("includes the expected popular servers", () => {
    const ids = MCP_CATALOG.map((e) => e.id);
    for (const expected of [
      "context7",
      "github",
      "playwright",
      "filesystem",
      "fetch",
      "sequential-thinking",
      "memory",
    ]) {
      expect(ids).toContain(expected);
    }
  });

  it("findCatalogEntry resolves a known id and returns undefined otherwise", () => {
    expect(findCatalogEntry("context7")?.name).toBe("context7");
    expect(findCatalogEntry("does-not-exist")).toBeUndefined();
  });

  it("rejects an entry with an invalid name", () => {
    expect(
      isCatalogEntryValid({
        id: "bad",
        name: "bad name",
        label: "Bad",
        description: "x",
        transport: "stdio",
        command: "npx",
      }),
    ).toBe(false);
  });

  it("rejects a stdio entry without a command", () => {
    expect(
      isCatalogEntryValid({
        id: "nocmd",
        name: "nocmd",
        label: "No Cmd",
        description: "x",
        transport: "stdio",
      }),
    ).toBe(false);
  });
});
