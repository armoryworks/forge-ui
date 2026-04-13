import { Page, expect } from '@playwright/test';

/**
 * DataTable library — helpers for interacting with <app-data-table>.
 * Handles sorting, filtering, pagination, column management, and row selection.
 */

const TABLE_SELECTOR = 'app-data-table';
const ROW_SELECTOR = `${TABLE_SELECTOR} tbody tr`;
const HEADER_SELECTOR = `${TABLE_SELECTOR} thead th`;

/**
 * Wait for the data table to load with at least minRows visible rows.
 * Defaults to 1 row minimum with a 10-second timeout.
 */
export async function waitForTable(
  page: Page,
  minRows = 1,
  timeout = 10_000,
): Promise<void> {
  if (minRows === 0) {
    // Just wait for the table element to exist
    await expect(page.locator(TABLE_SELECTOR).first()).toBeAttached({ timeout });
    return;
  }

  // Wait for at least minRows to appear
  await expect(
    page.locator(ROW_SELECTOR).nth(minRows - 1),
  ).toBeVisible({ timeout });
}

/**
 * Click a column header to sort by that column.
 * Clicking once sorts ascending, clicking again sorts descending,
 * and a third click clears the sort.
 */
export async function sortByColumn(
  page: Page,
  headerText: string,
): Promise<void> {
  const header = page.locator(HEADER_SELECTOR, { hasText: headerText }).first();
  await header.click();
  await page.waitForTimeout(300);
}

/**
 * Get the number of visible rows in the data table.
 * Excludes expanded row detail rows.
 */
export async function getRowCount(page: Page): Promise<number> {
  return page.locator(ROW_SELECTOR).count();
}

/**
 * Click a table row that contains the specified text.
 * Matches the first row containing the text.
 */
export async function clickRow(
  page: Page,
  text: string,
): Promise<void> {
  const row = page.locator(ROW_SELECTOR, { hasText: text }).first();
  await expect(row).toBeVisible({ timeout: 5_000 });
  await row.click();
  await page.waitForTimeout(200);
}

/**
 * Open the column filter popover for a specific column header, fill in a text
 * filter value, and apply it.
 *
 * Finds the filter icon button within the header cell and clicks it to open
 * the filter popover overlay.
 */
export async function filterColumn(
  page: Page,
  headerText: string,
  filterValue: string,
): Promise<void> {
  const header = page.locator(HEADER_SELECTOR, { hasText: headerText }).first();

  // Hover over the header to reveal the filter icon
  await header.hover();
  await page.waitForTimeout(200);

  // Click the filter icon within the header
  const filterBtn = header.locator('button, .data-table__filter-btn').first();
  await filterBtn.click();
  await page.waitForTimeout(300);

  // Fill the filter input in the popover
  const popover = page.locator('.filter-popover');
  await expect(popover.first()).toBeVisible({ timeout: 3_000 });

  const filterInput = popover.locator('input').first();
  await filterInput.fill(filterValue);
  await page.waitForTimeout(100);

  // Click Apply
  const applyBtn = popover.locator('button', { hasText: /apply/i }).first();
  await applyBtn.click();
  await page.waitForTimeout(300);
}

/**
 * Change the page size in the mat-paginator.
 * Opens the page size select and picks the requested size.
 */
export async function changePageSize(
  page: Page,
  size: number,
): Promise<void> {
  const paginator = page.locator('mat-paginator');
  await expect(paginator.first()).toBeVisible({ timeout: 5_000 });

  // Click the page size select
  const pageSizeSelect = paginator.locator('mat-select').first();
  await pageSizeSelect.click();
  await page.waitForTimeout(200);

  // Select the desired size
  const option = page.locator('.cdk-overlay-container mat-option', {
    hasText: String(size),
  });
  await option.first().click();
  await page.waitForTimeout(300);
}

/**
 * Navigate to a specific page using the paginator controls.
 * Uses next/previous buttons or first/last buttons depending on distance.
 */
export async function goToPage(
  page: Page,
  pageNumber: number,
): Promise<void> {
  const paginator = page.locator('mat-paginator');
  await expect(paginator.first()).toBeVisible({ timeout: 5_000 });

  if (pageNumber === 1) {
    // Click first page button
    const firstBtn = paginator.locator('button[aria-label="First page"]').first();
    if (await firstBtn.isEnabled()) {
      await firstBtn.click();
      await page.waitForTimeout(300);
    }
    return;
  }

  // Navigate using next page button repeatedly
  // First go to page 1
  const firstBtn = paginator.locator('button[aria-label="First page"]').first();
  if (await firstBtn.isVisible() && await firstBtn.isEnabled()) {
    await firstBtn.click();
    await page.waitForTimeout(200);
  }

  // Then click next (pageNumber - 1) times
  const nextBtn = paginator.locator('button[aria-label="Next page"]').first();
  for (let i = 1; i < pageNumber; i++) {
    if (await nextBtn.isEnabled()) {
      await nextBtn.click();
      await page.waitForTimeout(200);
    }
  }
  await page.waitForTimeout(200);
}

/**
 * Open the column manager panel (gear icon) and toggle a column's visibility.
 * Clicks the checkbox next to the column name in the manager overlay.
 */
export async function toggleColumnVisibility(
  page: Page,
  columnName: string,
): Promise<void> {
  // Click the gear/settings button to open column manager
  const gearBtn = page.locator('.data-table__gear-btn, button[aria-label="Column settings"]').first();
  await gearBtn.click();
  await page.waitForTimeout(300);

  // Find the column manager panel
  const manager = page.locator('.col-manager, app-column-manager-panel');
  await expect(manager.first()).toBeVisible({ timeout: 3_000 });

  // Find and click the checkbox for the column
  const columnItem = manager.locator('.col-manager__item', { hasText: columnName }).first();
  const checkbox = columnItem.locator('mat-checkbox');
  await checkbox.click();
  await page.waitForTimeout(200);

  // Close the column manager by clicking the backdrop
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

/**
 * Verify that a table row containing rowText also contains columnText.
 * Useful for asserting that a specific cell value appears in the expected row.
 */
export async function verifyRowContent(
  page: Page,
  rowText: string,
  columnText: string,
): Promise<void> {
  const row = page.locator(ROW_SELECTOR, { hasText: rowText }).first();
  await expect(row).toBeVisible({ timeout: 5_000 });
  await expect(row).toContainText(columnText);
}
