import { expect, test, type Page } from "@playwright/test";
import {
  expectNoUnknownTauriCommands,
  installTauriStub,
  type TauriStubOverrides,
} from "./tauriStub";

const NOW = "2026-07-13T12:00:00.000Z";

const CLI_CODEX = {
  key: "codex",
  name: "Codex CLI",
  command: "codex",
  flag: null,
  install_cmd: "npm i -g @openai/codex",
  version_cmd: "codex --version",
  npm_pkg: "@openai/codex",
  pip_pkg: null,
  install_method: "npm",
  install_url: null,
  extra_paths: [],
  update_manifest_url: null,
};

async function preparePage(
  page: Page,
  options: {
    onboardingDone?: boolean;
    responses?: TauriStubOverrides;
    seed?: string;
  } = {},
): Promise<void> {
  await installTauriStub(page, {
    onboardingDone: options.onboardingDone ?? true,
    responses: options.responses,
  });
  await page.addInitScript((seed) => {
    localStorage.setItem("ai-launcher:locale", "en");
    localStorage.setItem("ai-launcher:theme", "dark");
    localStorage.setItem("ai-launcher:v21:execution-mode", "safe");
    if (seed) {
      // eslint-disable-next-line no-new-func
      new Function(seed)();
    }
  }, options.seed ?? "");
}

async function gotoApp(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await expect(page.locator("body")).toBeVisible();
}

async function openAdminSection(page: Page, section: RegExp): Promise<void> {
  await page.locator("body").click();
  await page.keyboard.press("Control+Comma");
  await expect(page.getByRole("heading", { name: /admin/i }).first()).toBeVisible();
  await page.getByRole("button", { name: section }).click();
}

function modal(page: Page) {
  return page.locator('[role="dialog"], [role="alertdialog"]');
}

function workspaceSeed(): string {
  return `
    var now = ${JSON.stringify(NOW)};
    localStorage.setItem("ai-launcher:v15:workspace", JSON.stringify([{
      id: "ws-critical",
      name: "Critical Workspace",
      description: "Release candidate workspace",
      directory: "C:\\\\dev\\\\critical",
      cliKeys: ["codex"],
      providerKey: "anthropic",
      envVars: {},
      tags: ["release"],
      pinned: true,
      createdAt: now,
      updatedAt: now
    }]));
    localStorage.setItem("ai-launcher:v15:active-workspace", "ws-critical");
  `;
}

function runbookSeed(): string {
  return `
    var now = ${JSON.stringify(NOW)};
    ${workspaceSeed()}
    localStorage.setItem("ai-launcher:v15:runbooks", JSON.stringify({ runbooks: [{
      id: "rb-critical",
      name: "Critical release check",
      tags: ["release"],
      createdAt: now,
      updatedAt: now,
      steps: [
        { id: "step-types", label: "Typecheck", type: "check", command: "npm run typecheck", auto: true },
        { id: "step-tests", label: "Unit tests", type: "check", command: "npm test", auto: true }
      ]
    }] }));
  `;
}

test.describe("v21 critical workflows", () => {
  test("completes onboarding and lands on Command Center", async ({ page }) => {
    await preparePage(page, { onboardingDone: false });
    await gotoApp(page);

    await expect(page.getByRole("heading", { name: /ai launcher/i })).toBeVisible();
    await page.getByRole("button", { name: /continue/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();
    await page.getByRole("button", { name: /scan now/i }).click();
    await page.getByRole("button", { name: /^finish$/i }).click();

    await expect(page.getByRole("heading", { name: /command center/i })).toBeVisible();
    await expectNoUnknownTauriCommands(page);
  });

  test("creates, activates, edits and deletes a workspace", async ({ page }) => {
    await preparePage(page);
    await gotoApp(page);
    await page.keyboard.press("Control+7");

    await page.getByRole("button", { name: /^new$/i }).first().click();
    await page.locator(".cd-ws-form__input").nth(0).fill("Release Lab");
    await page.locator(".cd-ws-form__input").nth(1).fill("Validation workspace");
    await page.locator(".cd-ws-form__input").nth(2).fill("C:\\dev\\release-lab");
    await page.locator(".cd-ws-form__input").nth(4).fill("release,qa");
    await page.getByRole("button", { name: /^save$/i }).click();

    await expect(page.getByText("Release Lab")).toBeVisible();
    await page.getByRole("button", { name: /^activate$/i }).click();
    await expect(page.getByText(/^active$/i).first()).toBeVisible();
    await page.getByRole("button", { name: /^edit$/i }).first().click();
    await page.locator(".cd-ws-form__input").nth(1).fill("Edited validation workspace");
    await page.getByRole("button", { name: /^save$/i }).click();
    await expect(page.getByText("Edited validation workspace")).toBeVisible();

    await page.getByRole("button", { name: /^delete$/i }).first().click();
    await modal(page).getByRole("button", { name: /^delete$/i }).click();
    await expect(page.getByText("Release Lab")).toBeHidden();
    await expectNoUnknownTauriCommands(page);
  });

  test("saves provider credentials through secure storage and deletes the profile", async ({ page }) => {
    await preparePage(page, {
      responses: {
        has_secure_storage: true,
        test_provider_connection: { ok: true, latencyMs: 31 },
      },
    });
    await gotoApp(page);
    await openAdminSection(page, /^providers$/i);

    await page.getByRole("button", { name: /add provider/i }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("input").nth(0).fill("E2E Provider");
    await dialog.locator("select").nth(0).selectOption("custom");
    await dialog.locator("select").nth(1).selectOption("openai_chat");
    await dialog.locator("input").nth(1).fill("https://api.example.test");
    await dialog.locator("input").nth(2).fill("sk-e2e-secret");
    await dialog.locator("input").nth(3).fill("e2e-main");
    await dialog.getByRole("button", { name: /^save$/i }).click();

    await expect(page.getByText("E2E Provider")).toBeVisible();
    const providerCard = page.locator(".cd-provider-card").filter({ hasText: "E2E Provider" });
    await providerCard.getByRole("button", { name: /^activate$/i }).click();
    await expect(page.getByText(/^active$/i).first()).toBeVisible();
    await providerCard.getByRole("button", { name: /^test connection$/i }).click();
    await expect(page.getByText(/connected.*31ms/i)).toBeVisible();
    await providerCard.getByRole("button", { name: /^delete$/i }).click();
    await modal(page).getByRole("button", { name: /^delete$/i }).click();
    await expect(page.getByText("E2E Provider")).toBeHidden();
    await expectNoUnknownTauriCommands(page);
  });

  test("surfaces provider connection failures without saving plaintext fallback", async ({ page }) => {
    await preparePage(page, {
      responses: {
        has_secure_storage: true,
        test_provider_connection: { ok: false, message: "401 unauthorized" },
      },
    });
    await gotoApp(page);
    await openAdminSection(page, /^providers$/i);

    await page.getByRole("button", { name: /add provider/i }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("input").nth(0).fill("Broken Provider");
    await dialog.locator("input").nth(1).fill("https://api.example.test");
    await dialog.locator("input").nth(2).fill("sk-broken");
    await dialog.locator("input").nth(3).fill("broken-main");
    await dialog.getByRole("button", { name: /^test connection$/i }).click();
    await expect(dialog.getByText(/401 unauthorized/i)).toBeVisible();
    await expectNoUnknownTauriCommands(page);
  });

  test("launches a CLI session from Command Center and can terminate an active session", async ({ page }) => {
    await preparePage(page, {
      seed: workspaceSeed(),
      responses: {
        get_all_clis: [CLI_CODEX],
        check_clis: [{ name: "Codex CLI", installed: true, version: "0.21.0", install_command: null }],
        list_active_sessions: [{
          session_id: "session-live",
          cli_key: "codex",
          directory: "C:\\dev\\critical",
          started_at: NOW,
          kind: "tracked",
          pid: 4242,
        }],
      },
    });
    await gotoApp(page);

    await expect(page.getByText("Critical Workspace")).toBeVisible();
    await page.getByRole("button", { name: /^launch workspace$/i }).click();
    await modal(page).getByRole("button", { name: /^confirm$/i }).click();
    await expect(page.getByRole("button", { name: /^kill$/i })).toBeVisible();
    await page.getByRole("button", { name: /^kill$/i }).click();
    await modal(page).getByRole("button", { name: /^kill$/i }).click();
    await expectNoUnknownTauriCommands(page);
  });

  test("scans project stack and writes a project profile", async ({ page }) => {
    await preparePage(page, {
      seed: workspaceSeed(),
      responses: {
        get_all_clis: [CLI_CODEX],
        check_clis: [{ name: "Codex CLI", installed: true, version: "0.21.0", install_command: null }],
        read_project_profile: null,
        scan_project_stack: {
          files: ["package.json", "src/app/App.tsx", "playwright.config.ts"],
          manifests: { "package.json": "{\"scripts\":{\"test\":\"vitest run\"}}" },
        },
      },
    });
    await gotoApp(page);

    await expect(page.getByText(/package\.json/i).first()).toBeVisible();
    await page.getByRole("button", { name: /create profile/i }).first().click();
    await expect(modal(page)).toBeVisible();
    await modal(page).getByRole("button", { name: /create profile/i }).click();
    await expect(page.getByText(/\.ailauncher\.json found/i)).toBeVisible();
    await expectNoUnknownTauriCommands(page);
  });

  test("dry-runs, retries and resumes runbook executions", async ({ page }) => {
    await preparePage(page, {
      seed: `
        ${runbookSeed()}
        localStorage.setItem("ai-launcher:v20:runbook-executions", JSON.stringify({ executions: [{
          id: "run-resume",
          runbookId: "rb-critical",
          runbookName: "Critical release check",
          runbookUpdatedAt: ${JSON.stringify(NOW)},
          cwd: "C:\\\\dev\\\\critical",
          workspaceId: "ws-critical",
          mode: "execute",
          status: "failed",
          nextStepIndex: 1,
          attempt: 1,
          startedAt: ${JSON.stringify(NOW)},
          steps: [
            { stepId: "step-types", label: "Typecheck", status: "success", output: "ok" },
            { stepId: "step-tests", label: "Unit tests", status: "failed", output: "failed" }
          ]
        }] }));
      `,
      responses: {
        run_runbook_step: { ok: false, exit_code: 1, stdout: "", stderr: "unit failure", timed_out: false },
      },
    });
    await gotoApp(page);
    await page.keyboard.press("Control+7");
    await page.getByRole("button", { name: /manage runbooks/i }).click();
    await page.getByRole("button", { name: /^run$/i }).click();

    await page.getByRole("button", { name: /dry run/i }).click();
    await expect(page.getByText(/ready to execute/i).first()).toBeVisible();
    await page.getByRole("button", { name: /^run$/i }).click();
    await modal(page).getByRole("button", { name: /approve step/i }).click();
    await expect(page.getByText(/unit failure/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /resume/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /retry failed/i })).toBeVisible();
    await expectNoUnknownTauriCommands(page);
  });

  test("adds an MCP server from the catalog and verifies health UI", async ({ page }) => {
    await preparePage(page, {
      responses: {
        list_mcp_servers: [{
          name: "context7",
          cli: "codex",
          transport: "stdio",
          command: "npx",
          args: ["-y", "@upstash/context7-mcp@latest"],
          env_keys: [],
          headers_keys: [],
          enabled: true,
        }],
        mcp_health_check: { ok: true, detail: "healthy" },
      },
    });
    await gotoApp(page);
    await page.keyboard.press("Control+4");

    await expect(page.getByText("context7").first()).toBeVisible();
    await expect(page.getByText(/healthy/i).first()).toBeVisible();
    await page.getByRole("button", { name: /^\+ add$/i }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("input").nth(0).fill("e2e_server");
    await dialog.locator("input").nth(1).fill("node");
    await dialog.locator("input").nth(2).fill("server.js");
    await dialog.getByRole("button", { name: /^add$/i }).click();
    await expectNoUnknownTauriCommands(page);
  });

  test("previews backup import, merges safely, and requires confirmation for replace", async ({ page }) => {
    await preparePage(page);
    await gotoApp(page);
    await openAdminSection(page, /^backup$/i);

    const backup = {
      version: "21.0.0",
      exportedAt: NOW,
      manifest: {
        format: "ai-launcher-config",
        schemaVersion: 2,
        appVersion: "21.0.0",
        exportedAt: NOW,
        keyCount: 1,
        keys: ["workspaces"],
        redactedCount: 0,
      },
      keys: {
        workspaces: [{
          id: "ws-imported",
          name: "Imported Workspace",
          directory: "C:\\dev\\imported",
          cliKeys: ["codex"],
          envVars: {},
          tags: [],
          pinned: false,
          createdAt: NOW,
          updatedAt: NOW,
        }],
      },
    };
    await page.locator('input[type="file"]').setInputFiles({
      name: "ai-launcher-backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(backup)),
    });

    await expect(page.getByText("ai-launcher-backup.json")).toBeVisible();
    await expect(page.getByText(/1 known/i)).toBeVisible();
    await page.getByRole("button", { name: /^merge$/i }).click();
    await expect(page.getByText(/1 keys imported/i)).toBeVisible();
    await page.getByRole("button", { name: /^replace$/i }).click();
    await expect(modal(page)).toBeVisible();
    await modal(page).getByRole("button", { name: /replace/i }).click();
    await expectNoUnknownTauriCommands(page);
  });

  test("renders updater failure paths for app and CLI updates", async ({ page }) => {
    await preparePage(page, {
      responses: {
        check_app_update: { __error: "manifest signature mismatch" },
        check_all_updates: {
          cli_updates: [{ cli: "Codex CLI", current: "0.21.0", latest: "0.22.0", has_update: true, method: "npm", no_api: false, key: "codex" }],
          tool_updates: [],
          env_updates: [],
          checked_at: NOW,
          total_with_updates: 1,
        },
        update_all_clis: { __error: "network unavailable" },
      },
    });
    await gotoApp(page);
    await page.keyboard.press("Control+9");

    await page.getByRole("button", { name: /check application/i }).click();
    await expect(page.getByText(/manifest signature mismatch/i)).toBeVisible();
    await page.getByRole("button", { name: /update all/i }).click();
    await expect(page.getByText(/network unavailable/i)).toBeVisible();
    await expectNoUnknownTauriCommands(page);
  });

  test("keeps global keyboard navigation operable across critical pages", async ({ page }) => {
    await preparePage(page, { seed: runbookSeed() });
    await gotoApp(page);

    for (const target of [
      { shortcut: "Control+2", heading: /launch/i },
      { shortcut: "Control+4", heading: /mcp servers/i },
      { shortcut: "Control+7", heading: /workspaces/i },
      { shortcut: "Control+8", heading: /environment doctor/i },
      { shortcut: "Control+9", heading: /updates/i },
      { shortcut: "Control+0", heading: /prerequisites/i },
    ]) {
      await page.locator("body").click();
      await page.keyboard.press(target.shortcut);
      await expect(page.getByRole("heading", { name: target.heading }).first()).toBeVisible();
    }

    await page.keyboard.press("Control+Comma");
    await expect(page.getByRole("heading", { name: /admin/i }).first()).toBeVisible();
    await expectNoUnknownTauriCommands(page);
  });
});
