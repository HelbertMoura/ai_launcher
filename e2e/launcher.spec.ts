import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("AI Launcher Pro smoke", () => {
  test.beforeEach(async ({ page }) => {
    // Stub Tauri invoke so frontend doesn't error out when calling backend,
    // and mark onboarding as done so the main launcher renders directly.
    await page.addInitScript(() => {
      try {
        localStorage.setItem("ai-launcher:onboarding-done", "true");
      } catch {
        /* ignore */
      }
      // @ts-expect-error — stubbed globals for Tauri
      window.__TAURI_INTERNALS__ = {
        invoke: async (cmd: string) => {
          if (cmd === "get_all_clis") return [];
          if (cmd === "check_clis") return [];
          if (cmd === "get_all_tools") return [];
          if (cmd === "check_environment") return [];
          if (cmd === "list_active_sessions") return [];
          if (cmd === "list_mcp_servers") return [];
          if (cmd === "read_project_profile") return null;
          if (cmd === "scan_project_stack") return { files: [], manifests: {} };
          if (cmd === "write_project_profile") return null;
          if (cmd === "check_all_updates")
            return { cli_updates: [], tool_updates: [], env_updates: [] };
          return null;
        },
      };
    });
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
  });
});
