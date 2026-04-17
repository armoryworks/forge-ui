/**
 * Critical User Flows — Smoke Tests
 *
 * Covers the 5 most critical user journeys that would break a real user's
 * day if they failed. Each test is independent (own login). These tests
 * verify the golden path works, not exhaustive coverage.
 */
import { test, expect } from '@playwright/test';
import { loginViaApi, SEED_PASSWORD } from '../../helpers/auth.helper';

const ADMIN_EMAIL = 'admin@qbengineer.local';
const API_BASE = 'http://localhost:5000/api/v1/';

test.describe('Critical User Flows', () => {

  // ─── Flow 1: Login → Dashboard loads ────────────────────────────────────────

  test('login and dashboard loads successfully', async ({ page }) => {
    await loginViaApi(page, ADMIN_EMAIL, SEED_PASSWORD);

    // Navigate to dashboard and wait for API response
    const dashboardResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/v1/dashboard') && resp.status() === 200,
      { timeout: 15_000 },
    );
    await page.goto('/dashboard');
    await dashboardResponse;

    // Assert dashboard content rendered (KPI chips or page title)
    await expect(
      page.locator('app-kpi-chip, app-dashboard-widget, .dashboard').first(),
    ).toBeVisible({ timeout: 10_000 });

    // Assert no error toasts visible
    await expect(page.locator('.toast--error')).toHaveCount(0);
  });

  // ─── Flow 2: Kanban board loads and displays ────────────────────────────────

  test('kanban board loads with columns', async ({ page }) => {
    await loginViaApi(page, ADMIN_EMAIL, SEED_PASSWORD);

    // Navigate to kanban and wait for board data
    const boardResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/v1/') && resp.url().includes('job') && resp.status() === 200,
      { timeout: 15_000 },
    );
    await page.goto('/kanban');
    await boardResponse;

    // Assert board columns are rendered
    await expect(
      page.locator('app-kanban-column-header, .kanban-column, .board-column').first(),
    ).toBeVisible({ timeout: 10_000 });

    // Assert at least one track type selector/tab exists
    await expect(
      page.locator('mat-tab-group, .track-type-tab, [class*="track"]').first(),
    ).toBeVisible({ timeout: 5_000 });

    // No error toasts
    await expect(page.locator('.toast--error')).toHaveCount(0);
  });

  // ─── Flow 3: Create a job via backlog ───────────────────────────────────────

  test('create a job from backlog', async ({ page }) => {
    await loginViaApi(page, ADMIN_EMAIL, SEED_PASSWORD);

    // Navigate to backlog and wait for jobs to load
    const backlogResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/v1/jobs') && resp.status() === 200,
      { timeout: 15_000 },
    );
    await page.goto('/backlog');
    await backlogResponse;

    // Click "New Job" / "Create Job" button
    const newJobBtn = page.locator('.new-job-btn, button:has-text("New Job"), button:has-text("Create Job")').first();
    await expect(newJobBtn).toBeVisible({ timeout: 5_000 });
    await newJobBtn.click();

    // Wait for the dialog to open and reference data to load
    await expect(page.locator('app-dialog, app-job-dialog')).toBeVisible({ timeout: 5_000 });

    // Wait for dialog loading to finish (reference data fetch)
    await expect(page.locator('.dialog-loading')).toHaveCount(0, { timeout: 10_000 });

    // Fill the job title (minimum required field)
    const uniqueTitle = `Smoke Test Job ${Date.now()}`;
    const titleInput = page.locator('[data-testid="job-title"] input');
    await titleInput.fill(uniqueTitle);

    // Select a track type if visible (required for create mode)
    const trackTypeSelect = page.locator('[data-testid="job-track-type"] mat-select');
    if (await trackTypeSelect.isVisible()) {
      await trackTypeSelect.click();
      // Pick the first available option
      await page.locator('mat-option').first().click();
    }

    // Click Save
    const saveBtn = page.locator('[data-testid="job-save-btn"]');
    await expect(saveBtn).toBeEnabled({ timeout: 5_000 });
    await saveBtn.click();

    // Wait for the create API call to succeed
    const createResponse = await page.waitForResponse(
      (resp) => resp.url().includes('/api/v1/jobs') && resp.request().method() === 'POST',
      { timeout: 10_000 },
    );
    expect(createResponse.status()).toBeLessThan(400);

    // Assert success feedback (snackbar or dialog closes)
    await expect(page.locator('app-job-dialog')).toHaveCount(0, { timeout: 5_000 });

    // Assert the new job appears in the backlog list
    await expect(page.getByText(uniqueTitle)).toBeVisible({ timeout: 10_000 });
  });

  // ─── Flow 4: Parts catalog browse and search ───────────────────────────────

  test('parts catalog loads and search works', async ({ page }) => {
    await loginViaApi(page, ADMIN_EMAIL, SEED_PASSWORD);

    // Navigate to parts and wait for data
    const partsResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/v1/parts') && resp.status() === 200,
      { timeout: 15_000 },
    );
    await page.goto('/parts');
    await partsResponse;

    // Assert the parts page loaded (table or empty state)
    await expect(
      page.locator('app-data-table, app-empty-state, .parts').first(),
    ).toBeVisible({ timeout: 10_000 });

    // No error toasts
    await expect(page.locator('.toast--error')).toHaveCount(0);

    // Type a search term into the search input
    const searchInput = page.getByLabel('Search', { exact: false }).first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      // Give the table time to filter (debounce)
      await page.waitForTimeout(500);
    }

    // The page should still be stable (no errors after search)
    await expect(page.locator('.toast--error')).toHaveCount(0);
  });

  // ─── Flow 5: Time tracking - view entries ──────────────────────────────────

  test('time tracking page loads without errors', async ({ page }) => {
    await loginViaApi(page, ADMIN_EMAIL, SEED_PASSWORD);

    // Navigate to time tracking and wait for API response
    const timeResponse = page.waitForResponse(
      (resp) =>
        (resp.url().includes('/api/v1/time') || resp.url().includes('/api/v1/clock')) &&
        resp.status() === 200,
      { timeout: 15_000 },
    );
    await page.goto('/time-tracking');
    await timeResponse;

    // Assert the page rendered (table, entries, or empty state)
    await expect(
      page.locator('app-data-table, app-empty-state, .time-tracking').first(),
    ).toBeVisible({ timeout: 10_000 });

    // Assert no server errors
    await expect(page.locator('.toast--error')).toHaveCount(0);

    // Assert no full-page error state
    await expect(page.locator('text=500')).toHaveCount(0);
    await expect(page.locator('text=Internal Server Error')).toHaveCount(0);
  });
});
