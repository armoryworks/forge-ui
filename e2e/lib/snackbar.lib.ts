import { Page, expect } from '@playwright/test';

/**
 * Snackbar and toast library — helpers for asserting feedback messages.
 * Snackbars appear at bottom-center (mat-snack-bar-container).
 * Toasts appear at upper-right (app-toast).
 */

const SNACKBAR_SELECTOR = 'mat-snack-bar-container, .mat-mdc-snack-bar-container, .snackbar';
const TOAST_SELECTOR = 'app-toast .toast, .toast';

/**
 * Wait for a success snackbar containing the specified text.
 * Success snackbars typically have the .snackbar--success class.
 */
export async function expectSuccess(
  page: Page,
  text: string,
  timeout = 5_000,
): Promise<void> {
  const snackbar = page.locator(SNACKBAR_SELECTOR, { hasText: text });
  await expect(snackbar.first()).toBeVisible({ timeout });
}

/**
 * Wait for an error snackbar or toast to appear.
 * If text is provided, verifies the message contains that text.
 * Checks both snackbar (bottom-center) and toast (upper-right) locations.
 */
export async function expectError(
  page: Page,
  text?: string,
  timeout = 5_000,
): Promise<void> {
  if (text) {
    // Check snackbar first, then toast
    const snackbar = page.locator(SNACKBAR_SELECTOR, { hasText: text });
    const toast = page.locator(TOAST_SELECTOR, { hasText: text });

    await expect(snackbar.first().or(toast.first())).toBeVisible({ timeout });
  } else {
    // Look for error-styled snackbar or toast
    const errorSnackbar = page.locator('.snackbar--error, .mat-mdc-snack-bar-container');
    const errorToast = page.locator('.toast--error, app-toast .toast');

    await expect(errorSnackbar.first().or(errorToast.first())).toBeVisible({ timeout });
  }
}

/**
 * Wait for any snackbar to appear and return its text content.
 * Useful for asserting on dynamic messages where exact text is unknown.
 */
export async function waitForAnySnackbar(
  page: Page,
  timeout = 5_000,
): Promise<string> {
  const snackbar = page.locator(SNACKBAR_SELECTOR).first();
  await expect(snackbar).toBeVisible({ timeout });

  const text = await snackbar.textContent();
  return (text ?? '').trim();
}

/**
 * Dismiss the currently visible snackbar by clicking its action button.
 * If no action button is found, waits briefly for auto-dismiss.
 */
export async function dismissSnackbar(page: Page): Promise<void> {
  const snackbar = page.locator(SNACKBAR_SELECTOR).first();

  if (await snackbar.isVisible().catch(() => false)) {
    const actionBtn = snackbar.locator('button, .mat-mdc-snack-bar-action').first();
    if (await actionBtn.isVisible().catch(() => false)) {
      await actionBtn.click();
    }
  }

  await page.waitForTimeout(300);
}
