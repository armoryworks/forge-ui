import { Page, expect } from '@playwright/test';

/**
 * Entity link library — helpers for clicking and verifying app-entity-link
 * navigation. Entity links render as <a class="entity-link"> and navigate
 * to the entity's page or open a detail dialog via DetailDialogService.
 */

const ENTITY_LINK_SELECTOR = 'a.entity-link';
const DIALOG_SELECTOR = '.cdk-overlay-container .mat-mdc-dialog-container';

/**
 * Click an entity link by its visible text and verify navigation to the expected path.
 * Waits for the URL to contain the expectedPath substring.
 */
export async function clickEntityLinkAndVerify(
  page: Page,
  linkText: string,
  expectedPath: string,
): Promise<void> {
  const link = page.locator(ENTITY_LINK_SELECTOR, { hasText: linkText }).first();
  await expect(link).toBeVisible({ timeout: 5_000 });
  await link.click();
  await page.waitForTimeout(500);

  // Wait for URL to match or dialog to open
  try {
    await page.waitForURL(`**${expectedPath}**`, { timeout: 5_000 });
  } catch {
    // Entity link may have opened a detail dialog instead of navigating
    const dialog = page.locator(DIALOG_SELECTOR).first();
    if (await dialog.isVisible().catch(() => false)) {
      // Dialog opened — that's valid entity link behavior
      return;
    }
    // Re-check URL with more relaxed matching
    expect(page.url()).toContain(expectedPath);
  }
}

/**
 * Verify that a detail dialog opened after clicking an entity link.
 * Checks for the presence of a MatDialog overlay.
 */
export async function verifyDetailOpened(page: Page): Promise<void> {
  const dialog = page.locator(DIALOG_SELECTOR);
  await expect(dialog.first()).toBeVisible({ timeout: 5_000 });
}

/**
 * Click an entity link, verify navigation to the expected path, then navigate back.
 * Useful for verifying entity links work without staying on the target page.
 */
export async function followAndReturn(
  page: Page,
  linkText: string,
  expectedPath: string,
): Promise<void> {
  const originalUrl = page.url();

  const link = page.locator(ENTITY_LINK_SELECTOR, { hasText: linkText }).first();
  await expect(link).toBeVisible({ timeout: 5_000 });
  await link.click();
  await page.waitForTimeout(500);

  // Check if we navigated or a dialog opened
  const dialog = page.locator(DIALOG_SELECTOR).first();
  const dialogOpened = await dialog.isVisible().catch(() => false);

  if (dialogOpened) {
    // Close dialog and return
    const closeBtn = page.locator('app-dialog .dialog__close, button[aria-label="Close"]').first();
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(300);
  } else {
    // Verify URL and navigate back
    try {
      await page.waitForURL(`**${expectedPath}**`, { timeout: 5_000 });
    } catch {
      expect(page.url()).toContain(expectedPath);
    }
    await page.goBack({ waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
  }
}
