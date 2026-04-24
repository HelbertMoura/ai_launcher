import { describe, it, expect, beforeEach } from "vitest";
import {
  loadProfiles,
  addProfile,
  removeProfile,
  updateProfile,
  togglePin,
  generateProfileId,
  exportProfiles,
  importProfiles,
} from "./profileStore";
import type { LaunchProfile } from "./types";

function makeProfile(overrides: Partial<LaunchProfile> = {}): LaunchProfile {
  const now = new Date().toISOString();
  return {
    id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: "Test profile",
    cliKeys: ["claude"],
    toolKeys: [],
    tags: [],
    pinned: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("profileStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts empty after migration with no legacy data", () => {
    expect(loadProfiles()).toEqual([]);
  });

  it("adds a profile and persists it", () => {
    const profile = makeProfile();
    const result = addProfile([], profile);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(profile.id);
    expect(loadProfiles()).toHaveLength(1);
  });

  it("removes a profile by id", () => {
    const a = makeProfile({ id: "a" });
    const b = makeProfile({ id: "b" });
    addProfile([], a);
    const list = addProfile(loadProfiles(), b);
    const result = removeProfile(list, "a");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("b");
  });

  it("updates a profile by id", () => {
    const profile = makeProfile({ id: "p1", name: "original" });
    addProfile([], profile);
    const list = loadProfiles();
    const updated = updateProfile(list, "p1", { name: "changed" });
    expect(updated[0].name).toBe("changed");
    expect(updated[0].updatedAt).toBeTruthy();
  });

  it("toggles pin status", () => {
    const profile = makeProfile({ id: "p1", pinned: false });
    addProfile([], profile);
    const list = loadProfiles();
    const toggled = togglePin(list, "p1");
    expect(toggled[0].pinned).toBe(true);
    const toggledBack = togglePin(toggled, "p1");
    expect(toggledBack[0].pinned).toBe(false);
  });

  it("generates unique ids", () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateProfileId()));
    expect(ids.size).toBe(20);
  });

  it("exports profiles as JSON", () => {
    const profile = makeProfile();
    addProfile([], profile);
    const json = exportProfiles(loadProfiles());
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe(profile.id);
  });

  it("imports profiles merging by id", () => {
    const a = makeProfile({ id: "a" });
    const b = makeProfile({ id: "b" });
    addProfile([], a);
    const list = loadProfiles();
    const result = importProfiles(list, JSON.stringify([b]));
    expect(result).toHaveLength(2);
  });

  it("import deduplicates by id", () => {
    const a = makeProfile({ id: "a" });
    addProfile([], a);
    const list = loadProfiles();
    const result = importProfiles(list, JSON.stringify([a]));
    expect(result).toHaveLength(1);
  });

  it("import returns null on invalid JSON", () => {
    const result = importProfiles([], "not json");
    expect(result).toBeNull();
  });
});

describe("profileMigration", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("migrates legacy presets to profiles", () => {
    const legacyPreset = {
      id: "preset-1",
      name: "My preset",
      cliKey: "claude",
      providerId: "anthropic",
      directory: "C:\\project",
      args: "--model opus",
      noPerms: true,
      color: "#FF0000",
      emoji: "rocket",
      createdAt: "2025-01-01T00:00:00.000Z",
    };
    localStorage.setItem("ai-launcher-presets", JSON.stringify([legacyPreset]));

    const profiles = loadProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].id).toBe("preset-1");
    expect(profiles[0].name).toBe("My preset");
    expect(profiles[0].cliKeys).toEqual(["claude"]);
    expect(profiles[0].providerKey).toBe("anthropic");
    expect(profiles[0].directory).toBe("C:\\project");
    expect(profiles[0].tags).toEqual(["rocket"]);
  });

  it("migrates legacy templates to profiles", () => {
    const legacyTemplate = {
      id: "tpl-1",
      name: "My template",
      cliKey: "codex",
      cliName: "Codex",
      directory: "/home/project",
      args: "",
      noPerms: false,
      providerId: null,
      createdAt: "2025-02-01T00:00:00.000Z",
    };
    localStorage.setItem(
      "ai-launcher:session-templates",
      JSON.stringify([legacyTemplate]),
    );

    const profiles = loadProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].id).toBe("tpl-1");
    expect(profiles[0].cliKeys).toEqual(["codex"]);
    expect(profiles[0].noPerms).toBe(false);
  });

  it("deduplicates presets over templates by id", () => {
    const shared = { id: "shared-1" };
    const preset = {
      ...shared,
      name: "From preset",
      cliKey: "claude",
      providerId: undefined,
      directory: "C:\\a",
      args: "",
      noPerms: true,
      createdAt: "2025-01-01T00:00:00.000Z",
    };
    const template = {
      ...shared,
      name: "From template",
      cliKey: "claude",
      cliName: "Claude",
      directory: "C:\\a",
      args: "",
      noPerms: true,
      providerId: null,
      createdAt: "2025-01-01T00:00:00.000Z",
    };
    localStorage.setItem("ai-launcher-presets", JSON.stringify([preset]));
    localStorage.setItem(
      "ai-launcher:session-templates",
      JSON.stringify([template]),
    );

    const profiles = loadProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe("From preset");
  });

  it("backs up legacy data before migration", () => {
    const preset = {
      id: "p1",
      name: "test",
      cliKey: "claude",
      providerId: undefined,
      directory: "C:\\a",
      args: "",
      noPerms: true,
      createdAt: "2025-01-01T00:00:00.000Z",
    };
    localStorage.setItem("ai-launcher-presets", JSON.stringify([preset]));

    loadProfiles();

    const bak = localStorage.getItem("ai-launcher-presets.bak");
    expect(bak).toBeTruthy();
    expect(JSON.parse(bak!)).toHaveLength(1);
  });

  it("only migrates once", () => {
    const preset = {
      id: "p1",
      name: "test",
      cliKey: "claude",
      providerId: undefined,
      directory: "C:\\a",
      args: "",
      noPerms: true,
      createdAt: "2025-01-01T00:00:00.000Z",
    };
    localStorage.setItem("ai-launcher-presets", JSON.stringify([preset]));

    loadProfiles();
    // Second load should not re-migrate
    localStorage.removeItem("ai-launcher-presets");
    const profiles2 = loadProfiles();
    expect(profiles2).toHaveLength(1);
  });
});
