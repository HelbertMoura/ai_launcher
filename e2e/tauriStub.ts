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
  race_start: {
    race_id: string;
    directory: string;
    base_sha: string;
    agents: string[];
    branches: string[];
    worktrees: string[];
    warnings: string[];
    started_at: string;
  };
  race_status: {
    race_id: string;
    directory: string;
    status: string;
    base_sha: string;
    started_at: string;
    warnings: string[];
    agents: Array<{
      agent: string;
      status: string;
      pid: number | null;
      exit_code: number | null;
      duration_secs: number | null;
      last_log_lines: string[];
    }>;
  };
  race_cancel: null;
  race_diff: {
    agent: string;
    files: Array<{ path: string; adds: number | null; dels: number | null }>;
    total_adds: number;
    total_dels: number;
    patch: string;
    truncated: boolean;
  };
  race_adopt: {
    mode: string;
    ok: boolean;
    branch: string | null;
    conflicts: Array<{ path: string; reason: string }>;
    message: string;
  };
  race_cleanup: {
    race_id: string;
    removed_worktrees: string[];
    removed_branches: string[];
    pruned: boolean;
    skipped_reason: string | null;
  };
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
  has_secure_storage: true,
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
  // race_start/race_status/race_cancel/race_diff/race_adopt/race_cleanup stay
  // out of the defaults on purpose: a present key would bypass the
  // deterministic fake race below.
  add_mcp_server: null,
  update_mcp_server: null,
  remove_mcp_server: null,
  update_cli: null,
  update_all_clis: null,
  install_cli: null,
  install_tool: null,
  install_prerequisite: null,
  download_verified_app_update: { version: "22.0.0", asset_name: "AI Launcher Pro_22.0.0_x64-setup.exe" },
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

      // --- Deterministic fake race (v23.2 Race surface) -------------------
      // Two-agent race with fixed state transitions: every `race_status`
      // poll bumps a counter; the snapshot flips to "completed" after the
      // tunable flip count (localStorage `ai-launcher:e2e-race-flip-after`,
      // default 3). `race_cancel` flips the fake to "cancelled" and the
      // next poll reports killed agents. `race_diff` returns a fixed two-file
      // unified patch; `race_adopt` flips the fake to "adopted" and
      // `race_cleanup` to "cleaned". Each branch below only runs when the
      // responses map carries NO explicit override, so specs can still force
      // raw failures (`__error`) or static payloads per command.
      let racePhase: "idle" | "running" | "cancelled" | "adopted" | "cleaned" = "idle";
      let racePollCount = 0;
      const RACE_ID = "race-e2e-1";
      const RACE_NOW = "2026-09-22T10:00:00.000Z";
      const raceAgents = (raw: unknown): string[] => {
        const list = Array.isArray(raw) ? raw.map(String) : [];
        return list.length > 0 ? list : ["claude", "codex"];
      };
      let raceDir = "C:/proj";
      let raceAgentKeys: string[] = ["claude", "codex"];
      const fakeRaceSnapshot = (status: string) => ({
        race_id: RACE_ID,
        directory: raceDir,
        status,
        base_sha: "e2ebase0000000000000000000000000000000000",
        started_at: RACE_NOW,
        warnings: ["stub: worktree dependencies are not inherited"],
        agents: raceAgentKeys.map((agent, i) => {
          if (status === "running") {
            return {
              agent,
              status: "running",
              pid: 4200 + i,
              exit_code: null,
              duration_secs: racePollCount * 2,
              last_log_lines: ["[stub] analyzing workspace", "[stub] editing files"],
            };
          }
          if (status === "cancelled") {
            return {
              agent,
              status: "killed",
              pid: null,
              exit_code: null,
              duration_secs: racePollCount * 2,
              last_log_lines: ["[stub] terminated by user"],
            };
          }
          return {
            agent,
            status: "completed",
            pid: null,
            exit_code: 0,
            duration_secs: 12,
            last_log_lines: ["[stub] task finished"],
          };
        }),
      });
      const fakeDiffPatch = (agent: string): string =>
        [
          "diff --git a/src/parser.ts b/src/parser.ts",
          "index 1111111..2222222 100644",
          "--- a/src/parser.ts",
          "+++ b/src/parser.ts",
          "@@ -1,3 +1,4 @@",
          "const start = 1;",
          "-const old = 2;",
          "+const next = 2;",
          "+const extra = 3;",
          "const end = 4;",
          "diff --git a/README.md b/README.md",
          "index 3333333..4444444 100644",
          "--- a/README.md",
          "+++ b/README.md",
          "@@ -1 +1,2 @@",
          "# stub project",
          `+updated by ${agent}`,
        ].join("\n");
      const runFakeRaceCommand = (
        command: string,
        args?: Record<string, unknown>,
      ): unknown => {
        if (command === "race_start") {
          racePhase = "running";
          racePollCount = 0;
          raceAgentKeys = raceAgents(args?.agents);
          raceDir = typeof args?.directory === "string" ? args.directory : raceDir;
          return {
            race_id: RACE_ID,
            directory: raceDir,
            base_sha: "e2ebase0000000000000000000000000000000000",
            agents: raceAgentKeys,
            branches: raceAgentKeys.map((a) => `race/${RACE_ID}/${a}`),
            worktrees: raceAgentKeys.map((a) => `C:/races/${RACE_ID}/${a}`),
            warnings: ["stub: worktree dependencies are not inherited"],
            started_at: RACE_NOW,
          };
        }
        if (command === "race_cancel") {
          racePhase = "cancelled";
          return null;
        }
        if (command === "race_diff") {
          const agent = typeof args?.agent === "string" ? args.agent : raceAgentKeys[0];
          return {
            agent,
            files: [
              { path: "src/parser.ts", adds: 12, dels: 3 },
              { path: "README.md", adds: 2, dels: 1 },
            ],
            total_adds: 14,
            total_dels: 4,
            patch: fakeDiffPatch(agent),
            truncated: false,
          };
        }
        if (command === "race_adopt") {
          const mode = args?.mode === "apply" ? "apply" : "branch";
          const agent = typeof args?.agent === "string" ? args.agent : raceAgentKeys[0];
          racePhase = "adopted";
          return {
            mode,
            ok: true,
            branch:
              mode === "branch" ? `race-adopted/${agent}-${RACE_ID.slice(0, 8)}` : null,
            conflicts: [],
            message:
              mode === "branch"
                ? `Adoption branch created for ${agent}; your working tree was not touched.`
                : `Patch from ${agent} applied to the main directory.`,
          };
        }
        if (command === "race_cleanup") {
          racePhase = "cleaned";
          return {
            race_id: RACE_ID,
            removed_worktrees: raceAgentKeys.map((a) => `C:/races/${RACE_ID}/${a}`),
            removed_branches: raceAgentKeys.map((a) => `race/${RACE_ID}/${a}`),
            pruned: true,
            skipped_reason: null,
          };
        }
        racePollCount += 1;
        const flipAfter = Number(
          localStorage.getItem("ai-launcher:e2e-race-flip-after") ?? "3",
        );
        if (racePhase === "adopted") return fakeRaceSnapshot("adopted");
        if (racePhase === "cleaned") return fakeRaceSnapshot("cleaned");
        if (racePhase !== "running") return fakeRaceSnapshot("cancelled");
        return fakeRaceSnapshot(racePollCount >= flipAfter ? "completed" : "running");
      };

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
          invoke: async (command: string, args?: Record<string, unknown>) => {
            if (command === "plugin:event|listen") return nextCallbackId++;
            if (command === "plugin:event|unlisten") return null;
            if (command.startsWith("plugin:")) return null;
            if (
              (command === "race_start" ||
                command === "race_status" ||
                command === "race_cancel" ||
                command === "race_diff" ||
                command === "race_adopt" ||
                command === "race_cleanup") &&
              !Object.prototype.hasOwnProperty.call(responses, command)
            ) {
              return runFakeRaceCommand(command, args);
            }
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
