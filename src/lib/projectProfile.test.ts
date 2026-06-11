import { describe, it, expect } from "vitest";
import {
  parseProjectProfile,
  mergeLaunchEnv,
  projectProfileSchema,
} from "./projectProfile";

describe("parseProjectProfile", () => {
  it("parses a full valid profile", () => {
    const raw = JSON.stringify({
      version: 1,
      cli: "claude",
      provider: "prov-1",
      env: { FOO: "bar", API_TIMEOUT_MS: "60000" },
      directory: "C:/projects/app",
      mcp: ["github", "filesystem"],
      runbook: "rb-1",
    });
    const res = parseProjectProfile(raw);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.profile.cli).toBe("claude");
      expect(res.profile.provider).toBe("prov-1");
      expect(res.profile.env).toEqual({ FOO: "bar", API_TIMEOUT_MS: "60000" });
      expect(res.profile.directory).toBe("C:/projects/app");
      expect(res.profile.mcp).toEqual(["github", "filesystem"]);
      expect(res.profile.runbook).toBe("rb-1");
    }
  });

  it("defaults version to 1 when omitted", () => {
    const res = parseProjectProfile(JSON.stringify({ cli: "codex" }));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.profile.version).toBe(1);
      expect(res.profile.cli).toBe("codex");
    }
  });

  it("accepts an empty object (all fields optional except version default)", () => {
    const res = parseProjectProfile("{}");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.profile.version).toBe(1);
  });

  it("preserves unknown keys via passthrough", () => {
    const res = parseProjectProfile(
      JSON.stringify({ cli: "claude", futureField: "x" }),
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect((res.profile as Record<string, unknown>).futureField).toBe("x");
    }
  });

  it("fails on invalid JSON", () => {
    const res = parseProjectProfile("{ not json");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.length).toBeGreaterThan(0);
  });

  it("fails when env values are not strings", () => {
    const res = parseProjectProfile(JSON.stringify({ env: { FOO: 123 } }));
    expect(res.ok).toBe(false);
  });

  it("fails when cli is an empty string", () => {
    const res = parseProjectProfile(JSON.stringify({ cli: "" }));
    expect(res.ok).toBe(false);
  });

  it("fails when version is zero or negative", () => {
    expect(parseProjectProfile(JSON.stringify({ version: 0 })).ok).toBe(false);
    expect(parseProjectProfile(JSON.stringify({ version: -3 })).ok).toBe(false);
  });

  it("fails when mcp is not an array of strings", () => {
    const res = parseProjectProfile(JSON.stringify({ mcp: [1, 2] }));
    expect(res.ok).toBe(false);
  });

  it("schema is exported and usable directly", () => {
    const parsed = projectProfileSchema.safeParse({ cli: "claude" });
    expect(parsed.success).toBe(true);
  });
});

describe("mergeLaunchEnv", () => {
  it("merges with precedence project > workspace > default", () => {
    const result = mergeLaunchEnv(
      { A: "default", B: "default", C: "default" },
      { B: "workspace", C: "workspace" },
      { C: "project" },
    );
    expect(result).toEqual({
      A: "default", // only in default
      B: "workspace", // workspace overrides default
      C: "project", // project overrides both
    });
  });

  it("project overrides workspace which overrides default for the same key", () => {
    expect(
      mergeLaunchEnv({ K: "d" }, { K: "w" }, { K: "p" }).K,
    ).toBe("p");
    expect(mergeLaunchEnv({ K: "d" }, { K: "w" }).K).toBe("w");
    expect(mergeLaunchEnv({ K: "d" }).K).toBe("d");
  });

  it("treats undefined/null sources as empty", () => {
    expect(mergeLaunchEnv(undefined, undefined, undefined)).toEqual({});
    expect(mergeLaunchEnv(null, null, null)).toEqual({});
    expect(mergeLaunchEnv({ A: "1" }, null, undefined)).toEqual({ A: "1" });
    expect(mergeLaunchEnv(undefined, { B: "2" }, null)).toEqual({ B: "2" });
    expect(mergeLaunchEnv(null, undefined, { C: "3" })).toEqual({ C: "3" });
  });

  it("does not mutate any input source", () => {
    const def = { A: "default" };
    const ws = { A: "workspace" };
    const proj = { B: "project" };
    const result = mergeLaunchEnv(def, ws, proj);
    expect(def).toEqual({ A: "default" });
    expect(ws).toEqual({ A: "workspace" });
    expect(proj).toEqual({ B: "project" });
    expect(result).not.toBe(def);
    expect(result).not.toBe(ws);
    expect(result).not.toBe(proj);
  });

  it("returns an empty object when all sources are empty", () => {
    expect(mergeLaunchEnv({}, {}, {})).toEqual({});
  });
});
