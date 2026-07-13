import { expect, type Page } from "@playwright/test";

type TauriResultMap = {
  get_all_clis: unknown[];
  check_clis: unknown[];
  get_all_tools: unknown[];
  check_tools: unknown[];
  check_environment: unknown[];
  list_active_sessions: unknown[];
  list_mcp_servers: unknown[];
  mcp_health_check: { ok: boolean; detail: string };
  read_project_profile: null;
  scan_project_stack: { files: string[]; manifests: Record<string, string> };
  write_project_profile: null;
  check_all_updates: {
    cli_updates: unknown[];
    tool_updates: unknown[];
    env_updates: unknown[];
    checked_at: string;
    total_with_updates: number;
  };
  check_app_update: {
    update_available: boolean;
    version: string;
    current_version: string;
    release_notes_url: string;
    release_notes_body: string;
  };
  read_usage_stats: { entries: unknown[] };
  has_secure_storage: boolean;
  store_secret: { stored: boolean; backend: string; migratedLegacy: boolean };
  get_secret: string | null;
  delete_secret: boolean;
  test_provider_connection: { ok: boolean; latencyMs?: number; message?: string };
  evaluate_runbook_condition: { ok: boolean; message: string };
  run_runbook_step: { ok: boolean; exit_code: number | null; stdout: string; stderr: string; timed_out: boolean };
  stop_runbook_execution: boolean;
  launch_cli: { session_id: string; message: string };
  launch_custom_cli: { session_id: string; message: string };
  kill_session: boolean;
  add_mcp_server: null;
  update_mcp_server: null;
  remove_mcp_server: null;
  update_cli: null;
  update_all_clis: null;
  install_cli: null;
  install_tool: null;
  install_prerequisite: null;
  download_verified_app_update: { version: string; asset_name: string };
};

export type StubbedTauriCommand = keyof TauriResultMap;
export type TauriStubFailure = { __error: string };
export type TauriStubOverrides = Partial<{
  [K in StubbedTauriCommand]: TauriResultMap[K] | TauriStubFailure;
}>;

interface TauriStubOptions {
  onboardingDone?: boolean;
  responses?: TauriStubOverrides;
}

const DEFAULT_RESPONSES: TauriResultMap = {
  get_all_clis: [],
  check_clis: [],
  get_all_tools: [],
  check_tools: [],
  check_environment: [],
  list_active_sessions: [],
  list_mcp_servers: [],
  mcp_health_check: { ok: true, detail: "stubbed health check" },
  read_project_profile: null,
  scan_project_stack: { files: [], manifests: {} },
  write_project_profile: null,
  check_all_updates: {
    cli_updates: [], tool_updates: [], env_updates: [],
    checked_at: "2026-07-13T12:00:00.000Z", total_with_updates: 0,
  },
  check_app_update: {
    update_available: false, version: "20.0.0", current_version: "20.0.0",
    release_notes_url: "", release_notes_body: "",
  },
  read_usage_stats: { entries: [] },
  has_secure_storage: false,
  store_secret: { stored: true, backend: "windows-credential-manager", migratedLegacy: false },
  get_secret: null,
  delete_secret: true,
  test_provider_connection: { ok: true, latencyMs: 42 },
  evaluate_runbook_condition: { ok: true, message: 'condition passed' },
  run_runbook_step: { ok: true, exit_code: 0, stdout: 'stubbed runbook output', stderr: '', timed_out: false },
  stop_runbook_execution: true,
  launch_cli: { session_id: "session-e2e", message: "stubbed launch" },
  launch_custom_cli: { session_id: "custom-session-e2e", message: "stubbed custom launch" },
  kill_session: true,
  add_mcp_server: null,
  update_mcp_server: null,
  remove_mcp_server: null,
  update_cli: null,
  update_all_clis: null,
  install_cli: null,
  install_tool: null,
  install_prerequisite: null,
  download_verified_app_update: { version: "21.0.0", asset_name: "AI Launcher Pro_21.0.0_x64-setup.exe" },
};

export async function installTauriStub(
  page: Page,
  options: TauriStubOptions = {},
): Promise<void> {
  await page.addInitScript(
    ({ onboardingDone, responses }) => {
      if (onboardingDone) {
        localStorage.setItem("ai-launcher:onboarding-done", "true");
      } else {
        localStorage.removeItem("ai-launcher:onboarding-done");
      }

      const unknownCommands: string[] = [];
      const callbacks = new Map<number, (...args: unknown[]) => unknown>();
      let nextCallbackId = 1;
      Object.defineProperty(window, "__UNKNOWN_TAURI_COMMANDS__", {
        configurable: true,
        value: unknownCommands,
      });

      Object.defineProperty(window, "__TAURI_INTERNALS__", {
        configurable: true,
        value: {
          transformCallback: (
            callback: (...args: unknown[]) => unknown,
            once = false,
          ) => {
            const id = nextCallbackId++;
            callbacks.set(id, (...args: unknown[]) => {
              const result = callback(...args);
              if (once) callbacks.delete(id);
              return result;
            });
            return id;
          },
          unregisterCallback: (id: number) => callbacks.delete(id),
          invoke: async (command: string) => {
            if (command === "plugin:event|listen") return nextCallbackId++;
            if (command === "plugin:event|unlisten") return null;
            if (command.startsWith("plugin:")) return null;
            if (Object.prototype.hasOwnProperty.call(responses, command)) {
              const response = responses[command];
              if (
                response &&
                typeof response === "object" &&
                "__error" in response
              ) {
                throw new Error(String(response.__error));
              }
              return response;
            }
            unknownCommands.push(command);
            throw new Error(`Unhandled Tauri command in E2E stub: ${command}`);
          },
        },
      });

      Object.defineProperty(window, "__TAURI_EVENT_PLUGIN_INTERNALS__", {
        configurable: true,
        value: {
          unregisterListener: () => undefined,
        },
      });
    },
    {
      onboardingDone: options.onboardingDone ?? true,
      responses: { ...DEFAULT_RESPONSES, ...options.responses },
    },
  );
}

export async function expectNoUnknownTauriCommands(page: Page): Promise<void> {
  const commands = await page.evaluate(
    () =>
      (window as Window & { __UNKNOWN_TAURI_COMMANDS__?: string[] })
        .__UNKNOWN_TAURI_COMMANDS__ ?? [],
  );
  expect(commands, `Missing explicit Tauri E2E stubs: ${commands.join(", ")}`).toEqual([]);
}
