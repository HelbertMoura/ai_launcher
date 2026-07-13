import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  expectNoUnknownTauriCommands,
  installTauriStub,
} from "./tauriStub";

test.describe("AI Launcher Pro smoke", () => {
  test.beforeEach(async ({ page }) => {
    await installTauriStub(page);
  });

  test("loads the app and shows Command Center", async ({ page }) => {
    await page.goto("/");

    // Wait for React to mount and i18n to resolve
    await page.waitForLoadState("domcontentloaded");
    // Wait briefly for React + i18n to mount
    await page.waitForTimeout(500);

    // The Command Center should be the default active page.
    const body = await page.locator("body");
    await expect(body).toBeVisible();

    await expect(page.getByRole("heading", { name: /command center/i })).toBeVisible();
    await expectNoUnknownTauriCommands(page);
  });

  test("navigates to Admin", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    // Wait briefly for React + i18n to mount
    await page.waitForTimeout(500);

    // Focus body to ensure keydown listener on window fires (input/textarea filters it out)
    await page.locator("body").click();

    // Ctrl+, should open admin (handler checks IS_MAC ? metaKey : ctrlKey)
    await page.keyboard.press("Control+Comma");

    // Should see admin content (Providers, Presets, or Appearance) — wait up to 5s
    await expect(
      page.getByText(/providers|appearance|aparência|presets/i).first(),
    ).toBeVisible({ timeout: 5000 });
    await expectNoUnknownTauriCommands(page);
  });

  test("main Command Center page has no serious accessibility violations", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    // Wait briefly for React + i18n to mount before scanning the DOM
    await page.waitForTimeout(500);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      // WCAG 1.4.3 "pure decoration" exception: the StatusBar brand watermark
      // is intentionally faint, aria-hidden, and carries no information. The
      // color-contrast rule stays ACTIVE for everything else on the page.
      .exclude(".cd-status__cell--brand")
      .analyze();

    const seriousOrCritical = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );

    // Surface a readable summary in the test report when something fails
    expect(
      seriousOrCritical,
      `Accessibility violations:\n${seriousOrCritical
        .map((v) => `- [${v.impact}] ${v.id}: ${v.help}`)
        .join("\n")}`,
    ).toEqual([]);
    await expectNoUnknownTauriCommands(page);
  });

  test("shell navigation and quick settings are keyboard operable", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    const collapse = page.getByRole("button", { name: /collapse navigation/i });
    await collapse.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".cd-app")).toHaveClass(/cd-app--nav-collapsed/);
    const sidebarMetrics = await page.evaluate(() => {
      const sidebar = document.querySelector(".cd-side")?.getBoundingClientRect();
      const indicators = Array.from(document.querySelectorAll(".cd-side__indicator")).map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          text: node.textContent ?? "",
          right: rect.right,
          width: rect.width,
        };
      });
      return { sidebarRight: sidebar?.right ?? 0, indicators };
    });
    for (const indicator of sidebarMetrics.indicators) {
      expect(indicator.right).toBeLessThanOrEqual(sidebarMetrics.sidebarRight);
      expect(indicator.width).toBeLessThanOrEqual(24);
      expect(indicator.text.length).toBeLessThanOrEqual(2);
    }

    const settings = page.locator('summary[aria-label="Quick settings"]');
    await settings.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText(/accent color/i)).toBeVisible();
    await expectNoUnknownTauriCommands(page);
  });

  test("fits the supported 1024x700 window without document clipping", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 700 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /command center/i })).toBeVisible();
    await expect(page.locator(".cd-status")).toBeVisible();
    const metrics = await page.evaluate(() => ({
      viewport: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      statusBottom: document.querySelector('.cd-status')?.getBoundingClientRect().bottom ?? 0,
      viewportHeight: window.innerHeight,
    }));
    expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewport);
    expect(metrics.statusBottom).toBeLessThanOrEqual(metrics.viewportHeight);
  });

  test("exposes execution modes in Admin security", async ({ page }) => {
    await page.goto("/");
    await page.locator("body").click();
    await page.keyboard.press("Control+Comma");
    await page.getByRole("button", { name: "Security" }).click();
    await expect(page.getByRole("heading", { name: /execution mode/i })).toBeVisible();
    await expect(page.getByText("Safe", { exact: true }).first()).toBeVisible();
  });

  test("dry-runs a workspace runbook and exposes resumable activity", async ({ page }) => {
    await page.addInitScript(() => {
      const now = "2026-07-13T10:00:00.000Z";
      localStorage.setItem("ai-launcher:v15:workspace", JSON.stringify([{
        id: "ws-e2e", name: "E2E Workspace", directory: "C:\\dev\\e2e", cliKeys: [],
        envVars: {}, tags: [], pinned: false, createdAt: now, updatedAt: now,
      }]));
      localStorage.setItem("ai-launcher:v15:active-workspace", "ws-e2e");
      localStorage.setItem("ai-launcher:v15:runbooks", JSON.stringify({ runbooks: [{
        id: "rb-e2e", name: "Validate project", tags: [], createdAt: now, updatedAt: now,
        steps: [{ id: "step-e2e", label: "Check project", type: "check", command: "node --version", auto: true }],
      }] }));
    });
    await page.goto("/");
    await page.locator("body").click();
    await page.keyboard.press("Control+7");
    await page.getByRole("button", { name: /^(manage runbooks|gerenciar runbooks)$/i }).click();
    await page.getByRole("button", { name: /^(run|executar)$/i }).click();
    await page.getByRole("button", { name: /dry run|simular/i }).click();

    await expect(page.getByText(/ready to execute|pronto para executar/i)).toBeVisible();
    await expect(page.getByText(/dry run validated|dry-run validado/i)).toBeVisible();
    await expectNoUnknownTauriCommands(page);
  });
});
