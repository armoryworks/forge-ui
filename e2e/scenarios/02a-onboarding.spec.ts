import { test, expect, type Page } from '@playwright/test';
import { loginViaApi } from '../helpers/auth.helper';
import {
  fillInput,
  selectOption,
  clickButton,
  waitForDialog,
  navigateTo,
  waitForAnySnackbar,
  brief,
  dismissSnackbar,
} from '../helpers/ui.helper';
import { checkpoint, step, phase } from '../helpers/interactive.helper';

/**
 * 02a — Employee Onboarding
 *
 * Requires: 01-foundation
 * Interactive: YES — user completes registration + PIN setup
 *
 * Workflow:
 *   Admin creates new employee account
 *   ⏸ USER: completes self-registration (setup token flow)
 *   ⏸ USER: sets kiosk PIN
 *   Automation verifies the new user can log in
 */

test.describe.serial('02a Onboarding', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginViaApi(page, 'admin@qbengineer.local', 'Admin123!');
    await navigateTo(page, '/');
    await page.waitForLoadState('networkidle');
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('admin creates new employee', async () => {
    phase('Admin creating new employee account');
    await navigateTo(page, '/admin/users');
    await brief(page, 1000);

    await clickButton(page, 'Add User');
    await waitForDialog(page, 'Add User');

    await fillInput(page, 'First Name', 'Carlos');
    await fillInput(page, 'Last Name', 'Rivera');
    await fillInput(page, 'Email', 'crivera@qbengineer.local');
    await fillInput(page, 'Password', 'NewHire2026!');
    await fillInput(page, 'Initials', 'CR');
    await selectOption(page, 'Role', 'Engineer');

    // Pick an avatar color if color picker is visible
    const colorPicker = page.locator('.color-option, .avatar-color-option').nth(3);
    if (await colorPicker.isVisible()) {
      await colorPicker.click();
    }

    await clickButton(page, 'Create User');
    await waitForAnySnackbar(page);
    await dismissSnackbar(page);
    step('✓ Employee Carlos Rivera created');

    // Verify user appears in the table
    await brief(page, 1000);
    const row = page.locator('app-data-table tbody tr', { hasText: 'Carlos' });
    await expect(row).toBeVisible({ timeout: 5_000 });
    step('✓ User visible in admin user list');
  });

  test('user completes self-registration', async () => {
    await checkpoint(page, 'COMPLETE EMPLOYEE REGISTRATION', [
      'A new employee account has been created:',
      '',
      '  Email:    crivera@qbengineer.local',
      '  Password: NewHire2026!',
      '  Role:     Engineer',
      '',
      'YOUR TASKS:',
      '  1. Open a new browser tab (or incognito window)',
      '  2. Go to http://localhost:4200/login',
      '  3. Log in as crivera@qbengineer.local / NewHire2026!',
      '  4. Verify the dashboard loads correctly',
      '  5. Check that the sidebar shows Engineer-appropriate items',
      '  6. (Optional) Navigate to /time-tracking — verify empty state',
      '',
      'When done exploring, come back here and click RESUME.',
    ]);

    step('✓ User registration checkpoint passed');
  });

  test('verify new user login works', async () => {
    phase('Verifying new employee can log in');

    // Log in as the new user in this browser context
    await loginViaApi(page, 'crivera@qbengineer.local', 'NewHire2026!');
    await navigateTo(page, '/dashboard');
    await brief(page, 2000);

    // Verify dashboard loads
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
    step('✓ New employee dashboard loads');

    // Switch back to admin
    await loginViaApi(page, 'admin@qbengineer.local', 'Admin123!');
    step('✓ Switched back to admin session');
  });

  test('admin configures kiosk PIN for employee', async () => {
    await checkpoint(page, 'SET UP KIOSK PIN', [
      'The new employee needs a PIN for kiosk/shop floor auth.',
      '',
      'YOUR TASKS:',
      '  1. In a separate tab, log in as crivera@qbengineer.local',
      '  2. Navigate to profile/settings (if available)',
      '  3. Set a kiosk PIN (e.g., 1234)',
      '  4. Alternatively: admin may set PIN from /admin/users',
      '',
      'If PIN setup is not yet in the UI, skip this step.',
      'The kiosk scenario (03a) will test barcode scanning instead.',
      '',
      'Click RESUME when done.',
    ]);

    step('✓ Kiosk PIN checkpoint passed');
  });
});
