import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

async function loadModule() {
  vi.resetModules();
  return import("./secrets");
}

function setTauriRuntime(enabled: boolean): void {
  if (enabled) {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });
  } else {
    Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
  }
}

describe("secure secrets boundary", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    localStorage.clear();
    setTauriRuntime(false);
  });

  it("uses memory-only storage in browser development", async () => {
    const { getSecret, storeSecret } = await loadModule();

    await storeSecret("provider-apikey:test", "sk-browser");

    expect(await getSecret("provider-apikey:test")).toBe("sk-browser");
    expect(localStorage.length).toBe(0);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("fails closed when packaged secure storage is unavailable", async () => {
    setTauriRuntime(true);
    invokeMock.mockResolvedValueOnce(false);
    const { storeSecret } = await loadModule();

    await expect(
      storeSecret("provider-apikey:test", "sk-must-not-leak"),
    ).rejects.toThrow("Secure credential storage is unavailable");
    expect(localStorage.length).toBe(0);
  });

  it("rejects an unapproved backend result", async () => {
    setTauriRuntime(true);
    invokeMock
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce({
        stored: true,
        backend: "base64-file",
        migratedLegacy: false,
      });
    const { storeSecret } = await loadModule();

    await expect(
      storeSecret("provider-apikey:test", "sk-must-not-leak"),
    ).rejects.toThrow("approved secure backend");
    expect(localStorage.length).toBe(0);
  });

  it("accepts a verified Windows Credential Manager write", async () => {
    setTauriRuntime(true);
    invokeMock
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce({
        stored: true,
        backend: "windows-credential-manager",
        migratedLegacy: false,
      });
    const { storeSecret } = await loadModule();

    await expect(
      storeSecret("provider-apikey:test", "sk-secure"),
    ).resolves.toBeUndefined();
    expect(localStorage.length).toBe(0);
    expect(invokeMock).toHaveBeenLastCalledWith("store_secret", {
      key: "provider-apikey:test",
      value: "sk-secure",
    });
  });
});
