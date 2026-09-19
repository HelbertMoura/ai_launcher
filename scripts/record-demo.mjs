#!/usr/bin/env node
/**
 * scripts/record-demo.mjs — records the README demo GIF (docs/demo.gif).
 *
 * Pipeline (run by .github/workflows/demo.yml on windows-latest):
 *   1. Starts the Vite dev server (same behavior as Playwright's webServer).
 *   2. Opens Chromium headless (1280x800, deviceScaleFactor 2) with video
 *      recording enabled and the canonical Tauri E2E stub injected.
 *      The stub replicates e2e/tauriStub.ts: this script runs as plain ESM and
 *      cannot import that TS module — KEEP THE TWO IN SYNC.
 *   3. Plays a ~15-20s keyboard-first demo script (palette, navigation, theme).
 *   4. Encodes the recorded WebM into docs/demo.gif with ffmpeg.
 *
 * Usage:
 *   node scripts/record-demo.mjs --dry   # validates the wiring, no video/ffmpeg
 *   node scripts/record-demo.mjs         # full recording + GIF encoding
 */

import { spawn, spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "@playwright/test";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE_URL = "http://127.0.0.1:5173";
const VIDEO_DIR = path.join(REPO_ROOT, "test-results", "demo-video");
const GIF_PATH = path.join(REPO_ROOT, "docs", "demo.gif");
const SERVER_TIMEOUT_MS = 120_000; // matches playwright.config webServer.timeout

const DRY = process.argv.includes("--dry");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (message) => console.log(`[record-demo] ${message}`);

function tail(lines) {
  return lines.slice(-30).join("\n");
}

function isReachable() {
  return fetch(BASE_URL, { signal: AbortSignal.timeout(2_000) })
    .then((res) => res.ok)
    .catch(() => false);
}

function startDevServer() {
  // On win32, npm is an npm.cmd shim: spawn through the shell as a single
  // command string (empty args array avoids Node DEP0190).
  const child =
    process.platform === "win32"
      ? spawn("npm run dev", { cwd: REPO_ROOT, shell: true, stdio: ["ignore", "pipe", "pipe"] })
      : spawn("npm", ["run", "dev"], { cwd: REPO_ROOT, stdio: ["ignore", "pipe", "pipe"] });
  const output = [];
  for (const stream of [child.stdout, child.stderr]) {
    stream.on("data", (chunk) => {
      output.push(...String(chunk).split(/\r?\n/).filter(Boolean));
      if (output.length > 400) output.splice(0, output.length - 400);
    });
  }
  child.__output = output;
  return child;
}

async function waitForServer(child) {
  const deadline = Date.now() + SERVER_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await isReachable()) return;
    if (child.exitCode !== null) {
      throw new Error(
        `Vite dev server exited early (code ${child.exitCode}).\n${tail(child.__output)}`,
      );
    }
    await sleep(500);
  }
  throw new Error(
    `Vite dev server did not become reachable within ${SERVER_TIMEOUT_MS}ms.\n${tail(child.__output)}`,
  );
}

function stopDevServer(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32") {
    // The direct PID is the cmd.exe wrapper spawned with shell:true; /T takes
    // the whole tree (npm -> node -> vite) down with it.
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    child.kill("SIGTERM");
  }
}

function requireFfmpeg() {
  const probe = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
  if (probe.error || probe.status !== 0) {
    throw new Error(
      "ffmpeg is not available on PATH. The GitHub windows-latest runner provides it; " +
        "locally install ffmpeg or run with --dry.",
    );
  }
}

// --- Canonical Tauri E2E stub (replicates e2e/tauriStub.ts) -----------------

function demoStubInitScript({ onboardingDone, responses }) {
  if (onboardingDone) {
    localStorage.setItem("ai-launcher:onboarding-done", "true");
  } else {
    localStorage.removeItem("ai-launcher:onboarding-done");
  }

  const unknownCommands = [];
  const callbacks = new Map();
  let nextCallbackId = 1;
  Object.defineProperty(window, "__UNKNOWN_TAURI_COMMANDS__", {
    configurable: true,
    value: unknownCommands,
  });

  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    configurable: true,
    value: {
      transformCallback: (callback, once = false) => {
        const id = nextCallbackId++;
        callbacks.set(id, (...args) => {
          const result = callback(...args);
          if (once) callbacks.delete(id);
          return result;
        });
        return id;
      },
      unregisterCallback: (id) => callbacks.delete(id),
      invoke: async (command) => {
        if (command === "plugin:event|listen") return nextCallbackId++;
        if (command === "plugin:event|unlisten") return null;
        if (command.startsWith("plugin:")) return null;
        if (Object.prototype.hasOwnProperty.call(responses, command)) {
          return responses[command];
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
}

const NOW = "2026-09-19T12:00:00.000Z";

// Shapes follow e2e/critical-workflows.spec.ts (proven against the live app).
const DEMO_CLIS = [
  ["claude", "Claude Code", "claude", "0.8.2", "npm", "@anthropic-ai/claude-code"],
  ["codex", "Codex CLI", "codex", "1.2.0", "npm", "@openai/codex"],
  ["aider", "Aider AI", "aider", "0.72.0", "pip", "aider-chat"],
  ["goose", "Goose (Block)", "goose", "1.0.4", "script", null],
].map(([key, name, command, version, installMethod, npmPkg]) => ({
  key,
  name,
  command,
  flag: null,
  install_cmd: null,
  version_cmd: `${command} --version`,
  npm_pkg: npmPkg,
  pip_pkg: installMethod === "pip" ? "aider-chat" : null,
  install_method: installMethod,
  install_url: null,
  extra_paths: [],
  update_manifest_url: null,
}));

const DEMO_RESPONSES = {
  get_all_clis: DEMO_CLIS,
  check_clis: DEMO_CLIS.map((cli) => ({
    name: cli.name,
    installed: true,
    version: "22.7.0-demo",
    install_command: null,
  })),
  get_all_tools: [],
  check_tools: [],
  check_environment: [],
  list_active_sessions: [
    {
      session_id: "demo-session-1",
      cli_key: "claude",
      directory: "C:\\dev\\ai-launcher",
      started_at: NOW,
      kind: "tracked",
      pid: 4242,
    },
  ],
  list_mcp_servers: [
    {
      name: "context7",
      cli: "codex",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@upstash/context7-mcp@latest"],
      env_keys: [],
      headers_keys: [],
      enabled: true,
    },
  ],
  mcp_health_check: { ok: true, detail: "stubbed health check" },
  read_project_profile: null,
  scan_project_stack: { files: [], manifests: {} },
  write_project_profile: null,
  check_all_updates: {
    cli_updates: [], tool_updates: [], env_updates: [],
    checked_at: NOW, total_with_updates: 0,
  },
  check_app_update: {
    update_available: false, version: "22.7.0", current_version: "22.7.0",
    release_notes_url: "", release_notes_body: "",
  },
  read_usage_stats: { entries: [] },
  has_secure_storage: true,
  store_secret: { stored: true, backend: "windows-credential-manager", migratedLegacy: false },
  get_secret: null,
  delete_secret: true,
  test_provider_connection: { ok: true, latencyMs: 42 },
  evaluate_runbook_condition: { ok: true, message: "condition passed" },
  run_runbook_step: { ok: true, exit_code: 0, stdout: "stubbed runbook output", stderr: "", timed_out: false },
  stop_runbook_execution: true,
  launch_cli: { session_id: "session-demo", message: "stubbed launch" },
  launch_custom_cli: { session_id: "custom-session-demo", message: "stubbed custom launch" },
  kill_session: true,
  add_mcp_server: null,
  update_mcp_server: null,
  remove_mcp_server: null,
  update_cli: null,
  update_all_clis: null,
  install_cli: null,
  install_tool: null,
  install_prerequisite: null,
  download_verified_app_update: { version: "22.7.0", asset_name: "AI Launcher Pro_22.7.0_x64-setup.exe" },
};

// Deterministic seed applied before the stub init script on every navigation.
function demoSeedInitScript() {
  localStorage.setItem("ai-launcher:locale", "en");
  localStorage.setItem("ai-launcher:theme", "dark");
  localStorage.setItem("ai-launcher:v21:execution-mode", "safe");
  localStorage.setItem(
    "ai-launcher:v15:workspace",
    JSON.stringify([
      {
        id: "ws-demo",
        name: "AI Launcher",
        description: "Demo workspace",
        directory: "C:\\dev\\ai-launcher",
        cliKeys: ["claude", "codex", "aider", "goose"],
        providerKey: "anthropic",
        envVars: {},
        tags: ["tauri", "react", "rust"],
        pinned: true,
        createdAt: "2026-09-19T12:00:00.000Z",
        updatedAt: "2026-09-19T12:00:00.000Z",
      },
    ]),
  );
  localStorage.setItem("ai-launcher:v15:active-workspace", "ws-demo");
  localStorage.setItem(
    "ai-launcher-config",
    JSON.stringify({
      history: [
        {
          cli: "Claude Code",
          cliKey: "claude",
          directory: "C:\\dev\\ai-launcher",
          args: "--dangerously-skip-permissions",
          timestamp: "2026-09-19T12:00:00.000Z",
          startedAt: "2026-09-19T12:00:00.000Z",
          status: "completed",
          description: "Release readiness audit",
        },
        {
          cli: "Codex CLI",
          cliKey: "codex",
          directory: "C:\\dev\\ai-launcher",
          args: "",
          timestamp: "2026-09-19T11:00:00.000Z",
          startedAt: "2026-09-19T11:00:00.000Z",
          status: "completed",
          description: "Cross-platform keyring refactor",
        },
      ],
    }),
  );
}

// --- Demo script -------------------------------------------------------------

async function playDemo(page, { withVideo }) {
  log("Opening the app…");
  // domcontentloaded + heading wait: cold Vite transforms on Windows can exceed
  // the default 30s "load" budget (see playwright.config.ts webServer note).
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page
    .getByRole("heading", { name: /command center/i })
    .first()
    .waitFor({ state: "visible", timeout: 60_000 });
  await page.waitForTimeout(1_500);

  log("Command palette: Ctrl+K, type \"launch\", browse with arrows");
  await page.keyboard.press("Control+K");
  await page.locator(".cd-cmd__input").waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForTimeout(300);
  await page.keyboard.type("launch", { delay: 90 });
  await page.waitForTimeout(700);
  for (let i = 0; i < 3; i += 1) {
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(420);
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(700);

  log("Toggle theme through the palette");
  await page.keyboard.press("Control+K");
  await page.locator(".cd-cmd__input").waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForTimeout(300);
  await page.keyboard.type("toggle theme", { delay: 80 });
  await page.waitForTimeout(600);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1_200);

  log("Land back on the Command Center through the palette");
  await page.keyboard.press("Control+K");
  await page.locator(".cd-cmd__input").waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForTimeout(300);
  await page.keyboard.type("command center", { delay: 80 });
  await page.waitForTimeout(600);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1_500);

  // Final hold so the GIF does not cut abruptly on the last frame.
  await page.waitForTimeout(1_500);
  log(`Demo script finished${withVideo ? " (video recorded)" : " (dry run)"}`);
}

async function main() {
  if (!DRY) requireFfmpeg();

  mkdirSync(path.dirname(GIF_PATH), { recursive: true });
  if (!DRY) mkdirSync(VIDEO_DIR, { recursive: true });

  const server = startDevServer();
  let browser = null;
  try {
    log("Waiting for the Vite dev server…");
    await waitForServer(server);
    log("Dev server is up.");

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 2,
      ...(DRY
        ? {}
        : { recordVideo: { dir: VIDEO_DIR, size: { width: 1280, height: 800 } } }),
    });
    const page = await context.newPage();
    await page.addInitScript(demoStubInitScript, {
      onboardingDone: true,
      responses: DEMO_RESPONSES,
    });
    await page.addInitScript(demoSeedInitScript);

    await playDemo(page, { withVideo: !DRY });

    if (DRY) {
      await context.close();
      log("DRY RUN OK — wiring validated (no video recorded, no ffmpeg run).");
      return;
    }

    const video = page.video();
    await context.close();
    if (!video) throw new Error("Playwright did not return a video handle.");
    const videoPath = await video.path();
    log(`WebM recorded at ${videoPath}`);

    const result = spawnSync("ffmpeg", [
      "-y",
      "-i", videoPath,
      "-vf", "fps=12,scale=800:-1:flags=lanczos,split[s0][s1][s2];[s0]palettegen[p];[s1][p]paletteuse[r]",
      "-loop", "0",
      GIF_PATH,
    ], { stdio: "inherit" });
    if (result.status !== 0) {
      throw new Error(`ffmpeg exited with code ${result.status}.`);
    }
    log(`GIF written to ${GIF_PATH}`);
  } finally {
    await browser?.close().catch(() => undefined);
    stopDevServer(server);
  }
}

main().catch((error) => {
  console.error(`[record-demo] FAILED: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
