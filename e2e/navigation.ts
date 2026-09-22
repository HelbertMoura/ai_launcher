import { expect, type Page, type Locator } from "@playwright/test";

/**
 * Sidebar navigation helper for the v23 grouped layout (Home / Pinned +
 * collapsible Run / Observe / Connect / System groups).
 *
 * Groups can be persisted as collapsed, so before clicking a surface this
 * helper expands every collapsed group — the click then always lands no
 * matter what state localStorage holds. Pinned surfaces live in the always
 * visible "Pinned" section and are handled by the same click.
 */
export async function openSidebarSurface(page: Page, name: string | RegExp): Promise<void> {
  const nav = page.locator(".cd-side__nav");
  await expandCollapsedSidebarGroups(page);
  const item = nav.getByRole("button", { name }).first();
  await expect(item).toBeVisible();
  await item.click();
}

/** Expands every collapsed sidebar group (no-op when all are open). */
export async function expandCollapsedSidebarGroups(page: Page): Promise<void> {
  const collapsed = page.locator('.cd-side__group-head[aria-expanded="false"]');
  const count = await collapsed.count();
  for (let i = 0; i < count; i += 1) {
    await collapsed.nth(i).click();
  }
}

/**
 * Opens the fused Maintenance surface and activates one of its sections
 * (Diagnostics / Checks / Updates).
 */
export async function openMaintenanceSection(page: Page, section: string | RegExp): Promise<void> {
  await openSidebarSurface(page, "Maintenance");
  await page.getByRole("tab", { name: section }).click();
}

/**
 * Sidebar row (item button + pin star) that contains the given surface.
 * The item's accessible name also carries the shortcut chip
 * (e.g. "History Ctrl+5"), so matching is anchored at the start only.
 */
export function sidebarRow(page: Page, name: string): Locator {
  return page.locator(".cd-side__row").filter({
    has: page.getByRole("button", { name: new RegExp(`^${name}`) }),
  });
}
