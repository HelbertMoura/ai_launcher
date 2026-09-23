import { test, expect } from "@playwright/test";
import { installTauriStub } from "./tauriStub";
import { openMaintenanceSection, openSidebarSurface } from "./navigation";
import * as path from "path";

// Public screenshot suite for the README surfaces.
//
// Navigation is REAL UI navigation: App.tsx keeps the active tab in component
// state (useState<TabId>) and ignores location.hash, so driving the app via
// page.goto("/#…") silently captured the same surface eight times. Every
// surface is reached through the grouped sidebar (v23: the helper expands
// collapsed groups automatically) and the capture only happens after the
// target surface's own heading is visible — no blind timeouts.
// Since the v23 Fleet Command regrouping, Doctor lives inside the fused
// Maintenance surface (Diagnostics section).
//
// Determinism follows the visual-baseline convention: disable animations, hide
// the caret, reset scroll, and mask the live status-bar clock so the only
// pixels that change between runs are the surface itself.
//
// Locale is pinned to English on purpose (headless Chromium's navigator is
// en-US and the detector would pick that up nondeterministically anyway); the
// READMEs currently showcase the EN UI.

const SURFACES = [
  { file: "01-command-center.png", nav: "Home", heading: /command center/i },
  { file: "07-launcher-multi-agent.png", nav: "Launch", heading: /launch/i },
  { file: "02-runbooks-command-deck.png", nav: "Workspaces", heading: /workspaces/i },
  { file: "03-mcp-hub.png", nav: "MCP", heading: /mcp servers/i },
  { file: "04-history-timeline.png", nav: "History", heading: /history/i },
  { file: "08-costs-analytics.png", nav: "Analytics", heading: /costs/i },
  { file: "05-doctor-readiness.png", nav: "Maintenance", section: "Diagnostics", heading: /environment doctor/i },
  { file: "06-help-support.png", nav: "Help", heading: /help/i },
] as const;

const CLIS_STUB = [
  { key: "claude", name: "Claude Code", command: "claude", installed: true, version: "0.8.2" },
  { key: "codex", name: "Codex CLI", command: "codex", installed: true, version: "1.2.0" },
  { key: "antigravity", name: "Antigravity", command: "agy", installed: true, version: "2.0.1" },
  { key: "aider", name: "Aider AI", command: "aider", installed: true, version: "0.72.0" },
  { key: "goose", name: "Goose (Block)", command: "goose", installed: true, version: "1.0.4" },
  { key: "cline", name: "Cline CLI", command: "cline", installed: true, version: "3.2.0" },
  { key: "roocode", name: "Roo Code", command: "roocode", installed: true, version: "3.8.1" },
  { key: "qwen", name: "Qwen Code", command: "qwen", installed: false, version: null },
  { key: "crush", name: "Crush", command: "crush", installed: false, version: null },
  { key: "droid", name: "Factory Droid", command: "droid", installed: false, version: null },
];

// Usage seed for the Costs surface: three distinct current-month days so the
// month projection card renders with real numbers (same date-relative shape as
// the canonical wave-3d seeds in costs.spec.ts — the capture must run on/after
// the 3rd day of the month, like the projection test's honest skip).
function isoDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const USAGE_SEED = {
  entries: [0, 1, 2].map((offset, i) => ({
    date: isoDate(offset),
    cli: i % 2 === 0 ? "codex" : "claude",
    provider: i % 2 === 0 ? "openai" : "anthropic",
    model: i % 2 === 0 ? "gpt-5" : "opus",
    tokens_in: 1000,
    tokens_out: 500,
    cost_estimate_usd: 4.0,
    project: "Web Portal",
    project_path: "C:/dev/web-portal",
  })),
};

test.describe("v22 public screenshots capture", () => {
  const screenshotsDir = path.resolve(process.cwd(), "docs/screenshots/v22");

  test("capture all v22 screenshots suite", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1280, height: 860 });

    await installTauriStub(page, {
      onboardingDone: true,
      responses: {
        get_all_clis: CLIS_STUB,
        check_clis: CLIS_STUB,
        read_usage_stats: USAGE_SEED,
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
          { name: "github", cli: "claude", transport: "stdio", command: "npx", args: ["-y", "@modelcontextprotocol/server-github"] },
          { name: "postgres", cli: "claude", transport: "stdio", command: "npx", args: ["-y", "@modelcontextprotocol/server-postgres"] },
          { name: "filesystem", cli: "codex", transport: "stdio", command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem"] },
        ],
      },
    });

    // Populate deterministic state before the app boots. The locale key matches
    // LOCALE_STORAGE_KEY in src/i18n/index.ts.
    await page.addInitScript(() => {
      localStorage.setItem("ai-launcher:locale", "en");
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
    });

    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /command center/i }).first()
    ).toBeVisible();

    for (const surface of SURFACES) {
      if ("section" in surface) {
        await openMaintenanceSection(page, surface.section);
      } else {
        await openSidebarSurface(page, surface.nav);
      }
      await expect(
        page.getByRole("heading", { name: surface.heading }).first()
      ).toBeVisible();

      // Let async stub-driven content settle after the heading marks the
      // surface as mounted; the heading wait above remains the real gate.
      await page.waitForTimeout(300);
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.querySelector(".cd-app__main")?.scrollTo(0, 0);
      });

      await page.screenshot({
        path: path.join(screenshotsDir, surface.file),
        fullPage: false,
        animations: "disabled",
        caret: "hide",
        mask: [page.locator(".cd-status__cell--clock")],
      });
    }
  });
});
