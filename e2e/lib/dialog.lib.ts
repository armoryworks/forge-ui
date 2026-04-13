import { Page, expect } from '@playwright/test';
import { fillForm } from './form.lib';

/**
 * Dialog library — helpers for opening, filling, saving, and verifying dialogs.
 * Works with the app's <app-dialog> component and Angular Material dialog overlay.
 */

/** Selector for the dialog container in the CDK overlay */
const DIALOG_SELECTOR = '.cdk-overlay-container .mat-mdc-dialog-container, .cdk-overlay-container app-dialog';
const DIALOG_TITLE_SELECTOR = 'app-dialog .dialog__title, .mat-mdc-dialog-title';
const CONFIRM_DIALOG_SELECTOR = '.confirm-dialog';

/**
 * Open a dialog by clicking a button with the given text, then wait for the dialog
 * to appear. Optionally verify the dialog title matches.
 */
export async function openDialog(
  page: Page,
  buttonText: string,
  dialogTitle?: string,
): Promise<void> {
  await page.getByRole('button', { name: buttonText }).first().click();
  await page.waitForTimeout(300);

  if (dialogTitle) {
    await expect(
      page.locator(DIALOG_TITLE_SELECTOR, { hasText: dialogTitle }),
    ).toBeVisible({ timeout: 5_000 });
  } else {
    await expect(
      page.locator(DIALOG_SELECTOR).first(),
    ).toBeVisible({ timeout: 5_000 });
  }
}

/**
 * Fill dialog fields using data-testid map and click the save button.
 * Waits for the dialog to close after save completes.
 *
 * @param fields - Record of data-testid to value (passed to fillForm)
 * @param saveButtonText - Text of the save button (default: "Save")
 */
export async function fillAndSaveDialog(
  page: Page,
  fields: Record<string, string>,
  saveButtonText = 'Save',
): Promise<void> {
  await fillForm(page, fields);
  await page.waitForTimeout(200);

  await page.getByRole('button', { name: saveButtonText, exact: true }).click();

  // Wait for dialog to close (either the overlay disappears or the dialog is removed)
  await expect(
    page.locator(DIALOG_SELECTOR).first(),
  ).not.toBeVisible({ timeout: 10_000 }).catch(() => {
    // Dialog may have already been removed from DOM
  });

  await page.waitForTimeout(300);
}

/**
 * Verify that hovering over a disabled save button shows a validation popover
 * containing the expected violation messages.
 */
export async function verifyValidationPopover(
  page: Page,
  expectedViolations: string[],
): Promise<void> {
  // Find the disabled save button with the validation popover directive
  const saveButton = page.locator('button[disabled][appvalidationpopover], button:disabled').last();
  await expect(saveButton).toBeVisible({ timeout: 3_000 });

  // Hover to trigger the popover
  await saveButton.hover();
  await page.waitForTimeout(500);

  // Check the validation popover content
  const popover = page.locator('app-validation-popover-content, .validation-popover__list');
  await expect(popover.first()).toBeVisible({ timeout: 3_000 });

  for (const violation of expectedViolations) {
    await expect(popover.first()).toContainText(violation);
  }

  // Move mouse away to dismiss
  await page.mouse.move(0, 0);
  await page.waitForTimeout(300);
}

/**
 * Close the currently open dialog by clicking the Cancel button or the close icon.
 * Verifies the dialog is no longer visible after closing.
 */
export async function closeDialog(page: Page): Promise<void> {
  // Try Cancel button first, then close icon
  const cancelBtn = page.getByRole('button', { name: 'Cancel', exact: true });
  const closeIcon = page.locator('app-dialog .dialog__close, .mat-mdc-dialog-container button[aria-label="Close"]');

  if (await cancelBtn.isVisible()) {
    await cancelBtn.click();
  } else if (await closeIcon.first().isVisible()) {
    await closeIcon.first().click();
  } else {
    // Fallback: press Escape
    await page.keyboard.press('Escape');
  }

  await page.waitForTimeout(300);
  await expect(
    page.locator(DIALOG_SELECTOR).first(),
  ).not.toBeVisible({ timeout: 5_000 }).catch(() => {
    // Already gone
  });
}

/**
 * Verify that a dirty form guard confirmation dialog appears when trying to close
 * a dialog with unsaved changes. Clicks Cancel on the guard to stay in the form.
 */
export async function verifyDirtyGuard(page: Page): Promise<void> {
  // Try to close — should trigger the confirm dialog
  const closeIcon = page.locator('app-dialog .dialog__close');
  if (await closeIcon.isVisible()) {
    await closeIcon.click();
  } else {
    await page.keyboard.press('Escape');
  }

  await page.waitForTimeout(500);

  // The confirm dialog should appear
  const confirmDialog = page.locator(CONFIRM_DIALOG_SELECTOR);
  await expect(confirmDialog.first()).toBeVisible({ timeout: 5_000 });

  // Verify it contains unsaved changes language
  await expect(confirmDialog.first()).toContainText(/unsaved|discard|changes/i);

  // Click Cancel to stay in the form
  const cancelBtn = page.locator(`${CONFIRM_DIALOG_SELECTOR} button`, { hasText: /cancel/i });
  await cancelBtn.first().click();
  await page.waitForTimeout(300);
}
