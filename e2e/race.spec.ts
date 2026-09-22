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
  options: { seed?: string; responses?: TauriStubOverrides } = {},
): Promise<void> {
  await installTauriStub(page, {
    onboardingDone: true,
    responses: { ...DETECTED_RESPONSES, ...options.responses },
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

test("views the diff cockpit and adopts the winner with branch mode", async ({ page }) => {
  // Flip on the 2nd poll so the Cockpit opens quickly.
  await preparePage(page, {
    seed: `localStorage.setItem("ai-launcher:e2e-race-flip-after", "2");`,
  });
  await gotoApp(page);

  await startRace(page);

  // Once an agent completes, the Cockpit auto-opens with its diff.
  await expect(page.getByText("Race completed")).toBeVisible({ timeout: 20_000 });
  const cockpit = page.locator(".cd-race__cockpit");
  await expect(cockpit).toBeVisible();
  await expect(cockpit.locator(".cd-race__files")).toContainText("src/parser.ts");

  // Per-agent "View diff" switches the cockpit to that agent's patch.
  await page
    .locator(".cd-race__column", { hasText: "codex" })
    .getByRole("button", { name: "View diff" })
    .click();
  await expect(cockpit.locator(".cd-race__patch")).toContainText("updated by codex");

  // The unified patch is colorized per line kind with pure CSS classes.
  await expect(cockpit.locator(".cd-race__line--add").first()).toContainText("+const next = 2;");
  await expect(cockpit.locator(".cd-race__line--del").first()).toContainText("-const old = 2;");
  await expect(cockpit.locator(".cd-race__line--hunk").first()).toBeVisible();
  await expect(cockpit.locator(".cd-race__line--meta").first()).toBeVisible();

  // Adopt the winner with the default safe mode; the report names the branch.
  await cockpit.getByRole("button", { name: "Adopt (branch)" }).click();
  await expect(
    page.getByText("Adoption branch created for codex").first(),
  ).toBeVisible();
  await expect(page.getByText("Result adopted", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear worktrees" })).toBeVisible();

  await expectNoUnknownTauriCommands(page);
});

// --- 23.2d: crash recovery banner + graveyard --------------------------------

const ORPHAN_SCAN: NonNullable<TauriStubOverrides["race_scan_orphans"]> = {
  orphans: [
    {
      race_id: "race-orphan-1",
      directory: "C:/projeto-orfao",
      started_at: "2020-01-01T08:00:00.000Z",
      agents: ["claude", "codex"],
      worktree_root: "C:/races/race-orphan-1",
      base_sha: "orphanbase0000000000000000000000000000000",
      branches: ["race/race-orphan-1/claude", "race/race-orphan-1/codex"],
      worktrees: ["C:/races/race-orphan-1/claude", "C:/races/race-orphan-1/codex"],
    },
  ],
};

const RECOVER_REPORT: NonNullable<TauriStubOverrides["race_recover"]> = {
  race_id: "race-orphan-1",
  removed_worktrees: ["C:/races/race-orphan-1/claude", "C:/races/race-orphan-1/codex"],
  removed_branches: ["race/race-orphan-1/claude", "race/race-orphan-1/codex"],
  pruned: true,
  skipped_reason: null,
  unverified_processes: [
    "claude: identidade do pid 4200 não confere — processo não verificado, não finalizado",
  ],
};

const HISTORY_ARCHIVED: NonNullable<TauriStubOverrides["race_list_history"]> = [
  {
    race_id: "race-old-1",
    directory: "C:/projeto-antigo",
    base_sha: "oldbase0000000000000000000000000000000000",
    status: "cleaned",
    started_at: "2020-01-01T10:00:00.000Z",
    finished_at: "2020-01-01T10:05:00.000Z",
    agents: ["claude", "codex"],
    branches: [],
    worktrees: [],
    worktrees_present: false,
  },
];

test("recovers an orphaned race from the boot banner", async ({ page }) => {
  await preparePage(page, {
    responses: {
      race_scan_orphans: ORPHAN_SCAN,
      race_recover: RECOVER_REPORT,
      // The recovered race lands in the graveyard, which then shows the
      // cleanup report with the spared (unverified) process listed.
      race_list_history: [
        {
          race_id: "race-orphan-1",
          directory: "C:/projeto-orfao",
          base_sha: "orphanbase0000000000000000000000000000000",
          status: "cleaned",
          started_at: "2020-01-01T08:00:00.000Z",
          finished_at: "2020-01-01T08:05:00.000Z",
          agents: ["claude", "codex"],
          branches: [],
          worktrees: [],
          worktrees_present: false,
        },
      ],
    },
  });
  await gotoApp(page);
  await openSidebarSurface(page, "Race");

  const banner = page.locator(".cd-race__orphans");
  await expect(banner).toContainText("orphaned race(s)");
  await expect(banner).toContainText("C:/projeto-orfao");

  // Inspect expands the inline details (directory, agents, worktree root).
  await banner.getByRole("button", { name: "Inspect" }).click();
  await expect(banner.locator(".cd-race__orphan-details")).toContainText("claude, codex");

  // Clear kills the leftover processes and removes the worktrees (confirm first).
  await banner.getByRole("button", { name: "Clear", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Clear", exact: true }).click();

  // The orphan leaves the banner right away — the scan is a boot snapshot,
  // not a polled live view.
  await expect(banner).toHaveCount(0);

  // The graveyard reloads and lists the spared process from the recover
  // report verbatim (identity could not be verified, so it was not killed).
  const graveyard = page.locator(".cd-race__graveyard");
  await expect(graveyard).toContainText("Processes not killed");
  await expect(graveyard).toContainText("não verificado, não finalizado");

  await expectNoUnknownTauriCommands(page);
});

test("lists previous races and restores an archived record read-only", async ({ page }) => {
  await preparePage(page, {
    responses: { race_list_history: HISTORY_ARCHIVED },
  });
  await gotoApp(page);
  await openSidebarSurface(page, "Race");

  const graveyard = page.locator(".cd-race__graveyard");
  await expect(graveyard).toContainText("Previous races");
  await expect(graveyard).toContainText("C:/projeto-antigo");
  await expect(graveyard).toContainText("archived");
  // Long-expired record shows the automatic-cleanup eligibility notice.
  await expect(graveyard).toContainText("Eligible for automatic cleanup");

  // Restoring a cleaned race opens the read-only record, never the cockpit.
  await graveyard.getByRole("button", { name: /Restore/ }).click();
  const archived = page.locator(".cd-race__archived");
  await expect(archived).toContainText("Archived race");
  await expect(archived).toContainText("C:/projeto-antigo");
  await expect(page.getByRole("button", { name: "View diff" })).toHaveCount(0);

  await expectNoUnknownTauriCommands(page);
});
