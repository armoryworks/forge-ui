import { Page } from '@playwright/test';
import { fillForm, clickByTestId } from './form.lib';

/**
 * Dialog library — helpers for opening, filling, saving, and verifying dialogs.
 * Works with the app's <app-dialog> component which renders INLINE (not in CDK overlay).
 *
 * Key insight: <app-dialog> is NOT a MatDialog — it's a custom component that renders
 * inside the feature component tree. There's no .cdk-overlay-container for dialogs.
 * We locate dialogs via `app-dialog .dialog` or the dialog title.
 */

/** Selector for the inline dialog */
const DIALOG_SELECTOR = 'app-dialog .dialog';
const DIALOG_TITLE_SELECTOR = 'app-dialog .dialog__title';

/**
 * Open a dialog by clicking a button (by data-testid or text), then wait for it.
 */
export async function openDialog(
  page: Page,
  buttonTestIdOrText: string,
  dialogTitle?: string,
): Promise<void> {
  // Try data-testid first, fall back to button text
  const byTestId = page.locator(`[data-testid="${buttonTestIdOrText}"]`);
  if (await byTestId.isVisible({ timeout: 2000 }).catch(() => false)) {
    await byTestId.click();
  } else {
    await page.getByRole('button', { name: buttonTestIdOrText }).first().click();
  }
  await page.waitForTimeout(500);

  if (dialogTitle) {
    await page
      .locator(DIALOG_TITLE_SELECTOR, { hasText: dialogTitle })
      .first()
      .waitFor({ state: 'visible', timeout: 5000 })
      .catch(() => {});
  } else {
    await page
      .locator(DIALOG_SELECTOR)
      .first()
      .waitFor({ state: 'visible', timeout: 5000 })
      .catch(() => {});
  }
}

/**
 * Fill dialog fields using data-testid map and click the save button.
 * Waits for the dialog to close after save completes.
 *
 * @param fields - Record of data-testid to value (passed to fillForm)
 * @param saveTestId - data-testid of the save button (e.g., "job-save-btn")
 */
export async function fillAndSaveDialog(
  page: Page,
  fields: Record<string, string | number | boolean>,
  saveTestId: string,
): Promise<void> {
  await fillForm(page, fields);
  await page.waitForTimeout(200);

  // Use force click to bypass any lingering CDK overlay backdrops from mat-selects
  await clickByTestId(page, saveTestId);

  // Wait for dialog to close
  await page.waitForTimeout(2000);
}

/**
 * Close the currently open dialog by clicking Cancel, close icon, or pressing Escape.
 */
export async function closeDialog(page: Page): Promise<void> {
  // Try close icon (has aria-label="Close dialog")
  const closeIcon = page.locator('button[aria-label="Close dialog"]').first();
  if (await closeIcon.isVisible({ timeout: 1000 }).catch(() => false)) {
    await closeIcon.click({ force: true });
  } else {
    // Fallback: press Escape
    await page.keyboard.press('Escape');
  }
  await page.waitForTimeout(300);
}

/**
 * Wait for a snackbar to appear and return its text, or null if none appears.
 */
export async function waitForSnackbar(
  page: Page,
  timeout = 3000,
): Promise<string | null> {
  const snack = page.locator('.mat-mdc-snack-bar-container, mat-snack-bar-container').first();
  const visible = await snack.isVisible({ timeout }).catch(() => false);
  if (!visible) return null;
  return snack.textContent().catch(() => null);
}

/**
 * Check if an error toast is showing.
 */
export async function hasErrorToast(page: Page): Promise<boolean> {
  return page.locator('.toast--error').isVisible({ timeout: 1000 }).catch(() => false);
}
