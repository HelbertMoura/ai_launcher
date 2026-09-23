import { expect, test, type Page } from "@playwright/test";
import {
  expectNoUnknownTauriCommands,
  installTauriStub,
} from "./tauriStub";

/**
 * Top-bar flyout regression guard (v23.1.1).
 *
 * Since v22.5.0 `.cd-app__top` carried `contain: layout style`, which created
 * a stacking context that trapped the inbox bell and quick-settings dropdowns
 * (both absolutely positioned with a positive z-index) inside the 56px top
 * bar. The sibling `.cd-app__main` — its own stacking context via
 * `contain: layout paint` plus an opaque background — painted after it in
 * tree order, so both open panels rendered INVISIBLE behind the page content:
 * clicks landed on the page and the buttons felt dead.
 *
 * `toBeVisible()` cannot catch this class of bug (it knows nothing about
 * paint order), so every open-panel test here ALSO hit-tests the flyout with
 * `document.elementFromPoint` at the panel's center.
 */

interface HitTestResult {
  ok: boolean;
  hit: string;
}

/** Hit-tests the panel: `elementFromPoint` at its center must return the panel or a descendant. */
async function hitTestAtPanelCenter(
  page: Page,
  panelSelector: string,
): Promise<HitTestResult> {
  return page.evaluate((selector) => {
    const panel = document.querySelector(selector);
    if (!(panel instanceof HTMLElement)) return { ok: false, hit: "panel not found" };
    const rect = panel.getBoundingClientRect();
    const el = document.elementFromPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
    return {
      ok: el instanceof Node && (el === panel || panel.contains(el)),
      hit:
        el instanceof Element
          ? `${el.tagName.toLowerCase()}${
              el.className ? `.${String(el.className).trim().split(/\s+/).join(".")}` : ""
            }`
          : "null",
    };
  }, panelSelector);
}

function expectPanelToWinHitTest(result: HitTestResult): void {
  expect(
    result.ok,
    `Paint-order regression: elementFromPoint at the panel center hit "${result.hit}" instead of the panel itself.`,
  ).toBe(true);
}

/** Seeds one unread inbox event so the panel renders a focusable item + footer actions. */
async function seedUnreadInboxEvent(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem(
      "ai-launcher:v16:inbox",
      JSON.stringify({
        events: [
          {
            id: "e2e-inbox-1",
            type: "update",
            titleKey: "inbox.updateTitle",
            titleParams: { cli: "codex", version: "9.9.9" },
            targetTab: "maintenance:updates",
            ts: Date.now(),
            read: false,
          },
        ],
        doctorFailing: [],
      }),
    );
  });
}

test.describe("top bar flyouts (inbox bell + quick settings)", () => {
  test.beforeEach(async ({ page }) => {
    await installTauriStub(page);
  });

  test("inbox bell panel opens on top of the main content and is clickable", async ({
    page,
  }) => {
    await seedUnreadInboxEvent(page);
    await page.goto("/");
    const bell = page.locator(".cd-inbox__bell");
    await expect(bell).toBeVisible();
    await expect(page.locator(".cd-inbox__badge")).toHaveText("1");

    await bell.click();
    const panel = page.locator(".cd-inbox__panel");
    await expect(panel).toBeVisible();
    // The actual guard: toBeVisible() passed even when the panel was painted
    // behind .cd-app__main and unclickable.
    expectPanelToWinHitTest(await hitTestAtPanelCenter(page, ".cd-inbox__panel"));

    // A real click on a panel control must land: mark-all-read clears the badge.
    await page.locator(".cd-inbox__foot-btn").first().click();
    await expect(page.locator(".cd-inbox__badge")).toHaveCount(0);
    await expect(panel).toBeVisible();

    // Click-outside closes.
    await page.getByRole("heading", { name: /command center/i }).click();
    await expect(page.locator(".cd-inbox__panel")).toHaveCount(0);
    await expect(bell).toHaveAttribute("aria-expanded", "false");
    await expectNoUnknownTauriCommands(page);
  });

  test("inbox bell panel closes on Escape and restores focus to the bell", async ({
    page,
  }) => {
    await seedUnreadInboxEvent(page);
    await page.goto("/");
    const bell = page.locator(".cd-inbox__bell");
    await expect(bell).toBeVisible();
    await bell.click();
    const panel = page.locator(".cd-inbox__panel");
    await expect(panel).toBeVisible();

    await page.locator(".cd-inbox__item").first().focus();
    await page.keyboard.press("Escape");

    await expect(page.locator(".cd-inbox__panel")).toHaveCount(0);
    await expect(bell).toHaveAttribute("aria-expanded", "false");
    await expect(bell).toBeFocused();
    await expectNoUnknownTauriCommands(page);
  });

  test("quick settings panel opens on top of the main content and is clickable", async ({
    page,
  }) => {
    await page.goto("/");
    const summary = page.locator(".cd-top__settings > summary");
    await expect(summary).toBeVisible();

    await summary.click();
    const settings = page.locator(".cd-top__settings");
    await expect(settings).toHaveAttribute("open", "");
    const panel = page.locator(".cd-top__settings-panel");
    await expect(panel).toBeVisible();
    expectPanelToWinHitTest(await hitTestAtPanelCenter(page, ".cd-top__settings-panel"));

    // A real click on a panel control must land: the density toggle flips.
    const densityBtn = page.locator(".cd-top__setting-btn[aria-pressed]");
    await densityBtn.click();
    await expect(densityBtn).toHaveAttribute("aria-pressed", "true");
    await expect(settings).toHaveAttribute("open", "");

    // The summary toggles the panel closed.
    await summary.click();
    await expect(settings).not.toHaveAttribute("open");
    await expect(panel).not.toBeVisible();
    await expectNoUnknownTauriCommands(page);
  });
});
