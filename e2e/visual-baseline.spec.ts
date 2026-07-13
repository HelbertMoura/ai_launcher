import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  expectNoUnknownTauriCommands,
  installTauriStub,
} from "./tauriStub";

test.describe("v21 visual baseline", () => {
  const VISUAL_CLOCK_NOW = "2026-07-13T12:00:00.000Z";

  async function freezeVisualClock(page: import("@playwright/test").Page) {
    await page.addInitScript(`
      (() => {
        const fixedNow = new Date("${VISUAL_CLOCK_NOW}").getTime();
        const RealDate = Date;
        function FixedDate(...args) {
          if (!(this instanceof FixedDate)) return new RealDate(fixedNow).toString();
          return args.length === 0 ? new RealDate(fixedNow) : new RealDate(...args);
        }
        FixedDate.now = () => fixedNow;
        FixedDate.parse = RealDate.parse;
        FixedDate.UTC = RealDate.UTC;
        FixedDate.prototype = RealDate.prototype;
        Object.setPrototypeOf(FixedDate, RealDate);
        window.Date = FixedDate;
      })();
    `);
  }

  test("onboarding", async ({ page }) => {
    await installTauriStub(page, { onboardingDone: false });
    await page.goto("/");
    await expect(page.getByText("AI LAUNCHER", { exact: false }).first()).toBeVisible();

    await expect(page).toHaveScreenshot("onboarding.png", {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.01,
    });
    await expectNoUnknownTauriCommands(page);
  });

  test("empty Command Center", async ({ page }) => {
    await installTauriStub(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /command center/i })).toBeVisible();
    // Let lazy CSS chunks and Chromium's backdrop layers finish repainting;
    // capturing immediately after the heading appears can produce blank bands.
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot("command-center-empty.png", {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.01,
    });
    await expectNoUnknownTauriCommands(page);
  });

  test("Runbooks 3.0 command deck", async ({ page }) => {
    await installTauriStub(page);
    await page.addInitScript(() => {
      const now = "2026-07-13T10:00:00.000Z";
      localStorage.setItem("ai-launcher:v15:workspace", JSON.stringify([{
        id: "ws-visual", name: "Command Deck", directory: "C:\\dev\\command-deck",
        cliKeys: [], envVars: {}, tags: [], pinned: true, createdAt: now, updatedAt: now,
      }]));
      localStorage.setItem("ai-launcher:v15:active-workspace", "ws-visual");
      localStorage.setItem("ai-launcher-config", JSON.stringify({ history: [{
        cli: "Codex", cliKey: "codex", directory: "C:\\dev\\command-deck", args: "",
        timestamp: now, startedAt: now, status: "completed", description: "Release review session",
      }] }));
      localStorage.setItem("ai-launcher:v21:audit-log", JSON.stringify([{
        id: "audit-visual", at: now, action: "mcp.server.update", outcome: "confirmed",
        mode: "safe", workspaceId: "ws-visual", detail: "codex:github",
      }]));
      localStorage.setItem("ai-launcher:v15:runbooks", JSON.stringify({ runbooks: [{
        id: "rb-visual", name: "Validate release candidate", tags: ["release"], createdAt: now, updatedAt: now,
        steps: [
          { id: "step-types", label: "Validate types", type: "check", command: "npm run typecheck", auto: true },
          { id: "step-tests", label: "Run test suite", type: "check", command: "npm test", auto: false, condition: { type: "previousSucceeded" } },
        ],
      }] }));
    });
    await page.goto("/");
    await page.locator("body").click();
    await page.keyboard.press("Control+7");
    await page.getByRole("button", { name: /^(manage runbooks|gerenciar runbooks)$/i }).click();
    await page.getByRole("button", { name: /^(run|executar)$/i }).click();
    await page.getByRole("button", { name: /dry run|simular/i }).click();
    await expect(page.getByText(/dry run validated|dry-run validado/i)).toBeVisible();
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot("runbooks-command-deck.png", {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.01,
    });
    await page.getByRole("button", { name: /^(close|fechar)$/i }).click();
    await page.getByRole("button", { name: /runbooks/i }).first().click();
    await expect(page.getByRole("heading", { name: /unified timeline|timeline unificada/i })).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot("workspace-unified-timeline.png", {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.01,
    });
    await expectNoUnknownTauriCommands(page);
  });

  const waveAClis = [
    {
      key: "codex", name: "Codex CLI", command: "codex", flag: null,
      install_cmd: "npm install -g @openai/codex", version_cmd: "codex --version",
      npm_pkg: "@openai/codex", pip_pkg: null, install_method: "npm",
      install_url: null, extra_paths: [], update_manifest_url: null,
    },
    {
      key: "claude", name: "Claude Code", command: "claude", flag: null,
      install_cmd: "npm install -g @anthropic-ai/claude-code", version_cmd: "claude --version",
      npm_pkg: "@anthropic-ai/claude-code", pip_pkg: null, install_method: "npm",
      install_url: null, extra_paths: [], update_manifest_url: null,
    },
    {
      key: "gemini", name: "Gemini CLI", command: "gemini", flag: null,
      install_cmd: "npm install -g @google/gemini-cli", version_cmd: "gemini --version",
      npm_pkg: "@google/gemini-cli", pip_pkg: null, install_method: "npm",
      install_url: null, extra_paths: [], update_manifest_url: null,
    },
  ];

  async function seedWaveAPage(page: import("@playwright/test").Page, theme: string) {
    await installTauriStub(page, {
      responses: {
        get_all_clis: waveAClis,
        check_clis: [
          { name: "Codex CLI", installed: true, version: "0.21.0", install_command: null },
          { name: "Claude Code", installed: true, version: "2.1.0", install_command: null },
          { name: "Gemini CLI", installed: false, version: null, install_command: "npm install" },
        ],
        list_active_sessions: [{
          session_id: "session-visual", cli_key: "codex", cli_name: "Codex CLI",
          directory: "C:\\dev\\command-deck", started_at: "2026-07-13T10:03:00.000Z",
        }],
      },
    });
    await freezeVisualClock(page);
    await page.addInitScript(({ selectedTheme }) => {
      const now = "2026-07-13T10:00:00.000Z";
      localStorage.setItem("ai-launcher:theme", selectedTheme);
      localStorage.setItem("ai-launcher:locale", "en");
      localStorage.setItem("ai-launcher:v15:workspace", JSON.stringify([
        { id: "ws-visual", name: "Command Deck", description: "Release operations and agent workflows", directory: "C:\\dev\\command-deck", cliKeys: ["codex", "claude"], providerKey: "anthropic", envVars: {}, tags: ["release", "desktop"], pinned: true, createdAt: now, updatedAt: now },
        { id: "ws-api", name: "Platform API", description: "Backend services", directory: "C:\\dev\\platform-api", cliKeys: ["codex"], envVars: {}, tags: ["api"], pinned: false, createdAt: now, updatedAt: now },
      ]));
      localStorage.setItem("ai-launcher:v15:active-workspace", "ws-visual");
      localStorage.setItem("ai-launcher:v20:agent-profiles", JSON.stringify([
        { id: "agent-review", name: "Release reviewer", description: "Checks release readiness", cliKey: "codex", args: "review --release", tags: ["quality"], pinned: true, createdAt: now, updatedAt: now },
      ]));
      localStorage.setItem("ai-launcher:v20:active-agent-profile", "agent-review");
      localStorage.setItem("ai-launcher:v15:profiles", JSON.stringify([
        { id: "profile-release", name: "Review release", directory: "C:\\dev\\command-deck", cliKeys: ["codex"], args: "review --release", noPerms: true, envVars: {}, tags: [], pinned: true, createdAt: now, updatedAt: now },
      ]));
      localStorage.setItem("ai-launcher:recent-dirs", JSON.stringify({ codex: ["C:\\dev\\command-deck", "C:\\dev\\platform-api"], claude: ["C:\\dev\\command-deck"] }));
      localStorage.setItem("ai-launcher-config", JSON.stringify({ history: [
        { cli: "Codex CLI", cliKey: "codex", directory: "C:\\dev\\command-deck", args: "review --release", timestamp: "2026-07-13T10:03:00.000Z", startedAt: "2026-07-13T10:03:00.000Z", status: "running", sessionId: "session-visual", description: "Release review session" },
        { cli: "Claude Code", cliKey: "claude", directory: "C:\\dev\\command-deck", args: "test desktop shell", timestamp: "2026-07-13T09:20:00.000Z", startedAt: "2026-07-13T09:20:00.000Z", completedAt: "2026-07-13T09:24:30.000Z", duration: 270000, status: "completed", description: "Desktop smoke tests" },
        { cli: "Codex CLI", cliKey: "codex", directory: "C:\\dev\\platform-api", args: "run audit", timestamp: "2026-07-13T08:10:00.000Z", startedAt: "2026-07-13T08:10:00.000Z", completedAt: "2026-07-13T08:11:12.000Z", duration: 72000, status: "failed", errorMessage: "Dependency audit returned exit code 1" },
      ] }));
      localStorage.setItem("ai-launcher:v15:runbooks", JSON.stringify({ runbooks: [{ id: "rb-visual", name: "Validate release", tags: ["release"], createdAt: now, updatedAt: now, steps: [{ id: "step-types", label: "Validate types", type: "check", command: "npm run typecheck", auto: true }] }] }));
    }, { selectedTheme: theme });
  }

  async function settleVisualLayers(page: import("@playwright/test").Page) {
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    });
    // Chromium on Windows can expose visible DOM before backdrop/compositor
    // layers repaint. Keep this explicit guard so an empty frame cannot become
    // an accepted baseline during a cold Vite transform.
    await page.waitForTimeout(800);
    // Force one complete compositor readback before the asserted capture. Under
    // concurrent cold boots Chromium can otherwise paint the main route while
    // leaving TopBar/Sidebar layers black for the first screenshot only.
    await page.screenshot({ animations: "disabled", caret: "hide" });
    await page.waitForTimeout(200);
  }

  for (const theme of ["dark", "light", "high-contrast"] as const) {
    for (const target of [
      { name: "launcher", shortcut: "Control+2", heading: /launch/i },
      { name: "workspaces", shortcut: "Control+7", heading: /workspaces/i },
      { name: "history", shortcut: "Control+5", heading: /history/i },
    ] as const) {
      test(`${target.name} ${theme} visual and accessibility matrix`, async ({ page }) => {
        await seedWaveAPage(page, theme);
        await page.goto("/");
        await expect(page.locator(".cd-app")).toBeVisible();
        await settleVisualLayers(page);
        await page.locator("body").click();
        await page.keyboard.press(target.shortcut);
        await expect(page.getByRole("heading", { name: target.heading }).first()).toBeVisible();
        await settleVisualLayers(page);
        if (target.name === "workspaces") {
          await expect(page.locator(".cd-ws-context__metrics strong").nth(2)).toHaveText("1");
        }

        await expect(page).toHaveScreenshot(`wave-a-${target.name}-${theme}.png`, {
          animations: "disabled",
          caret: "hide",
          maxDiffPixelRatio: 0.005,
        });

        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa"])
          .exclude(".cd-status__cell--brand")
          .analyze();
        const seriousOrCritical = results.violations.filter(
          (violation) => violation.impact === "serious" || violation.impact === "critical",
        );
        expect(seriousOrCritical).toEqual([]);
        await expectNoUnknownTauriCommands(page);

        if (theme === "dark" && target.name === "launcher") {
          const dragHandle = page.getByRole("button", { name: /drag to reorder/i }).first();
          await dragHandle.focus();
          await expect(dragHandle).toBeFocused();
          await page.keyboard.press("Space");
          await page.keyboard.press("Escape");
        }
        if (theme === "dark" && target.name === "workspaces") {
          const createWorkspace = page.getByRole("button", { name: /^new$/i }).first();
          await createWorkspace.focus();
          await page.keyboard.press("Enter");
          await expect(page.getByRole("heading", { name: /new workspace/i })).toBeVisible();
        }
        if (theme === "dark" && target.name === "history") {
          const cliFilter = page.locator(".cd-history__filter-select").first();
          await expect(cliFilter).toHaveAccessibleName(/CLI/i);
          await cliFilter.focus();
          await page.keyboard.press("ArrowDown");
          await expect(cliFilter).toHaveValue("codex");
        }
      });
    }
  }

  async function seedWaveBPage(page: import("@playwright/test").Page, theme: string) {
    await installTauriStub(page, {
      responses: {
        get_all_clis: waveAClis,
        check_clis: [
          { name: "Codex CLI", installed: true, version: "0.21.0", install_command: null },
          { name: "Claude Code", installed: true, version: "2.1.0", install_command: null },
          { name: "Gemini CLI", installed: false, version: null, install_command: "npm install" },
        ],
        get_all_tools: [
          { key: "vscode", name: "Visual Studio Code", command: "code", install_hint: "winget install Microsoft.VisualStudioCode", install_url: null },
        ],
        check_tools: [
          { name: "Visual Studio Code", installed: true, version: "1.102.0", install_command: null },
        ],
        check_environment: [
          { key: "docker", name: "Docker", installed: false, version: null, install_command: "winget install Docker.DockerDesktop" },
          { key: "git", name: "Git", installed: true, version: "2.50.0", install_command: null },
        ],
        list_mcp_servers: [
          { name: "github", cli: "claude", transport: "http", url: "https://api.githubcopilot.com/mcp/", headers_keys: ["Authorization"], env_keys: [], enabled: true },
          { name: "filesystem", cli: "codex", transport: "stdio", command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", "C:\\dev"], headers_keys: [], env_keys: [], enabled: true },
          { name: "memory", cli: "gemini", transport: "stdio", command: "npx", args: ["-y", "@modelcontextprotocol/server-memory"], headers_keys: [], env_keys: [], enabled: true },
        ],
        check_all_updates: {
          cli_updates: [
            { cli: "Codex CLI", current: "0.21.0", latest: "0.22.0", has_update: true, method: "npm", no_api: false, key: "codex" },
          ],
          env_updates: [
            { cli: "Node.js", current: "22.14.0", latest: "24.4.0", has_update: true, method: "winget", no_api: false, key: "node" },
          ],
          tool_updates: [
            { cli: "Visual Studio Code", current: "1.102.0", latest: "1.103.0", has_update: true, method: "winget", no_api: false, key: "vscode" },
          ],
          checked_at: "2026-07-13T12:00:00.000Z",
          total_with_updates: 3,
        },
      },
    });
    await page.addInitScript(({ selectedTheme }) => {
      const now = "2026-07-13T12:00:00.000Z";
      localStorage.setItem("ai-launcher:theme", selectedTheme);
      localStorage.setItem("ai-launcher:locale", "en");
      localStorage.setItem("ai-launcher:v21:execution-mode", "safe");
      localStorage.setItem("ai-launcher-providers", JSON.stringify({
        activeId: "team-gateway",
        profiles: [{
          id: "team-gateway", name: "Team gateway", kind: "custom",
          baseUrl: "https://models.example.test/v1", apiKey: "__secret__",
          mainModel: "release-reviewer", fastModel: "fast-reviewer",
          contextWindow: 200000, builtin: false, protocol: "openai_chat",
        }],
      }));
      localStorage.setItem("ai-launcher:v21:audit-log", JSON.stringify([
        { id: "audit-allow", at: now, action: "mcp.server.update", outcome: "confirmed", mode: "safe", detail: "codex:filesystem" },
        { id: "audit-block", at: "2026-07-13T11:40:00.000Z", action: "runbook.step.execute", outcome: "blocked", mode: "safe", detail: "privileged command" },
      ]));
    }, { selectedTheme: theme });
  }

  const waveBTargets = [
    { name: "mcp", shortcut: "Control+4", heading: /mcp servers/i },
    { name: "updates", shortcut: "Control+9", heading: /updates/i },
    { name: "admin-providers", shortcut: "Control+,", heading: /^providers$/i },
    { name: "admin-security", shortcut: "Control+,", section: /^security$/i, heading: /^execution mode$/i },
    { name: "admin-backup", shortcut: "Control+,", section: /^backup$/i, heading: /^backup and restore$/i },
  ] as const;

  test.describe("Wave B matrix", () => {
    test.describe.configure({ mode: "serial" });

    for (const theme of ["dark", "light", "high-contrast"] as const) {
      test.describe(`${theme} theme`, () => {
        test.describe.configure({ mode: "serial" });

        for (const target of waveBTargets) {
          test(`${target.name} ${theme} Wave B visual and accessibility matrix`, async ({ page }) => {
        await seedWaveBPage(page, theme);
        await page.goto("/");
        await expect(page.locator(".cd-app")).toBeVisible();
        await settleVisualLayers(page);
        await page.locator("body").click();
        await page.keyboard.press(target.shortcut);

        if ("section" in target) {
          await expect(page.getByRole("heading", { name: /admin/i }).first()).toBeVisible();
          await page.getByRole("button", { name: target.section }).click();
        }

        await expect(page.getByRole("heading", { name: target.heading }).first()).toBeVisible();
        await settleVisualLayers(page);

        await expect(page).toHaveScreenshot(`wave-b-${target.name}-${theme}.png`, {
          animations: "disabled",
          caret: "hide",
          maxDiffPixelRatio: 0.005,
        });

        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa"])
          .exclude(".cd-status__cell--brand")
          .analyze();
        const seriousOrCritical = results.violations.filter(
          (violation) => violation.impact === "serious" || violation.impact === "critical",
        );
        expect(seriousOrCritical).toEqual([]);
        await expectNoUnknownTauriCommands(page);

        if (theme === "dark" && target.name === "mcp") {
          const add = page.getByRole("button", { name: /^\+ add$/i });
          await add.focus();
          await page.keyboard.press("Enter");
          await expect(page.getByRole("dialog")).toBeVisible();
        }
        if (theme === "dark" && target.name === "updates") {
          const check = page.getByRole("button", { name: /check application/i });
          await check.focus();
          await page.keyboard.press("Enter");
          await expect(page.getByText(/^ready$/i).first()).toBeVisible();
        }
        if (theme === "dark" && target.name === "admin-providers") {
          const add = page.getByRole("button", { name: /add provider/i });
          await add.focus();
          await page.keyboard.press("Enter");
          await expect(page.getByRole("dialog")).toBeVisible();
        }
        if (theme === "dark" && target.name === "admin-security") {
          const safe = page.getByRole("button", { name: /active/i }).first();
          await safe.focus();
          await expect(safe).toBeFocused();
        }
        if (theme === "dark" && target.name === "admin-backup") {
          const choose = page.getByRole("button", { name: /choose json/i });
          await choose.focus();
          await expect(choose).toBeFocused();
        }
          });
        }
      });
    }
  });

  async function seedWaveCPage(page: import("@playwright/test").Page, theme: string, onboarding = true) {
    await installTauriStub(page, {
      onboardingDone: !onboarding,
      responses: {
        check_clis: [
          { name: "Codex CLI", installed: true, version: "0.22.0", install_command: null },
          { name: "Claude Code", installed: true, version: "2.1.0", install_command: null },
          { name: "Antigravity", installed: false, version: null, install_command: "iwr https://example.test/install.ps1 | iex" },
        ],
        check_environment: [
          { key: "node", name: "Node.js", installed: true, version: "24.4.0", install_command: null },
          { key: "git", name: "Git", installed: true, version: "2.50.0", install_command: null },
          { key: "rust", name: "Rust", installed: false, version: null, install_command: "winget install Rustlang.Rustup" },
          { key: "vscode", name: "Visual Studio Code", installed: false, version: null, install_command: "https://code.visualstudio.com/download" },
        ],
        read_usage_stats: {
          entries: [
            { date: "2026-07-13", cli: "codex", provider: "openai", model: "gpt-5", tokens_in: 12000, tokens_out: 4300, cost_estimate_usd: 4.6, project: "Command Deck" },
            { date: "2026-07-12", cli: "claude", provider: "anthropic", model: "opus", tokens_in: 9000, tokens_out: 3800, cost_estimate_usd: 5.2, project: "Command Deck" },
            { date: "2026-07-08", cli: "codex", provider: "openai", model: "gpt-5-mini", tokens_in: 24000, tokens_out: 6000, cost_estimate_usd: 2.3, project: "Platform API" },
            { date: "2026-06-16", cli: "claude", provider: "anthropic", model: "sonnet", tokens_in: 6000, tokens_out: 1800, cost_estimate_usd: 1.4, project: "Archive" },
          ],
        },
      },
    });
    await page.addInitScript(({ selectedTheme }) => {
      localStorage.setItem("ai-launcher:theme", selectedTheme);
      localStorage.setItem("ai-launcher:locale", "en");
      localStorage.setItem("ai-launcher:v21:execution-mode", "safe");
      localStorage.setItem("ai-launcher:budgets", JSON.stringify({
        openai: { providerKey: "openai", limitUsd: 20, periodDays: 30, periodStart: "2026-07-01" },
      }));
    }, { selectedTheme: theme });
  }

  const waveCTargets = [
    { name: "analytics", shortcut: "Control+6", heading: /costs/i },
    { name: "doctor", shortcut: "Control+8", heading: /environment doctor/i },
    { name: "prereqs", shortcut: "Control+0", heading: /prerequisites/i },
    { name: "help", shortcut: "?", heading: /help/i },
  ] as const;

  test.describe("Wave C matrix", () => {
    test.describe.configure({ mode: "serial" });

    for (const theme of ["dark", "light", "high-contrast"] as const) {
      test.describe(`${theme} theme`, () => {
        test.describe.configure({ mode: "serial" });

        test(`onboarding ${theme} Wave C visual and accessibility matrix`, async ({ page }) => {
          await seedWaveCPage(page, theme, true);
          await page.goto("/");
          await expect(page.getByText("AI LAUNCHER", { exact: false }).first()).toBeVisible();
          await page.getByRole("button", { name: /continue/i }).click();
          await page.getByRole("button", { name: /continue/i }).click();
          await page.getByRole("button", { name: /scan now/i }).click();
          await expect(page.getByText(/codex cli/i)).toBeVisible();
          await settleVisualLayers(page);

          await expect(page).toHaveScreenshot(`wave-c-onboarding-${theme}.png`, {
            animations: "disabled",
            caret: "hide",
            maxDiffPixelRatio: 0.005,
          });

          const results = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa"])
            .analyze();
          const seriousOrCritical = results.violations.filter(
            (violation) => violation.impact === "serious" || violation.impact === "critical",
          );
          expect(seriousOrCritical).toEqual([]);
          await expectNoUnknownTauriCommands(page);

          if (theme === "dark") {
            const resultList = page.getByLabel(/cli detection results/i);
            await resultList.focus();
            await expect(resultList).toBeFocused();
          }
        });

        for (const target of waveCTargets) {
          test(`${target.name} ${theme} Wave C visual and accessibility matrix`, async ({ page }) => {
            await seedWaveCPage(page, theme, false);
            await page.goto("/");
            await expect(page.locator(".cd-app")).toBeVisible();
            await settleVisualLayers(page);
            await page.locator("body").click();
            await page.keyboard.press(target.shortcut);
            await expect(page.getByRole("heading", { name: target.heading }).first()).toBeVisible();
            await settleVisualLayers(page);

            await expect(page).toHaveScreenshot(`wave-c-${target.name}-${theme}.png`, {
              animations: "disabled",
              caret: "hide",
              maxDiffPixelRatio: 0.005,
            });

            const results = await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa"])
              .exclude(".cd-status__cell--brand")
              .analyze();
            const seriousOrCritical = results.violations.filter(
              (violation) => violation.impact === "serious" || violation.impact === "critical",
            );
            expect(seriousOrCritical).toEqual([]);
            await expectNoUnknownTauriCommands(page);

            if (theme === "dark" && target.name === "analytics") {
              const exportCsv = page.getByRole("button", { name: /export csv/i });
              await exportCsv.focus();
              await expect(exportCsv).toBeFocused();
            }
            if (theme === "dark" && target.name === "doctor") {
              const dryRun = page.getByLabel(/dry run/i);
              await dryRun.focus();
              await page.keyboard.press("Space");
              await expect(dryRun).toBeChecked();
            }
            if (theme === "dark" && target.name === "prereqs") {
              const command = page.getByLabel(/rust install command/i);
              await command.focus();
              await expect(command).toBeFocused();
            }
            if (theme === "dark" && target.name === "help") {
              const replay = page.getByRole("button", { name: /replay welcome tour/i });
              await replay.focus();
              await page.keyboard.press("Enter");
              await expect(page.getByRole("dialog")).toBeVisible();
            }
          });
        }
      });
    }
  });
});
