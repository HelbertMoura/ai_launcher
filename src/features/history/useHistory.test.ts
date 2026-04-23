import { describe, it, expect, beforeEach } from "vitest";
import { getRecentDirs, addRecentDir } from "./useHistory";

describe("recent dirs", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns empty array when nothing stored", () => {
    expect(getRecentDirs("claude")).toEqual([]);
  });

  it("adds and retrieves a directory", () => {
    addRecentDir("claude", "C:\\projects\\foo");
    expect(getRecentDirs("claude")).toEqual(["C:\\projects\\foo"]);
  });

  it("keeps scopes separate per cliKey", () => {
    addRecentDir("claude", "C:\\a");
    addRecentDir("codex", "C:\\b");
    expect(getRecentDirs("claude")).toEqual(["C:\\a"]);
    expect(getRecentDirs("codex")).toEqual(["C:\\b"]);
  });

  it("places newest at position 0 (LRU order)", () => {
    addRecentDir("claude", "C:\\a");
    addRecentDir("claude", "C:\\b");
    addRecentDir("claude", "C:\\c");
    expect(getRecentDirs("claude")).toEqual(["C:\\c", "C:\\b", "C:\\a"]);
  });

  it("deduplicates same directory by moving it to top", () => {
    addRecentDir("claude", "C:\\a");
    addRecentDir("claude", "C:\\b");
    addRecentDir("claude", "C:\\a");
    expect(getRecentDirs("claude")).toEqual(["C:\\a", "C:\\b"]);
  });

  it("caps at 10 entries, keeping most recent", () => {
    for (let i = 0; i < 15; i++) addRecentDir("claude", `C:\\dir${i}`);
    const result = getRecentDirs("claude");
    expect(result).toHaveLength(10);
    expect(result[0]).toBe("C:\\dir14");
    expect(result[9]).toBe("C:\\dir5");
  });
});
