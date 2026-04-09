import { test, type Page } from '@playwright/test';
import { loginViaApi, SEED_PASSWORD } from '../helpers/auth.helper';
import {
  fillInput,
  fillTextarea,
  selectOption,
  fillDate,
  clickButton,
  clickButtonContaining,
  waitForDialog,
  navigateTo,
  waitForAnySnackbar,
  switchTab,
  clickTableRow,
  brief,
  dismissSnackbar,
} from '../helpers/ui.helper';
import { checkpoint, step, phase } from '../helpers/interactive.helper';

/**
 * 02e — QuickBooks Sandbox Integration
 *
 * Requires: 01-foundation
 * Interactive: YES — user connects QB sandbox, verifies sync
 * Mutually exclusive with: 02d (full-populate runs in mock mode)
 *
 * IMPORTANT: This scenario connects to your REAL Intuit sandbox.
 * No billing occurs — sandbox companies are free test environments.
 * But data WILL be created in your sandbox company.
 *
 * Before running:
 *   1. Ensure MOCK_INTEGRATIONS=false in docker-compose env
 *      (or restart API with: MOCK_INTEGRATIONS=false docker compose up -d --build qb-engineer-api)
 *   2. Have your Intuit developer credentials ready
 *   3. Have your sandbox company URL open for verification
 *
 * Workflow:
 *   ⏸ USER: connect QB sandbox via OAuth in admin panel
 *   Automation creates customers that will sync to QB
 *   ⏸ USER: verify customers appear in QB sandbox
 *   Automation creates invoices through the order pipeline
 *   ⏸ USER: verify invoices sync to QB sandbox
 *   ⏸ USER: record payment, verify it syncs
 *   ⏸ USER: test kanban stage moves that trigger QB document creation
 *   ⏸ USER: disconnect QB and verify standalone mode activates
 */

test.describe.serial('02e QB Sandbox', () => {
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

  // -----------------------------------------------------------------------
  // PHASE 1: Connect QB Sandbox
  // -----------------------------------------------------------------------

  test('connect QB sandbox', async () => {
    phase('QuickBooks Sandbox Connection');
    await navigateTo(page, '/admin/integrations');
    await brief(page, 1000);

    await checkpoint(page, 'CONNECT QUICKBOOKS SANDBOX', [
      'PREREQUISITES:',
      '  • API must be running with MOCK_INTEGRATIONS=false',
      '    Run: MOCK_INTEGRATIONS=false docker compose up -d --build qb-engineer-api',
      '  • Your QB app credentials must be in appsettings.Secrets.json:',
      '    QuickBooks.ClientId, QuickBooks.ClientSecret',
      '  • FrontendBaseUrl must match (http://localhost:4200)',
      '',
      'YOUR TASKS:',
      '  1. You are on /admin/integrations',
      '  2. Click "Connect to QuickBooks"',
      '  3. You\'ll be redirected to Intuit OAuth login',
      '  4. Log in with your Intuit developer account',
      '  5. Select your SANDBOX company (not production!)',
      '  6. Authorize the app',
      '  7. You\'ll be redirected back to the admin page',
      '  8. Verify the connection shows:',
      '     - Company name (your sandbox company)',
      '     - "Connected" status',
      '     - "Test Connection" button works',
      '     - "Disconnect" button is visible',
      '',
      'Click RESUME when connected.',
    ]);
    step('✓ QB sandbox connected');
  });

  // -----------------------------------------------------------------------
  // PHASE 2: Customer Sync
  // -----------------------------------------------------------------------

  test('create customer and verify sync', async () => {
    phase('Customer Sync Test');

    // Create a new customer that should sync to QB
    await navigateTo(page, '/customers');
    await brief(page, 1000);

    await clickButton(page, 'New Customer');
    await waitForDialog(page, 'New Customer');
    await fillInput(page, 'Name', 'QB Sync Test Corp');
    await fillInput(page, 'Company Name', 'QB Sync Test Corporation');
    await fillInput(page, 'Email', 'sync-test@example.com');
    await fillInput(page, 'Phone', '555-SYNC-001');
    await clickButton(page, 'Create Customer');
    await waitForAnySnackbar(page);
    await dismissSnackbar(page);
    step('✓ Created "QB Sync Test Corp"');

    await brief(page, 3000); // Give sync queue time to process

    await checkpoint(page, 'VERIFY CUSTOMER SYNC TO QB', [
      'A customer "QB Sync Test Corp" was just created.',
      'The sync queue should push this to your QB sandbox.',
      '',
      'YOUR TASKS:',
      '  1. Open your QB sandbox at https://sandbox.qbo.intuit.com',
      '  2. Navigate to Customers list',
      '  3. Search for "QB Sync Test"',
      '  4. Verify the customer was created with:',
      '     - Name: QB Sync Test Corporation',
      '     - Email: sync-test@example.com',
      '',
      '  If the customer hasn\'t appeared yet:',
      '  • The sync queue runs every 2 minutes (Hangfire)',
      '  • Check API logs: docker compose logs -f qb-engineer-api | grep -i sync',
      '  • Wait and refresh QB',
      '',
      'Click RESUME when verified.',
    ]);
    step('✓ Customer sync verified');
  });

  // -----------------------------------------------------------------------
  // PHASE 3: Quote → SO → Invoice pipeline with QB sync
  // -----------------------------------------------------------------------

  test('create quote for sync test customer', async () => {
    phase('Order Pipeline with QB Sync');
    await navigateTo(page, '/quotes');
    await brief(page, 1000);

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const expDate = `${futureDate.getMonth() + 1}/${futureDate.getDate()}/${futureDate.getFullYear()}`;

    await clickButton(page, 'New Quote');
    await waitForDialog(page, 'New Quote');
    await selectOption(page, 'Customer', 'QB Sync Test');
    await fillDate(page, 'Expiration Date', expDate);
    await fillInput(page, 'Tax Rate', '0');

    // Add line items
    await fillInput(page, 'Description', 'Widget Assembly — QB sync test item');
    await fillInput(page, 'Qty', '5');
    await fillInput(page, 'Price', '100.00');
    await page.locator('button .material-icons-outlined:text-is("add")').first().click().catch(async () => {
      await clickButtonContaining(page, 'Add');
    });
    await brief(page, 400);

    await clickButton(page, 'Create Quote');
    await waitForAnySnackbar(page);
    await dismissSnackbar(page);
    step('✓ Quote created for QB Sync Test Corp');
  });

  test('user converts quote through pipeline', async () => {
    await checkpoint(page, 'QUOTE → SALES ORDER → INVOICE WITH QB SYNC', [
      'A quote for "QB Sync Test Corp" was created ($500).',
      '',
      'YOUR TASKS — follow the full pipeline:',
      '',
      '  1. QUOTE → SALES ORDER:',
      '     - Click the quote row in /quotes',
      '     - Click "Send" → then "Accept"',
      '     - Click "Convert to Order"',
      '     - Verify SO appears in /sales-orders',
      '',
      '  2. KANBAN STAGE MOVE (triggers QB Estimate):',
      '     - Go to /kanban',
      '     - Find a job and drag it to "Quoted" stage',
      '     - This should enqueue an Estimate to the QB sync queue',
      '     - Check API logs for sync activity',
      '',
      '  3. CREATE INVOICE:',
      '     - Go to /invoices',
      '     - Click "New Invoice"',
      '     - Customer: QB Sync Test Corp',
      '     - Add line: Widget Assembly, qty 5, $100.00 ea',
      '     - Create the invoice',
      '',
      '  4. VERIFY IN QB SANDBOX:',
      '     - Wait 2-3 minutes for sync queue',
      '     - Check QB sandbox for:',
      '       • Estimate (from quote stage move)',
      '       • Invoice (from manual invoice creation)',
      '     - Verify amounts match',
      '',
      'Click RESUME when verified.',
    ]);
    step('✓ Pipeline sync checkpoint passed');
  });

  // -----------------------------------------------------------------------
  // PHASE 4: Payment sync
  // -----------------------------------------------------------------------

  test('user records payment and verifies sync', async () => {
    await checkpoint(page, 'PAYMENT SYNC TO QB', [
      'Now test payment syncing:',
      '',
      'YOUR TASKS:',
      '  1. Go to /payments',
      '  2. Click "New Payment"',
      '  3. Customer: QB Sync Test Corp',
      '  4. Amount: $500.00 (full payment)',
      '  5. Method: Check',
      '  6. Reference: TEST-CHK-001',
      '  7. Record the payment',
      '',
      '  8. Wait 2-3 minutes for sync',
      '',
      '  9. In QB sandbox, verify:',
      '     - Payment appears under QB Sync Test Corp',
      '     - Amount matches ($500)',
      '     - Invoice is marked as Paid',
      '',
      'Click RESUME when verified.',
    ]);
    step('✓ Payment sync checkpoint passed');
  });

  // -----------------------------------------------------------------------
  // PHASE 5: Backward move enforcement
  // -----------------------------------------------------------------------

  test('test irreversible stage enforcement', async () => {
    await checkpoint(page, 'IRREVERSIBLE STAGE TEST', [
      'Test that jobs can\'t move backward from irreversible stages:',
      '',
      'YOUR TASKS:',
      '  1. Go to /kanban',
      '  2. Find a job in "Invoiced/Sent" stage',
      '     (from the seeded data — J-1020 through J-1023)',
      '  3. Try to drag it BACKWARD to "Shipped" or earlier',
      '  4. It should be BLOCKED — the stage is irreversible',
      '     (because Invoice is an accounting document)',
      '  5. Try the same with "Payment Received" stage jobs',
      '',
      '  6. Verify you CAN still move forward (Invoiced → Payment Received)',
      '',
      'Click RESUME when verified.',
    ]);
    step('✓ Irreversible stage test passed');
  });

  // -----------------------------------------------------------------------
  // PHASE 6: Disconnect and verify standalone mode
  // -----------------------------------------------------------------------

  test('disconnect QB and verify standalone mode', async () => {
    await checkpoint(page, 'DISCONNECT QB — STANDALONE MODE', [
      'Finally, test disconnecting and switching to standalone mode:',
      '',
      'YOUR TASKS:',
      '  1. Go to /admin/integrations',
      '  2. Click "Disconnect"',
      '  3. Confirm the disconnection',
      '',
      '  4. Verify standalone mode activates:',
      '     - /invoices should show full CRUD (not "managed by provider")',
      '     - /payments should show full CRUD',
      '     - The "Connect to QuickBooks" button reappears',
      '',
      '  5. Create a test invoice in standalone mode:',
      '     - Go to /invoices → New Invoice',
      '     - It should work normally (no QB sync)',
      '',
      '  6. (Optional) Reconnect to verify re-connection works',
      '',
      'Click RESUME when done.',
    ]);
    step('✓ Standalone mode checkpoint passed');
  });

  test('summary', async () => {
    console.log('');
    console.log('═'.repeat(60));
    console.log('  QB Sandbox integration test complete.');
    console.log('');
    console.log('  Verified:');
    console.log('  • OAuth connection to QB sandbox');
    console.log('  • Customer sync (app → QB)');
    console.log('  • Invoice sync via order pipeline');
    console.log('  • Payment sync');
    console.log('  • Irreversible stage enforcement');
    console.log('  • Disconnect → standalone mode switch');
    console.log('═'.repeat(60));
  });
});
