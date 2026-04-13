import { Page, expect } from '@playwright/test';

/**
 * Form library — higher-level form helpers that work with data-testid attributes.
 * Handles Angular Material form fields (mat-form-field, mat-select, mat-datepicker,
 * mat-slide-toggle) located by their data-testid wrapper.
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
  await input.click();
  await input.fill(value);
  await page.waitForTimeout(100);
}

/**
 * Select an option in a mat-select by its data-testid attribute.
 * Clicks the select to open the overlay, then clicks the matching option text.
 */
export async function selectByTestId(
  page: Page,
  testId: string,
  optionText: string,
): Promise<void> {
  const wrapper = page.locator(`[data-testid="${testId}"]`);
  const select = wrapper.locator('mat-select').first();
  await select.click();
  await page.waitForTimeout(200);

  const option = page.locator('.cdk-overlay-container mat-option', {
    hasText: optionText,
  });
  await option.first().click();
  await page.waitForTimeout(200);
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
  await input.click();
  await input.fill(dateStr);
  await page.keyboard.press('Escape');
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
  await toggle.click();
  await page.waitForTimeout(100);
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
    await expect(wrapper).toBeAttached({ timeout: 5_000 });

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
      await textarea.click();
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
