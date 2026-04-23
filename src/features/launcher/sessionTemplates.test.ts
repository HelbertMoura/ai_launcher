import { describe, it, expect, beforeEach } from "vitest";
import {
  getTemplates,
  getTemplatesForCli,
  saveTemplate,
  deleteTemplate,
} from "./sessionTemplates";

describe("session templates", () => {
  beforeEach(() => localStorage.clear());

  it("starts empty", () => {
    expect(getTemplates()).toEqual([]);
  });

  it("saves and returns a template with id + createdAt", () => {
    const t = saveTemplate({
      name: "My project",
      cliKey: "claude",
      cliName: "Claude",
      directory: "C:\\a",
      args: "-p hello",
      noPerms: true,
      providerId: "anthropic",
    });
    expect(t.id).toBeTruthy();
    expect(t.createdAt).toMatch(/^\d{4}/);
    expect(getTemplates()).toHaveLength(1);
  });

  it("newest template first", () => {
    saveTemplate({
      name: "a",
      cliKey: "claude",
      cliName: "Claude",
      directory: "C:\\a",
      args: "",
      noPerms: true,
      providerId: null,
    });
    saveTemplate({
      name: "b",
      cliKey: "claude",
      cliName: "Claude",
      directory: "C:\\b",
      args: "",
      noPerms: true,
      providerId: null,
    });
    expect(getTemplates()[0].name).toBe("b");
  });

  it("filters by cliKey", () => {
    saveTemplate({
      name: "x",
      cliKey: "claude",
      cliName: "Claude",
      directory: "C:\\a",
      args: "",
      noPerms: true,
      providerId: null,
    });
    saveTemplate({
      name: "y",
      cliKey: "codex",
      cliName: "Codex",
      directory: "C:\\b",
      args: "",
      noPerms: true,
      providerId: null,
    });
    expect(getTemplatesForCli("claude")).toHaveLength(1);
    expect(getTemplatesForCli("codex")).toHaveLength(1);
  });

  it("deletes by id", () => {
    const t = saveTemplate({
      name: "x",
      cliKey: "claude",
      cliName: "Claude",
      directory: "C:\\a",
      args: "",
      noPerms: true,
      providerId: null,
    });
    deleteTemplate(t.id);
    expect(getTemplates()).toEqual([]);
  });
});
