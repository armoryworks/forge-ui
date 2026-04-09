import { test, type Page } from '@playwright/test';
import { loginViaApi, SEED_PASSWORD } from '../helpers/auth.helper';
import {
  navigateTo,
  brief,
} from '../helpers/ui.helper';
import { checkpoint, step, phase } from '../helpers/interactive.helper';

/**
 * 00 — QB Sandbox Cleanup
 *
 * Run BEFORE any QB sandbox scenario to ensure a clean slate.
 * Interactive — user verifies cleanup in QB portal.
 *
 * Two approaches (user picks one):
 *   A. Manual: Reset sandbox company via Intuit developer portal
 *   B. Surgical: Delete only test entities created by our scenarios
 *
 * Usage:
 *   npm run scenario:qb-clean          # Run cleanup only
 *   npm run scenario:qb-fresh          # Cleanup → foundation → QB sandbox
 */

test.describe.serial('00 QB Cleanup', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginViaApi(page, 'admin@qbengineer.local', SEED_PASSWORD);
    await navigateTo(page, '/');
    await page.waitForLoadState('networkidle');
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('clean QB sandbox', async () => {
    phase('QuickBooks Sandbox Cleanup');

    await checkpoint(page, 'CLEAN QB SANDBOX FOR FRESH TESTS', [
      'Before running QB integration scenarios, clean the sandbox.',
      '',
      'OPTION A — FULL RESET (recommended for fresh start):',
      '  1. Go to https://developer.intuit.com',
      '  2. Dashboard → your app → Sandbox',
      '  3. Click "Reset sandbox company data"',
      '  4. Wait ~30 seconds for reset to complete',
      '  5. Your sandbox returns to default sample data',
      '',
      'OPTION B — SURGICAL DELETE (keep sample data):',
      '  1. Go to https://sandbox.qbo.intuit.com',
      '  2. Delete only entities created by our tests:',
      '     - Customers starting with "QB Sync Test"',
      '     - Invoices linked to those customers',
      '     - Payments linked to those invoices',
      '     - Estimates from kanban stage moves',
      '',
      'OPTION C — SEPARATE SANDBOX COMPANY:',
      '  1. In Intuit Developer portal, create a new sandbox company',
      '  2. Name it something like "QBE Test Company #2"',
      '  3. When connecting in scenario 02e, select the new company',
      '  4. Each test path gets its own sandbox company',
      '',
      'ALSO: Ensure the local DB is fresh:',
      '  ./e2e/scenarios/reset-db.sh',
      '',
      'Click RESUME when your sandbox is clean.',
    ]);
    step('✓ QB sandbox cleanup done');
  });

  test('verify API is in integration mode', async () => {
    await checkpoint(page, 'VERIFY API IS IN INTEGRATION MODE', [
      'The API must have MOCK_INTEGRATIONS=false for QB tests.',
      '',
      'Check:',
      '  docker compose exec qb-engineer-api printenv | grep MOCK',
      '',
      'If it shows MOCK_INTEGRATIONS=true, restart with:',
      '  MOCK_INTEGRATIONS=false docker compose up -d --build qb-engineer-api',
      '',
      'Also verify your QB credentials are configured:',
      '  Check appsettings.Secrets.json for:',
      '  • QuickBooks:ClientId',
      '  • QuickBooks:ClientSecret',
      '  • QuickBooks:Environment = "sandbox"',
      '',
      'Click RESUME when ready.',
    ]);
    step('✓ API integration mode verified');
  });
});
