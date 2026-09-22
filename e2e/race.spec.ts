import { expect, test, type Page } from "@playwright/test";
import {
  expectNoUnknownTauriCommands,
  installTauriStub,
  type TauriStubOverrides,
} from "./tauriStub";
import { openSidebarSurface } from "./navigation";

const CLI_CLAUDE = {
  key: "claude",
  name: "Claude Code",
  command: "claude",
  flag: null,
  install_cmd: "npm i -g @anthropic-ai/claude-code",
  version_cmd: "claude --version",
  npm_pkg: "@anthropic-ai/claude-code",
  pip_pkg: null,
  install_method: "npm",
  install_url: null,
  extra_paths: [],
  update_manifest_url: null,
};

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

const DETECTED_RESPONSES: TauriStubOverrides = {
  get_all_clis: [CLI_CLAUDE, CLI_CODEX],
  check_clis: [
    { name: "Claude Code", installed: true, version: "2.1.3", install_command: null },
    { name: "Codex CLI", installed: true, version: "0.21.0", install_command: null },
  ],
};

async function preparePage(
  page: Page,
  options: { seed?: string } = {},
): Promise<void> {
  await installTauriStub(page, { onboardingDone: true, responses: DETECTED_RESPONSES });
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

async function startRace(page: Page): Promise<void> {
  await openSidebarSurface(page, "Race");
  await expect(page.getByRole("heading", { name: /race/i }).first()).toBeVisible();
  await page.getByLabel("Workspace directory").fill("C:/projeto-race");
  await page.getByLabel("Task prompt").fill("refactor the parser modules");
  await page.getByRole("checkbox", { name: /Claude Code/ }).check();
  await page.getByRole("checkbox", { name: /Codex CLI/ }).check();
  await page.getByRole("button", { name: "Start race" }).click();
}

test("starts a race from the form and reaches the finished state", async ({ page }) => {
  // Fake race flips to "completed" on the 3rd poll (immediate + 2s cadence).
  await preparePage(page, {
    seed: `localStorage.setItem("ai-launcher:e2e-race-flip-after", "3");`,
  });
  await gotoApp(page);

  await startRace(page);

  const columns = page.locator(".cd-race__column");
  await expect(columns).toHaveCount(2);
  await expect(page.locator(".cd-race__live")).toBeVisible();
  await expect(columns.first()).toContainText("running");

  // Workspace warnings captured at start render as a banner.
  await expect(page.getByText("Limitations detected in this workspace")).toBeVisible();

  await expect(columns.first()).toContainText("completed", { timeout: 20_000 });
  await expect(columns.nth(1)).toContainText("completed");
  await expect(page.getByText("Race completed")).toBeVisible();
  await expect(page.getByRole("button", { name: "New race" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel race" })).toHaveCount(0);

  await expectNoUnknownTauriCommands(page);
});

test("cancels a running race after confirmation", async ({ page }) => {
  // Flip count far beyond the test duration: the fake stays "running".
  await preparePage(page, {
    seed: `localStorage.setItem("ai-launcher:e2e-race-flip-after", "50");`,
  });
  await gotoApp(page);

  await startRace(page);
  await expect(page.locator(".cd-race__column")).toHaveCount(2);

  await page.getByRole("button", { name: "Cancel race" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel race" }).click();

  await expect(page.getByText("Race cancelled")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(".cd-race__column").first()).toContainText("killed");
  await expect(page.getByRole("button", { name: "New race" })).toBeVisible();

  await expectNoUnknownTauriCommands(page);
});
