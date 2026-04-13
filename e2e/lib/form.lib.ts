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
  const input = wrapper.locator('input[matInput], input[matinput], input').first();
  await input.click({ timeout: 5000 });
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
  await input.click({ timeout: 5000 });
  await input.fill(dateStr);

  // Only press Escape if a calendar overlay is open — otherwise it closes the parent dialog
  const calendarOverlay = page.locator('mat-datepicker-content, .mat-datepicker-content');
  if (await calendarOverlay.isVisible({ timeout: 500 }).catch(() => false)) {
    await page.keyboard.press('Escape');
  }

  // Click outside the input to blur it and dismiss any overlay
  await page.locator('body').click({ position: { x: 0, y: 0 }, force: true });
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
