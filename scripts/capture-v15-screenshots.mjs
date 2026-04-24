// Capture v15 screenshots via Playwright for README/docs.
// Requires the dev server running at http://127.0.0.1:5173
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "docs", "screenshots", "v15");

const fakeInvoke = `
  const invokeLog = [];
  window.__TAURI_INTERNALS__ = {
    invoke: async (cmd, args) => {
      invokeLog.push({ cmd, args });
      switch (cmd) {
        case "get_all_clis":
          return [
            { key: "claude", name: "Claude Code", command: "claude", icon: "claude", install_method: "npm", npm_pkg: "@anthropic-ai/claude-code", install_url: "", install_cmd: "" },
            { key: "codex", name: "Codex", command: "codex", icon: "codex", install_method: "npm", install_url: "", install_cmd: "" },
            { key: "gemini", name: "Gemini CLI", command: "gemini", icon: "gemini", install_method: "npm", install_url: "", install_cmd: "" },
            { key: "qwen", name: "Qwen", command: "qwen", icon: "qwen", install_method: "npm", install_url: "", install_cmd: "" },
            { key: "opencode", name: "OpenCode", command: "opencode", icon: "opencode", install_method: "npm", install_url: "", install_cmd: "" },
            { key: "crush", name: "Crush", command: "crush", icon: "crush", install_method: "npm", install_url: "", install_cmd: "" },
          ];
        case "check_clis":
          return [
            { key: "claude", name: "Claude Code", installed: true, version: "4.7.0", install_command: null },
            { key: "codex", name: "Codex", installed: true, version: "1.0.5", install_command: null },
            { key: "gemini", name: "Gemini CLI", installed: false, version: null, install_command: "npm i -g @google/gemini" },
            { key: "qwen", name: "Qwen", installed: true, version: "0.9.1", install_command: null },
            { key: "opencode", name: "OpenCode", installed: true, version: "0.3.2", install_command: null },
            { key: "crush", name: "Crush", installed: true, version: "1.2.0", install_command: null },
          ];
        case "get_all_tools":
          return [
            { key: "vscode", name: "VS Code", command: "code", install_hint: "code.visualstudio.com", install_url: "https://code.visualstudio.com" },
            { key: "cursor", name: "Cursor", command: "cursor", install_hint: "cursor.com", install_url: "https://cursor.com" },
            { key: "windsurf", name: "Windsurf", command: "windsurf", install_hint: "codeium.com", install_url: "https://codeium.com/windsurf" },
          ];
        case "check_tools":
          return [
            { key: "vscode", name: "VS Code", installed: true, version: "1.92.0", install_command: null },
            { key: "cursor", name: "Cursor", installed: true, version: "0.45.0", install_command: null },
            { key: "windsurf", name: "Windsurf", installed: false, version: null, install_command: "https://codeium.com/windsurf" },
          ];
        case "check_environment":
          return [
            { key: "node", name: "Node.js / npm", installed: true, version: "Node v22.3.0 / npm 10.8.1", install_command: "https://nodejs.org" },
            { key: "python", name: "Python / pip", installed: true, version: "Python 3.12.2", install_command: "https://python.org" },
            { key: "git", name: "Git", installed: true, version: "git version 2.45.0", install_command: "https://git-scm.com" },
            { key: "rust", name: "Rust", installed: true, version: "rustc 1.80.0", install_command: "https://rustup.rs" },
            { key: "pnpm", name: "pnpm", installed: false, version: null, install_command: "npm install -g pnpm" },
            { key: "docker", name: "Docker", installed: false, version: null, install_command: "https://docker.com" },
          ];
        case "check_all_updates":
          return {
            cli_updates: [
              { key: "claude", cli: "Claude Code", current: "4.7.0", latest: "4.8.0", has_update: true, method: "npm", no_api: false },
            ],
            tool_updates: [],
            env_updates: [],
            total_with_updates: 1,
            checked_at: new Date().toISOString(),
          };
        case "list_providers":
        case "get_providers":
          return [];
        case "read_usage_stats":
          return {
            entries: [
              { date: "2026-04-24", cli: "Claude Code", provider: "anthropic", tokens_input: 12000, tokens_output: 3400, cost_estimate_usd: 2.15 },
              { date: "2026-04-24", cli: "Claude Code", provider: "anthropic", tokens_input: 8500, tokens_output: 1200, cost_estimate_usd: 1.42 },
              { date: "2026-04-23", cli: "Codex", provider: "openai", tokens_input: 15000, tokens_output: 2100, cost_estimate_usd: 0.58 },
            ],
          };
        default:
          return null;
      }
    }
  };
  window.__invokeLog = invokeLog;
  localStorage.setItem("ai-launcher:onboarding-done", "true");
`;

async function run() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 820 },
    deviceScaleFactor: 2,
  });
  await context.addInitScript(fakeInvoke);
  const page = await context.newPage();

  async function shot(name, opts = {}) {
    await page.waitForTimeout(600);
    await page.screenshot({
      path: join(OUT_DIR, name),
      fullPage: false,
      ...opts,
    });
    console.log("  captured", name);
  }

  console.log("v15 screenshot capture");

  // LAUNCHER (default tab)
  await page.goto("http://127.0.0.1:5173/");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(800);
  await shot("01-launcher.png");

  // TOOLS
  await page.keyboard.press("Control+2");
  await shot("02-tools.png");

  // HISTORY waterfall
  await page.keyboard.press("Control+3");
  await shot("03-history.png");

  // COSTS
  await page.keyboard.press("Control+4");
  await shot("04-costs.png");

  // WORKSPACE (bento)
  await page.keyboard.press("Control+5");
  await shot("05-workspace.png");

  // DOCTOR
  await page.keyboard.press("Control+6");
  await shot("06-doctor.png");

  // UPDATES
  await page.keyboard.press("Control+7");
  await shot("07-updates.png");

  // COMMAND PALETTE
  await page.keyboard.press("Control+1");
  await page.waitForTimeout(200);
  await page.keyboard.press("Control+k");
  await shot("08-palette.png");
  await page.keyboard.press("Escape");

  await browser.close();
  console.log("Done. Screenshots in docs/screenshots/v15/");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
