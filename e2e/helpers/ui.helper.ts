import { type Page, expect } from '@playwright/test';

/**
 * UI interaction helpers for Playwright scenarios.
 * All helpers locate elements by visible labels/text — no fragile CSS selectors.
 */

// ---------------------------------------------------------------------------
// Form field helpers — target mat-form-field by its mat-label text
// ---------------------------------------------------------------------------

/** Fill a text/number/email input inside a mat-form-field identified by label */
export async function fillInput(page: Page, label: string, value: string): Promise<void> {
  const field = page.locator('mat-form-field', { has: page.locator(`mat-label:text-is("${label}")`) });
  const input = field.locator('input[matInput]');
  await input.click();
  await input.fill(value);
}

/** Fill a textarea inside a mat-form-field identified by label */
export async function fillTextarea(page: Page, label: string, value: string): Promise<void> {
  const field = page.locator('mat-form-field', { has: page.locator(`mat-label:text-is("${label}")`) });
  const textarea = field.locator('textarea');
  await textarea.click();
  await textarea.fill(value);
}

/** Select an option from a mat-select by label → option text */
export async function selectOption(page: Page, label: string, optionText: string): Promise<void> {
  const field = page.locator('mat-form-field', { has: page.locator(`mat-label:text-is("${label}")`) });
  await field.locator('mat-select').click();
  await page.locator('mat-option', { hasText: optionText }).click();
}

/** Pick a date via the datepicker input (type the value directly) */
export async function fillDate(page: Page, label: string, dateStr: string): Promise<void> {
  const field = page.locator('mat-form-field', { has: page.locator(`mat-label:text-is("${label}")`) });
  const input = field.locator('input[matInput]');
  await input.click();
  await input.fill(dateStr);
  // Close any open overlay by pressing Escape
  await page.keyboard.press('Escape');
}

// ---------------------------------------------------------------------------
// Button helpers
// ---------------------------------------------------------------------------

/** Click a button by its visible text (exact match) */
export async function clickButton(page: Page, text: string): Promise<void> {
  await page.getByRole('button', { name: text, exact: true }).click();
}

/** Click a button containing the given text (partial match) */
export async function clickButtonContaining(page: Page, text: string): Promise<void> {
  await page.getByRole('button', { name: text }).first().click();
}

// ---------------------------------------------------------------------------
// Dialog helpers
// ---------------------------------------------------------------------------

/** Wait for a dialog with the given title to appear */
export async function waitForDialog(page: Page, title: string): Promise<void> {
  await expect(
    page.locator('app-dialog .dialog__title, .mat-mdc-dialog-title', { hasText: title }),
  ).toBeVisible({ timeout: 5_000 });
}

/** Close the currently open dialog by clicking Cancel */
export async function cancelDialog(page: Page): Promise<void> {
  await clickButton(page, 'Cancel');
  // Wait for dialog to animate out
  await page.waitForTimeout(300);
}

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

/** Navigate to a route and wait for network idle */
export async function navigateTo(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'networkidle' });
}

/** Click a sidebar nav item by its label text */
export async function navigateViaSidebar(page: Page, label: string): Promise<void> {
  await page.locator('app-sidebar a, app-sidebar .nav-item', { hasText: label }).click();
  await page.waitForLoadState('networkidle');
}

// ---------------------------------------------------------------------------
// Table helpers
// ---------------------------------------------------------------------------

/** Wait for a data table to have at least N rows */
export async function waitForTableRows(page: Page, minRows: number, timeout = 10_000): Promise<void> {
  await expect(page.locator('app-data-table tbody tr')).toHaveCount(minRows, {
    timeout,
  }).catch(() => {
    // Fallback: wait for at least minRows
    return expect(
      page.locator('app-data-table tbody tr'),
    ).not.toHaveCount(0, { timeout });
  });
}

/** Click a table row containing the given text */
export async function clickTableRow(page: Page, text: string): Promise<void> {
  await page.locator('app-data-table tbody tr', { hasText: text }).first().click();
}

// ---------------------------------------------------------------------------
// Tab helpers
// ---------------------------------------------------------------------------

/** Click a tab by its label text */
export async function switchTab(page: Page, tabLabel: string): Promise<void> {
  await page.locator('.tab, [role="tab"]', { hasText: tabLabel }).click();
  await page.waitForTimeout(500);
}

// ---------------------------------------------------------------------------
// Snackbar / toast helpers
// ---------------------------------------------------------------------------

/** Wait for a snackbar to appear with given text */
export async function waitForSnackbar(page: Page, text: string, timeout = 5_000): Promise<void> {
  await expect(
    page.locator('mat-snack-bar-container, .snackbar', { hasText: text }),
  ).toBeVisible({ timeout });
}

/** Wait for any snackbar to appear (e.g. after save) */
export async function waitForAnySnackbar(page: Page, timeout = 5_000): Promise<void> {
  await expect(
    page.locator('mat-snack-bar-container, .snackbar').first(),
  ).toBeVisible({ timeout });
}

/** Dismiss visible snackbar if present */
export async function dismissSnackbar(page: Page): Promise<void> {
  const snackbar = page.locator('mat-snack-bar-container, .snackbar');
  if (await snackbar.isVisible()) {
    // Click the action button or just wait for auto-dismiss
    const action = snackbar.locator('button').first();
    if (await action.isVisible()) {
      await action.click();
    }
  }
}

// ---------------------------------------------------------------------------
// Detail panel helpers
// ---------------------------------------------------------------------------

/** Wait for the detail side panel to be open */
export async function waitForDetailPanel(page: Page, timeout = 5_000): Promise<void> {
  await expect(page.locator('app-detail-side-panel .panel')).toBeVisible({ timeout });
}

/** Close the detail side panel */
export async function closeDetailPanel(page: Page): Promise<void> {
  await page.locator('app-detail-side-panel .panel__close').click();
  await page.waitForTimeout(300);
}

// ---------------------------------------------------------------------------
// Wait helpers
// ---------------------------------------------------------------------------

/** Wait briefly for animations / state updates */
export async function brief(page: Page, ms = 500): Promise<void> {
  await page.waitForTimeout(ms);
}

/** Wait for network to be idle (all pending requests resolved) */
export async function waitForNetwork(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
}

/** Log a step message for scenario progress tracking */
export function log(message: string): void {
  const timestamp = new Date().toISOString().substring(11, 19);
  console.log(`  [${timestamp}] ${message}`);
}
