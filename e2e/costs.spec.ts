import { expect, test, type Page } from "@playwright/test";
import {
  expectNoUnknownTauriCommands,
  installTauriStub,
  type TauriStubOverrides,
} from "./tauriStub";
import { openSidebarSurface } from "./navigation";

// ==============================================================================
// Cost Governance 3.0 (wave 3d): month projection card, canonical project
// ranking and project budgets. All seeds are front-only (no new Tauri
// command) and relative to the real current date so the suite runs any day.
// ==============================================================================

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

function isoDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysInCurrentMonth(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

function daysRemainingInMonth(): number {
  return daysInCurrentMonth() - new Date().getDate();
}

interface SeedEntry {
  date: string;
  cli: string;
  provider: string;
  model: string | null;
  tokens_in: number;
  tokens_out: number;
  cost_estimate_usd: number;
  project: string;
  project_path: string | null;
}

/** Spread `totalUsd` evenly across `dayOffsets` (all inside the current month).
 *  Every entry carries the same `project_path` so all of them reconcile to ONE
 *  canonical key (label-only entries would form a distinct key without a
 *  matching workspace — D5 best-effort by design). */
function monthEntries(dayOffsets: number[], totalUsd: number): SeedEntry[] {
  const each = totalUsd / dayOffsets.length;
  return dayOffsets.map((offset, i) => ({
    date: isoDate(offset),
    cli: i % 2 === 0 ? "codex" : "claude",
    provider: i % 2 === 0 ? "openai" : "anthropic",
    model: i % 2 === 0 ? "gpt-5" : "opus",
    tokens_in: 1000,
    tokens_out: 500,
    cost_estimate_usd: each,
    project: "Web Portal",
    project_path: "C:/dev/web-portal",
  }));
}

const DETECTED_RESPONSES: TauriStubOverrides = {
  get_all_clis: [CLI_CLAUDE],
  check_clis: [
    { name: "Claude Code", installed: true, version: "2.1.3", install_command: null },
  ],
};

interface CostsSeed {
  entries: SeedEntry[];
  /** v3 budget limits written straight to the storage key. */
  limits?: unknown[];
}

async function prepareCostsPage(page: Page, seed: CostsSeed): Promise<void> {
  await installTauriStub(page, {
    onboardingDone: true,
    responses: {
      ...DETECTED_RESPONSES,
      read_usage_stats: { entries: seed.entries },
    },
  });
  await page.addInitScript(({ limits }) => {
    localStorage.setItem("ai-launcher:locale", "en");
    localStorage.setItem("ai-launcher:theme", "dark");
    localStorage.setItem("ai-launcher:v21:execution-mode", "safe");
    if (limits) {
      localStorage.setItem("ai-launcher:v15:budget", JSON.stringify({ limits }));
    }
  }, { limits: seed.limits ?? null });
}

async function gotoCosts(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await expect(page.locator("body")).toBeVisible();
  await openSidebarSurface(page, "Analytics");
  await expect(page.getByRole("heading", { name: /costs/i }).first()).toBeVisible();
}

function projectBudgetLimit(
  projectKey: string,
  displayName: string,
  limitUsd: number,
): Record<string, unknown> {
  return {
    id: `bgp-${projectKey}`,
    scope: { kind: "project", projectKey, displayName },
    limitUsd,
    period: { kind: "calendar-month" },
    alertAtPercent: 80,
    createdAt: isoDate(30),
  };
}

test("shows the month projection, burn windows and budget ETA with enough data", async ({ page }) => {
  // $6.00 accrued over 3 distinct days; a $6.30 calendar-month quota means
  // the 14-day burn (6/14 per day) crosses it tomorrow.
  const dayOffsets = [0, 1, 2];
  // Day-of-month 1-2 cannot hold 3 distinct seeded days: skip honestly.
  test.skip(
    new Date().getDate() < 3,
    "month projection needs 3 distinct current-month days",
  );
  await prepareCostsPage(page, {
    entries: monthEntries(dayOffsets, 6.0),
    limits: [projectBudgetLimit("c:/dev/web-portal", "Web Portal", 6.3)],
  });
  await gotoCosts(page);

  const forecast = page.locator(".cd-costs__forecast");
  await expect(forecast.getByText("Month to date", { exact: true })).toBeVisible();
  await expect(forecast.getByText("$6.00").first()).toBeVisible();
  await expect(forecast.getByText("Projected month end")).toBeVisible();
  await expect(forecast.getByText("Daily burn (7-day window)")).toBeVisible();
  await expect(forecast.getByText("Daily burn (14-day window)")).toBeVisible();
  // Period labeling (gate copy): windows are named, not bare numbers.
  await expect(
    forecast.getByText("Projection = month to date + 14-day daily-burn average."),
  ).toBeVisible();

  // Overflow ETA appears only while the crossing still lands inside the month.
  const burn14 = 6.0 / 14;
  const etaDays = Math.ceil((6.3 - 6.0) / burn14);
  if (daysRemainingInMonth() >= etaDays) {
    const etaDate = new Date();
    etaDate.setDate(etaDate.getDate() + etaDays);
    const expected = etaDate.toLocaleDateString("en-US", { day: "numeric", month: "short" });
    await expect(forecast.getByText(`Budget overflows around ~${expected}`)).toBeVisible();
  } else {
    await expect(forecast.getByText(/Budget overflows/)).toHaveCount(0);
  }

  // Canonical ranking shows the reconciled display name once (labels deduped).
  const ranking = page.getByRole("list", { name: "Top projects (30d)" });
  await expect(ranking.getByText("Web Portal")).toHaveCount(1);
  await expectNoUnknownTauriCommands(page);
});

test("shows the honest insufficient-data state with fewer than 3 days", async ({ page }) => {
  await prepareCostsPage(page, { entries: monthEntries([0], 4.2) });
  await gotoCosts(page);

  const forecast = page.locator(".cd-costs__forecast");
  await expect(forecast.getByText("Insufficient data to project")).toBeVisible();
  await expect(
    forecast.getByText("Fewer than 3 days with usage this month — nothing is projected."),
  ).toBeVisible();
  // D3: zero projected numbers when the data is insufficient. Month-to-date
  // is a measurement and stays visible.
  await expect(forecast.getByText("Projected month end")).toHaveCount(0);
  await expect(forecast.getByText("Daily burn (14-day window)")).toHaveCount(0);
  await expectNoUnknownTauriCommands(page);
});

test("creates a project budget from the Projects tab", async ({ page }) => {
  // Previous-month entries only (10 days before the 1st): the new budget
  // starts at a clean 0%. Both entries share the canonical key, so the
  // dropdown dedupes them into a single "Web Portal" option.
  await prepareCostsPage(page, {
    entries: [
      {
        date: isoDate(new Date().getDate() + 10),
        cli: "codex",
        provider: "openai",
        model: "gpt-5",
        tokens_in: 1000,
        tokens_out: 500,
        cost_estimate_usd: 3.5,
        project: "Web Portal",
        project_path: "C:/dev/web-portal",
      },
      {
        date: isoDate(new Date().getDate() + 10),
        cli: "claude",
        provider: "anthropic",
        model: "opus",
        tokens_in: 1000,
        tokens_out: 500,
        cost_estimate_usd: 1.5,
        project: "Web Portal",
        project_path: "C:/dev/web-portal",
      },
    ],
  });
  await gotoCosts(page);

  // WAI-ARIA tablist with keyboard navigation (←/→ moves selection).
  const projectsTab = page.getByRole("tab", { name: "Projects" });
  await page.getByRole("tab", { name: "Providers" }).click();
  await page.keyboard.press("ArrowRight");
  await expect(projectsTab).toBeFocused();
  await expect(projectsTab).toHaveAttribute("aria-selected", "true");
  await projectsTab.click();

  await page.getByRole("button", { name: "Add budget limit" }).click();
  await page.getByLabel("Project", { exact: true }).selectOption({ label: "Web Portal" });
  await page.getByLabel("Limit (USD)").fill("20");
  await page.getByLabel("Alert at (% of limit)").fill("80");
  await page.getByRole("button", { name: "Save" }).click();

  // The bar renders with the reconciled display name, the fixed calendar
  // month label (D1) and an accessible progressbar at 0%.
  const bar = page.getByRole("progressbar", { name: "Web Portal budget: 0.0% used" });
  await expect(bar).toBeVisible();
  await expect(bar).toHaveAttribute("aria-valuemin", "0");
  await expect(bar).toHaveAttribute("aria-valuemax", "100");
  await expect(bar).toHaveAttribute("aria-valuenow", "0");
  await expect(page.getByText("Monthly (calendar)")).toBeVisible();
  await expect(page.getByText("ok", { exact: true })).toBeVisible();
  await expectNoUnknownTauriCommands(page);
});

test("surfaces warning and exceeded project budgets", async ({ page }) => {
  // Yesterday must stay inside the current month for the quota math below.
  test.skip(
    new Date().getDate() < 2,
    "seeds need today and yesterday inside the same calendar month",
  );
  // Fresh dates inside the current month, relative to today.
  const entries: SeedEntry[] = [];
  for (const [offset, cost, path] of [
    [0, 5.0, "C:/dev/web-portal"],
    [1, 4.0, "C:/dev/web-portal"],
    [0, 4.0, "C:/dev/platform-api"],
    [1, 2.0, "C:/dev/platform-api"],
  ] as const) {
    entries.push({
      date: isoDate(offset),
      cli: "codex",
      provider: "openai",
      model: "gpt-5",
      tokens_in: 1000,
      tokens_out: 500,
      cost_estimate_usd: cost,
      project: path === "C:/dev/web-portal" ? "Web Portal" : "Platform API",
      project_path: path,
    });
  }
  await prepareCostsPage(page, {
    entries,
    limits: [
      projectBudgetLimit("c:/dev/web-portal", "Web Portal", 10),
      projectBudgetLimit("c:/dev/platform-api", "Platform API", 5),
    ],
  });
  await gotoCosts(page);

  await page.getByRole("tab", { name: "Projects" }).click();

  // 9/10 = 90% (>= alert 80) -> warning; 6/5 = 120% -> over limit.
  await expect(
    page.getByRole("progressbar", { name: "Web Portal budget: 90.0% used" }),
  ).toBeVisible();
  await expect(
    page.getByRole("progressbar", { name: "Platform API budget: 120.0% used" }),
  ).toHaveAttribute("aria-valuenow", "100");
  await expect(page.getByText("warning", { exact: true })).toBeVisible();
  await expect(page.getByText("over limit", { exact: true })).toBeVisible();
  // The ranking's budget column mirrors the same states.
  await expect(page.locator(".cd-costs__proj-budget--warning")).toHaveCount(1);
  await expect(page.locator(".cd-costs__proj-budget--exceeded")).toHaveCount(1);
  await expectNoUnknownTauriCommands(page);
});
