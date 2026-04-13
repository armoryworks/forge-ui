import { Page, expect } from '@playwright/test';

/**
 * Navigation library — higher-level nav helpers built on top of ui.helper.ts.
 * Adds verification of page titles, sidebar state, and breadcrumb assertions.
 */

/**
 * Navigate to a page by path and verify the page title/breadcrumb shows the expected label.
 * Checks both page-header and page-layout title selectors.
 */
export async function navigateAndVerify(
  page: Page,
  path: string,
  expectedBreadcrumb: string,
): Promise<void> {
  await page.goto(path, { waitUntil: 'networkidle' });

  const titleLocator = page.locator(
    '.page-header__title, .page-layout__title',
  );
  await expect(titleLocator.first()).toContainText(expectedBreadcrumb, {
    timeout: 10_000,
  });
}

/**
 * Verify that the sidebar highlights the correct nav item as active.
 * Matches by the visible label text of the nav item.
 */
export async function verifySidebarActive(
  page: Page,
  label: string,
): Promise<void> {
  const activeItem = page.locator('.nav-item--active', { hasText: label });
  await expect(activeItem.first()).toBeVisible({ timeout: 5_000 });
}

/**
 * Navigate via sidebar click and wait for the page to finish loading.
 * Finds the nav item by its label text, clicks it, and waits for network idle.
 */
export async function navigateViaSidebar(
  page: Page,
  label: string,
): Promise<void> {
  const navItem = page.locator('app-sidebar .nav-item', { hasText: label });
  await navItem.first().click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);
}
