import { describe, expect, it } from "vitest";
import { detectProjectStacks } from "./stackDetector";

describe("detectProjectStacks", () => {
  it("detects a Tauri React workspace with high confidence", () => {
    const scan = detectProjectStacks({
      files: [
        "package.json",
        "vite.config.ts",
        "src/App.tsx",
        "src-tauri/tauri.conf.json",
        "src-tauri/Cargo.toml",
      ],
      manifests: {
        "package.json": JSON.stringify({
          dependencies: {
            react: "^18.0.0",
            "@tauri-apps/api": "^2.0.0",
          },
          devDependencies: {
            vite: "^5.0.0",
          },
        }),
      },
    });

    expect(scan.primary?.id).toBe("tauri");
    expect(scan.primary?.confidence).toBe("high");
    expect(scan.stacks.map((stack) => stack.id)).toEqual(
      expect.arrayContaining(["tauri", "react-vite", "node", "rust"]),
    );
    expect(scan.profileHints.cli).toBe("claude");
    expect(scan.profileHints.runbook).toBe("tauri-setup");
  });

  it("detects Python projects from standard files", () => {
    const scan = detectProjectStacks({
      files: ["pyproject.toml", "requirements.txt"],
    });

    expect(scan.primary).toMatchObject({
      id: "python",
      confidence: "high",
    });
    expect(scan.profileHints.tags).toContain("python");
  });

  it("detects Docker compose projects", () => {
    const scan = detectProjectStacks({
      files: ["Dockerfile", "compose.yaml"],
    });

    expect(scan.primary).toMatchObject({
      id: "docker",
      confidence: "high",
    });
    expect(scan.primary?.evidence).toEqual(["Dockerfile", "compose"]);
  });

  it("honors .ailauncher.json hints when present", () => {
    const scan = detectProjectStacks({
      files: [".ailauncher.json", ".mcp.json"],
      manifests: {
        ".ailauncher.json": JSON.stringify({
          version: 1,
          cli: "codex",
          runbook: "custom-setup",
          mcp: ["filesystem"],
        }),
      },
    });

    expect(scan.profileHints.cli).toBe("codex");
    expect(scan.profileHints.runbook).toBe("custom-setup");
    expect(scan.stacks.map((stack) => stack.id)).toEqual(["mcp", "ailauncher"]);
  });

  it("returns an empty scan when no signals are present", () => {
    const scan = detectProjectStacks({ files: [] });

    expect(scan.stacks).toEqual([]);
    expect(scan.primary).toBeUndefined();
    expect(scan.profileHints).toEqual({ cli: undefined, runbook: undefined, tags: [] });
  });
});
