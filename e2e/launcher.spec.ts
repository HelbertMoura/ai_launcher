import { test, expect } from "@playwright/test";

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
          if (cmd === "get_all_tools") return [];
          if (cmd === "check_all_updates")
            return { cli_updates: [], tool_updates: [], env_updates: [] };
          return null;
        },
      };
    });
  });

  test("loads the app and shows launcher tab", async ({ page }) => {
    await page.goto("/");

    // Wait for React to mount and i18n to resolve
    await page.waitForLoadState("domcontentloaded");
    // Wait briefly for React + i18n to mount
    await page.waitForTimeout(500);

    // The Launcher tab should be the default active one
    const body = await page.locator("body");
    await expect(body).toBeVisible();

    // At least one of these should appear (covering EN and pt-BR)
    const hasLaunch = await page.getByText(/launch|lançar/i).count();
    expect(hasLaunch).toBeGreaterThan(0);
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
});
