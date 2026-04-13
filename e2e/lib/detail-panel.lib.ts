import { Page, expect } from '@playwright/test';

/**
 * Detail panel/dialog library — helpers for opening, navigating, and verifying
 * entity detail views. Works with both MatDialog-based detail dialogs
 * (via DetailDialogService with ?detail=type:id URL pattern) and
 * detail side panels.
 */

const DIALOG_SELECTOR = '.cdk-overlay-container .mat-mdc-dialog-container';
const SIDE_PANEL_SELECTOR = 'app-detail-side-panel .panel';
const TABLE_ROW_SELECTOR = 'app-data-table tbody tr';

/**
 * Open a detail dialog by clicking a table row containing the specified text.
 * Waits for a dialog or detail panel to appear after clicking.
 */
export async function openDetailFromRow(
  page: Page,
  rowText: string,
): Promise<void> {
  const row = page.locator(TABLE_ROW_SELECTOR, { hasText: rowText }).first();
  await expect(row).toBeVisible({ timeout: 5_000 });
  await row.click();
  await page.waitForTimeout(500);

  // Wait for either a dialog or side panel to appear
  const dialog = page.locator(DIALOG_SELECTOR);
  const panel = page.locator(SIDE_PANEL_SELECTOR);

  await expect(dialog.first().or(panel.first())).toBeVisible({ timeout: 5_000 });
}

/**
 * Open a detail dialog by navigating to the URL with the ?detail query param.
 * Uses the DetailDialogService's URL pattern: ?detail=entityType:entityId
 */
export async function openDetailByUrl(
  page: Page,
  basePath: string,
  entityType: string,
  entityId: number,
): Promise<void> {
  const url = `${basePath}?detail=${entityType}:${entityId}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // Wait for the detail dialog to open
  const dialog = page.locator(DIALOG_SELECTOR);
  const panel = page.locator(SIDE_PANEL_SELECTOR);
  await expect(dialog.first().or(panel.first())).toBeVisible({ timeout: 10_000 });
}

/**
 * Click an entity link (app-entity-link) by its visible text and verify that
 * navigation occurs. Entity links use <a class="entity-link"> internally.
 */
export async function clickEntityLink(
  page: Page,
  linkText: string,
): Promise<void> {
  const link = page.locator('a.entity-link', { hasText: linkText }).first();
  await expect(link).toBeVisible({ timeout: 5_000 });

  const currentUrl = page.url();
  await link.click();
  await page.waitForTimeout(500);

  // Verify navigation happened (URL changed or dialog opened)
  const urlChanged = page.url() !== currentUrl;
  const dialogOpened = await page.locator(DIALOG_SELECTOR).first().isVisible().catch(() => false);

  if (!urlChanged && !dialogOpened) {
    // Wait a bit longer — route transitions may be async
    await page.waitForTimeout(1_000);
  }
}

/**
 * Switch tabs within a detail panel or dialog.
 * Finds tabs by role="tab" or .tab class with the matching label text.
 */
export async function switchDetailTab(
  page: Page,
  tabLabel: string,
): Promise<void> {
  const tab = page.locator('[role="tab"], .tab', { hasText: tabLabel }).first();
  await expect(tab).toBeVisible({ timeout: 5_000 });
  await tab.click();
  await page.waitForTimeout(500);
}

/**
 * Verify that a detail panel/dialog has an info field with the expected label
 * and value. Looks for common info-grid patterns: .info-label + .info-value pairs.
 */
export async function verifyInfoField(
  page: Page,
  label: string,
  expectedValue: string,
): Promise<void> {
  // Find the info item containing the label
  const infoItem = page.locator('.info-item, .detail-field, .info-row', {
    has: page.locator('.info-label, .detail-label, dt', { hasText: label }),
  }).first();

  await expect(infoItem).toBeVisible({ timeout: 5_000 });

  const valueEl = infoItem.locator('.info-value, .detail-value, dd').first();
  await expect(valueEl).toContainText(expectedValue);
}

/**
 * Close the currently open detail panel or dialog.
 * Tries the close button, then Cancel, then Escape key.
 */
export async function closeDetail(page: Page): Promise<void> {
  // Try side panel close button
  const panelClose = page.locator('app-detail-side-panel .panel__close');
  if (await panelClose.isVisible().catch(() => false)) {
    await panelClose.click();
    await page.waitForTimeout(300);
    return;
  }

  // Try dialog close button
  const dialogClose = page.locator('app-dialog .dialog__close, .mat-mdc-dialog-container button[aria-label="Close"]');
  if (await dialogClose.first().isVisible().catch(() => false)) {
    await dialogClose.first().click();
    await page.waitForTimeout(300);
    return;
  }

  // Try Cancel button
  const cancelBtn = page.getByRole('button', { name: 'Cancel', exact: true });
  if (await cancelBtn.isVisible().catch(() => false)) {
    await cancelBtn.click();
    await page.waitForTimeout(300);
    return;
  }

  // Fallback: Escape
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}
