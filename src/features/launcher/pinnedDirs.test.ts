import { describe, it, expect, beforeEach } from "vitest";
import { getPinnedDirs, pinDir, unpinDir, isPinned, MAX_PINS } from "./pinnedDirs";

describe("pinned dirs", () => {
  beforeEach(() => localStorage.clear());

  it("starts empty", () => {
    expect(getPinnedDirs("claude")).toEqual([]);
  });

  it("pins and reads back", () => {
    expect(pinDir("claude", "C:\\a")).toBe(true);
    expect(getPinnedDirs("claude")).toEqual(["C:\\a"]);
  });

  it("prevents duplicates and returns false", () => {
    pinDir("claude", "C:\\a");
    expect(pinDir("claude", "C:\\a")).toBe(false);
    expect(getPinnedDirs("claude")).toHaveLength(1);
  });

  it("caps at MAX_PINS", () => {
    for (let i = 0; i < 5; i++) pinDir("claude", `C:\\d${i}`);
    expect(getPinnedDirs("claude")).toHaveLength(MAX_PINS);
  });

  it("unpins specific dir", () => {
    pinDir("claude", "C:\\a");
    pinDir("claude", "C:\\b");
    unpinDir("claude", "C:\\a");
    expect(getPinnedDirs("claude")).toEqual(["C:\\b"]);
    expect(isPinned("claude", "C:\\a")).toBe(false);
    expect(isPinned("claude", "C:\\b")).toBe(true);
  });

  it("scopes pins per cliKey", () => {
    pinDir("claude", "C:\\x");
    pinDir("codex", "C:\\y");
    expect(getPinnedDirs("claude")).toEqual(["C:\\x"]);
    expect(getPinnedDirs("codex")).toEqual(["C:\\y"]);
  });
});
