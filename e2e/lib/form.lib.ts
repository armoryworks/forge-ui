import { Page, expect } from '@playwright/test';

/**
 * Form library — higher-level form helpers that work with data-testid attributes.
 * Handles Angular Material form fields (mat-form-field, mat-select, mat-datepicker,
 * mat-slide-toggle) located by their data-testid wrapper.
 *
 * Key design decisions for stress test resilience:
 * - mat-select options render in a dynamically-created CDK overlay, NOT inside
 *   .cdk-overlay-container (which may not exist yet). We locate options globally
 *   via `page.locator('mat-option')`.
 * - After selecting an option, the CDK overlay backdrop can persist and block
 *   subsequent clicks. We dismiss it with Escape and a short wait.
 * - All clicks that might be blocked by overlays use { force: true } as fallback.
 */

/**
 * Fill a text/number/email input by its data-testid attribute.
 * Locates the mat-form-field or app-input wrapper, then fills the inner input.
 */
export async function fillByTestId(
  page: Page,
  testId: string,
  value: string,
): Promise<void> {
  const wrapper = page.locator(`[data-testid="${testId}"]`);

  // Try textarea first (e.g., app-textarea), then input
  const textarea = wrapper.locator('textarea').first();
  if (await textarea.isVisible({ timeout: 1000 }).catch(() => false)) {
    await textarea.click({ timeout: 5000 });
    await textarea.fill(value);
    await page.waitForTimeout(100);
    return;
  }

  const input = wrapper.locator('input[matInput], input[matinput], input').first();
  await input.click({ timeout: 5000, force: true });
  await input.fill(value);
  await page.waitForTimeout(100);
}

/**
 * Select an option in a mat-select by its data-testid attribute.
 * Clicks the select to open the overlay, then clicks the matching option text.
 * Handles CDK overlay backdrop cleanup after selection.
 */
export async function selectByTestId(
  page: Page,
  testId: string,
  optionText: string,
): Promise<void> {
  // Click the wrapper (app-select) — this clicks through to the mat-select trigger
  await page.locator(`[data-testid="${testId}"]`).click({ timeout: 5000 });
  await page.waitForTimeout(400);

  // Options appear globally in the DOM (CDK overlay), find by text
  const option = page.locator('mat-option', { hasText: optionText }).first();
  const visible = await option.isVisible({ timeout: 3000 }).catch(() => false);
  if (visible) {
    await option.click();
    await page.waitForTimeout(300);
  } else {
    // Only close the dropdown if it's actually open (has mat-option visible)
    const anyOption = page.locator('mat-option').first();
    if (await anyOption.isVisible({ timeout: 500 }).catch(() => false)) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }
  }
}

/**
 * Select the Nth option (0-indexed) in a mat-select by its data-testid attribute.
 * Useful when you don't know the option text but want a specific position.
 */
export async function selectNthByTestId(
  page: Page,
  testId: string,
  index: number,
): Promise<void> {
  await page.locator(`[data-testid="${testId}"]`).click({ timeout: 5000 });
  await page.waitForTimeout(400);

  const option = page.locator('mat-option').nth(index);
  const visible = await option.isVisible({ timeout: 3000 }).catch(() => false);
  if (visible) {
    await option.click();
    await page.waitForTimeout(300);
  } else {
    // Only close dropdown if it's actually open
    const anyOption = page.locator('mat-option').first();
    if (await anyOption.isVisible({ timeout: 500 }).catch(() => false)) {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(200);
  }
}

/**
 * Fill a date field by its data-testid attribute.
 * Types the date string directly into the datepicker input and presses Escape
 * to close any calendar overlay.
 */
export async function fillDateByTestId(
  page: Page,
  testId: string,
  dateStr: string,
): Promise<void> {
  const wrapper = page.locator(`[data-testid="${testId}"]`);
  const input = wrapper.locator('input[matInput], input[matinput], input').first();
  await input.click({ timeout: 5000, force: true });
  await input.fill(dateStr);

  // Only press Escape if a calendar overlay is open — otherwise it closes the parent dialog
  const calendarOverlay = page.locator('mat-datepicker-content, .mat-datepicker-content');
  if (await calendarOverlay.isVisible({ timeout: 500 }).catch(() => false)) {
    await page.keyboard.press('Escape');
  }

  // Blur the input without clicking a potentially interactive element (sidebar, header)
  await input.evaluate((el) => (el as HTMLInputElement).blur());
  await page.waitForTimeout(100);
}

/**
 * Toggle a mat-slide-toggle by its data-testid attribute.
 * Clicks the toggle element to flip its state.
 */
export async function toggleByTestId(
  page: Page,
  testId: string,
): Promise<void> {
  const wrapper = page.locator(`[data-testid="${testId}"]`);
  const toggle = wrapper.locator('mat-slide-toggle, button[role="switch"]').first();
  await toggle.click({ timeout: 5000 });
  await page.waitForTimeout(100);
}

/**
 * Click a button by data-testid. Uses DOM click() to bypass any CDK overlay
 * backdrops that may persist after mat-select interactions.
 */
export async function clickByTestId(
  page: Page,
  testId: string,
): Promise<void> {
  await page.evaluate((tid) => {
    const el = document.querySelector(`[data-testid="${tid}"]`) as HTMLElement;
    if (el) el.click();
  }, testId);
}

/**
 * Fill a complete form from a key-value map of testId to value.
 * Automatically detects field type based on the element structure:
 * - mat-select -> selectByTestId
 * - mat-slide-toggle -> toggleByTestId
 * - mat-datepicker -> fillDateByTestId
 * - default -> fillByTestId
 *
 * Boolean values trigger toggleByTestId. String values fill text/select/date.
 * Number values are converted to strings and filled as text.
 */
export async function fillForm(
  page: Page,
  fields: Record<string, string | number | boolean>,
): Promise<void> {
  for (const [testId, value] of Object.entries(fields)) {
    const wrapper = page.locator(`[data-testid="${testId}"]`);
    const attached = await wrapper.isVisible({ timeout: 5000 }).catch(() => false);
    if (!attached) continue; // Skip fields not present on this form

    if (typeof value === 'boolean') {
      await toggleByTestId(page, testId);
      continue;
    }

    const strValue = String(value);

    // Detect field type by examining child elements
    const hasSelect = await wrapper.locator('mat-select').count();
    if (hasSelect > 0) {
      await selectByTestId(page, testId, strValue);
      continue;
    }

    const hasDatepicker = await wrapper.locator('mat-datepicker, mat-datepicker-toggle').count();
    if (hasDatepicker > 0) {
      await fillDateByTestId(page, testId, strValue);
      continue;
    }

    const hasTextarea = await wrapper.locator('textarea').count();
    if (hasTextarea > 0) {
      const textarea = wrapper.locator('textarea').first();
      await textarea.click({ timeout: 5000 });
      await textarea.fill(strValue);
      await page.waitForTimeout(100);
      continue;
    }

    await fillByTestId(page, testId, strValue);
  }
}

/**
 * Remove any lingering CDK overlay backdrops that can block clicks.
 * Call between steps or before opening a new dialog.
 */
export async function clearOverlayBackdrops(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Click backdrops to close any open dialogs/dropdowns
    document.querySelectorAll('.cdk-overlay-backdrop').forEach((el) => {
      (el as HTMLElement).click();
    });
    // Remove any lingering tooltip surfaces that block pointer events
    document.querySelectorAll('.mat-mdc-tooltip-surface, .mdc-tooltip__surface').forEach((el) => {
      el.closest('.cdk-overlay-pane')?.remove();
    });
  });
  await page.waitForTimeout(200);
}

/**
 * Dismiss any draft recovery prompt ("UNSAVED WORK FOUND") or other blocking
 * dialog that may appear after login or page navigation. Uses Playwright
 * locator with Escape key fallback.
 */
export async function dismissDraftRecoveryPrompt(page: Page): Promise<void> {
  // Try multiple strategies to dismiss blocking dialogs

  // Strategy 1: Click "Discard All" button via Playwright locator (case-insensitive)
  const discardBtn = page.getByRole('button', { name: /discard all/i }).first();
  if (await discardBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await discardBtn.click({ force: true });
    await page.waitForTimeout(500);
    return;
  }

  // Strategy 2: Click "Review Later" button
  const reviewBtn = page.getByRole('button', { name: /review later/i }).first();
  if (await reviewBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await reviewBtn.click({ force: true });
    await page.waitForTimeout(500);
    return;
  }

  // Strategy 3: Press Escape to dismiss any dialog
  const anyDialog = page.locator('.dialog-backdrop, .cdk-overlay-backdrop').first();
  if (await anyDialog.isVisible({ timeout: 500 }).catch(() => false)) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }
}

/**
 * Clear all drafts from IndexedDB to prevent the draft recovery prompt
 * from appearing. Call once after authentication, before workflow starts.
 */
export async function clearAllDrafts(page: Page): Promise<void> {
  await page.evaluate(async () => {
    try {
      const dbs = await indexedDB.databases();
      for (const db of dbs) {
        if (db.name?.includes('draft')) {
          indexedDB.deleteDatabase(db.name);
        }
      }
    } catch {
      // IndexedDB may not support databases() — fallback
      try { indexedDB.deleteDatabase('qb-engineer-drafts'); } catch {}
    }
  });
  await page.waitForTimeout(200);
}

/**
 * Fill an entity-picker (mat-autocomplete) by its data-testid attribute.
 * Types searchText into the input, waits for autocomplete options to appear,
 * then clicks the first (or Nth) option. If no options appear, clears and skips.
 */
export async function fillEntityPickerByTestId(
  page: Page,
  testId: string,
  searchText: string,
  optionIndex = 0,
): Promise<boolean> {
  const wrapper = page.locator(`[data-testid="${testId}"]`);
  const input = wrapper.locator('input').first();
  await input.click({ timeout: 5000, force: true });
  await input.fill('');
  await page.waitForTimeout(200);
  await input.pressSequentially(searchText, { delay: 50 });
  await page.waitForTimeout(800);

  // Wait for autocomplete options to appear
  const option = page.locator('mat-option').nth(optionIndex);
  const visible = await option.isVisible({ timeout: 3000 }).catch(() => false);
  if (visible) {
    await option.click();
    await page.waitForTimeout(300);
    return true;
  }

  // No options — clear and move on
  await input.fill('');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  return false;
}

/**
 * Click the Nth row in a data table. Returns true if a row was clicked.
 */
export async function clickTableRow(
  page: Page,
  index = 0,
  timeout = 5000,
): Promise<boolean> {
  const row = page.locator('app-data-table tbody tr').nth(index);
  if (await row.isVisible({ timeout }).catch(() => false)) {
    await row.click({ timeout });
    return true;
  }
  return false;
}

/**
 * Verify a form field has a specific value by its data-testid attribute.
 * Works with inputs, selects (reads displayed text), and textareas.
 */
export async function verifyFieldValue(
  page: Page,
  testId: string,
  expected: string,
): Promise<void> {
  const wrapper = page.locator(`[data-testid="${testId}"]`);

  // Check for mat-select first (reads the trigger text)
  const selectTrigger = wrapper.locator('.mat-mdc-select-value-text');
  if ((await selectTrigger.count()) > 0 && (await selectTrigger.isVisible())) {
    await expect(selectTrigger).toContainText(expected);
    return;
  }

  // Check for textarea
  const textarea = wrapper.locator('textarea');
  if ((await textarea.count()) > 0) {
    await expect(textarea).toHaveValue(expected);
    return;
  }

  // Default: input
  const input = wrapper.locator('input').first();
  await expect(input).toHaveValue(expected);
}
