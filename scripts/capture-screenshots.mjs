import { chromium } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const screenshotsDir = path.resolve(process.cwd(), "docs/screenshots/v22");
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

const CLIS_STUB = [
  { key: "claude", name: "Claude Code", command: "claude", installed: true, version: "0.8.2" },
  { key: "codex", name: "Codex CLI", command: "codex", installed: true, version: "1.2.0" },
  { key: "antigravity", name: "Antigravity", command: "agy", installed: true, version: "2.0.1" },
  { key: "aider", name: "Aider AI", command: "aider", installed: true, version: "0.72.0" },
  { key: "goose", name: "Goose (Block)", command: "goose", installed: true, version: "1.0.4" },
  { key: "cline", name: "Cline CLI", command: "cline", installed: true, version: "3.2.0" },
  { key: "roocode", name: "Roo Code", command: "roocode", installed: true, version: "3.8.1" },
  { key: "continue", name: "Continue", command: "cn", installed: true, version: "0.9.0" },
  { key: "cody", name: "Cody (Sourcegraph)", command: "cody", installed: true, version: "1.1.0" },
  { key: "copilot", name: "GitHub Copilot", command: "copilot", installed: true, version: "0.6.0" },
  { key: "qwen", name: "Qwen Code", command: "qwen", installed: false, version: null },
  { key: "crush", name: "Crush", command: "crush", installed: false, version: null },
  { key: "droid", name: "Factory Droid", command: "droid", installed: false, version: null },
];

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 860 },
  });
  const page = await context.newPage();

  // Stub Tauri backend
  await page.addInitScript(({ clis }) => {
    localStorage.setItem("ai-launcher:onboarding-done", "true");
    const now = new Date().toISOString();
    localStorage.setItem("ai-launcher:v15:active-workspace", "ws-ai-launcher");
    localStorage.setItem(
      "ai-launcher:v15:workspace",
      JSON.stringify([
        {
          id: "ws-ai-launcher",
          name: "AI Launcher Pro",
          directory: "C:\\Users\\Helbert\\Desktop\\ai_launcher",
          cliKeys: ["claude", "aider", "cline", "goose"],
          envVars: {},
          tags: ["Tauri", "React", "Rust", "v22"],
          pinned: true,
          createdAt: now,
          updatedAt: now,
        },
      ])
    );
    localStorage.setItem(
      "ai-launcher-config",
      JSON.stringify({
        history: [
          {
            cli: "Claude Code",
            cliKey: "claude",
            directory: "C:\\Users\\Helbert\\Desktop\\ai_launcher",
            args: "--dangerously-skip-permissions",
            timestamp: now,
            startedAt: now,
            status: "running",
            description: "Release v22.0.0 architecture & multi-agent ecosystem",
          },
          {
            cli: "Aider AI",
            cliKey: "aider",
            directory: "C:\\Users\\Helbert\\Desktop\\ai_launcher",
            args: "--yes-always",
            timestamp: new Date(Date.now() - 86400000).toISOString(),
            startedAt: new Date(Date.now() - 86400000).toISOString(),
            status: "completed",
            description: "Rust backend sub-crate modularization pass",
          },
          {
            cli: "Goose",
            cliKey: "goose",
            directory: "C:\\dev\\enterprise-service",
            args: "",
            timestamp: new Date(Date.now() - 172800000).toISOString(),
            startedAt: new Date(Date.now() - 172800000).toISOString(),
            status: "completed",
            description: "Autonomous task pipeline execution",
          },
        ],
      })
    );

    const responses = {
      get_all_clis: clis,
      check_clis: clis,
      list_active_sessions: [
        {
          session_id: "sess-v22-1",
          cli_key: "claude",
          cli_name: "Claude Code",
          directory: "C:\\projects\\ai-launcher",
          args: "--dangerously-skip-permissions",
          status: "running",
          started_at: new Date().toISOString(),
        },
        {
          session_id: "sess-v22-2",
          cli_key: "aider",
          cli_name: "Aider AI",
          directory: "C:\\projects\\backend-api",
          args: "--yes-always",
          status: "running",
          started_at: new Date(Date.now() - 3600000).toISOString(),
        },
      ],
      list_mcp_servers: [
        { name: "github", command: "npx", args: ["-y", "@modelcontextprotocol/server-github"], status: "healthy" },
        { name: "postgres", command: "npx", args: ["-y", "@modelcontextprotocol/server-postgres"], status: "healthy" },
        { name: "filesystem", command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem"], status: "healthy" },
      ],
      check_all_updates: {
        cli_updates: [],
        tool_updates: [],
        env_updates: [],
        checked_at: new Date().toISOString(),
        total_with_updates: 0,
      },
      check_app_update: {
        update_available: false,
        version: "22.0.0",
        current_version: "22.0.0",
        release_notes_url: "",
        release_notes_body: "",
      },
      has_secure_storage: true,
      store_secret: { stored: true, backend: "windows-credential-manager", migratedLegacy: false },
      get_secret: null,
      delete_secret: true,
      test_provider_connection: { ok: true, latencyMs: 38 },
      mcp_health_check: { ok: true, detail: "All servers operational" },
    };

    const callbacks = new Map();
    let nextCallbackId = 1;
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {
        transformCallback: (cb, once = false) => {
          const id = nextCallbackId++;
          callbacks.set(id, (args) => {
            const res = cb(args);
            if (once) callbacks.delete(id);
            return res;
          });
          return id;
        },
        invoke: async (cmd, args = {}) => {
          if (cmd in responses) return responses[cmd];
          if (cmd === "plugin:globalShortcut|register") return null;
          if (cmd === "plugin:globalShortcut|unregister") return null;
          if (cmd === "plugin:autostart|isEnabled") return false;
          return null;
        },
      },
    });
  }, { clis: CLIS_STUB });

  console.log("Navigating to app...");
  await page.goto("http://localhost:3000/#command-center");
  await page.waitForTimeout(2000);

  console.log("Capturing 01-command-center.png...");
  await page.screenshot({
    path: path.join(screenshotsDir, "01-command-center.png"),
  });

  console.log("Capturing 07-launcher-multi-agent.png...");
  await page.goto("http://localhost:3000/#launcher");
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: path.join(screenshotsDir, "07-launcher-multi-agent.png"),
  });

  console.log("Capturing 02-runbooks-command-deck.png...");
  await page.goto("http://localhost:3000/#workspaces");
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: path.join(screenshotsDir, "02-runbooks-command-deck.png"),
  });

  console.log("Capturing 03-mcp-hub.png...");
  await page.goto("http://localhost:3000/#mcp");
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: path.join(screenshotsDir, "03-mcp-hub.png"),
  });

  console.log("Capturing 04-history-timeline.png...");
  await page.goto("http://localhost:3000/#history");
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: path.join(screenshotsDir, "04-history-timeline.png"),
  });

  console.log("Capturing 08-costs-analytics.png...");
  await page.goto("http://localhost:3000/#analytics");
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: path.join(screenshotsDir, "08-costs-analytics.png"),
  });

  console.log("Capturing 05-doctor-readiness.png...");
  await page.goto("http://localhost:3000/#doctor");
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: path.join(screenshotsDir, "05-doctor-readiness.png"),
  });

  console.log("Capturing 06-help-support.png...");
  await page.goto("http://localhost:3000/#help");
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: path.join(screenshotsDir, "06-help-support.png"),
  });

  await browser.close();
  console.log("All screenshots captured successfully!");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
