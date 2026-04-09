import { test, type Page } from '@playwright/test';
import { loginViaApi, SEED_PASSWORD } from '../helpers/auth.helper';
import {
  navigateTo,
  brief,
} from '../helpers/ui.helper';
import { checkpoint, step, phase } from '../helpers/interactive.helper';

/**
 * 03b — Fulfillment (Shipping, Invoicing, Payments)
 *
 * Requires: 01-foundation → 02b-orders
 * Interactive: YES — user creates shipments, invoices, records payments
 *
 * Workflow:
 *   ⏸ USER: create a shipment from a sales order
 *   ⏸ USER: enter tracking number and carrier
 *   ⏸ USER: create an invoice from the shipment
 *   ⏸ USER: generate invoice PDF
 *   ⏸ USER: record a payment against the invoice
 */

test.describe.serial('03b Fulfillment', () => {
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

  test('create shipment from sales order', async () => {
    phase('Starting fulfillment workflow');
    await navigateTo(page, '/sales-orders');
    await brief(page, 1000);

    await checkpoint(page, 'CREATE SHIPMENT FROM SALES ORDER', [
      'Sales orders exist from the previous scenario (02b).',
      '',
      'YOUR TASKS:',
      '  1. You are on the Sales Orders page',
      '  2. Click on the Acme Corp sales order',
      '  3. In the detail panel, look for "Create Shipment"',
      '  4. Fill in shipment details:',
      '     - Carrier: FedEx',
      '     - Tracking: 7489201847362',
      '     - Select line items to ship (try partial — not all lines)',
      '  5. Click "Create Shipment"',
      '',
      '  6. Navigate to /shipments and verify the shipment appears',
      '  7. Click the shipment to view detail — check tracking info',
      '',
      'Click RESUME when done.',
    ]);
    step('✓ Shipment creation checkpoint passed');
  });

  test('create invoice from shipment', async () => {
    await checkpoint(page, 'CREATE INVOICE', [
      'Now create an invoice for what was shipped:',
      '',
      'YOUR TASKS:',
      '  1. Navigate to /invoices',
      '  2. Click "New Invoice"',
      '  3. Select customer: Acme Corp',
      '  4. Add line items matching what was shipped:',
      '     - Aluminum Housing 6061-T6 — qty per shipment — $45.00 ea',
      '     - Brass Bushing — qty per shipment — $8.50 ea',
      '  5. Set tax rate: 7.5%',
      '  6. Set credit terms: Net30',
      '  7. Click "Create Invoice"',
      '',
      '  8. Click the new invoice row to open detail',
      '  9. Click "Send" to mark it as sent',
      '',
      'Click RESUME when done.',
    ]);
    step('✓ Invoice creation checkpoint passed');
  });

  test('generate invoice PDF', async () => {
    await checkpoint(page, 'GENERATE INVOICE PDF', [
      'Test the PDF generation:',
      '',
      'YOUR TASKS:',
      '  1. You should be on /invoices with the Acme invoice visible',
      '  2. Click the invoice row to open detail',
      '  3. Look for a "PDF" or "Download" or "Print" button',
      '  4. Click it — a PDF should download or open in a new tab',
      '  5. Verify the PDF contains:',
      '     - Company logo (if uploaded)',
      '     - Invoice number',
      '     - Customer info',
      '     - Line items with quantities and prices',
      '     - Tax calculation',
      '     - Total amount',
      '     - Payment terms',
      '',
      'Click RESUME when done.',
    ]);
    step('✓ PDF generation checkpoint passed');
  });

  test('record payment', async () => {
    await checkpoint(page, 'RECORD PAYMENT', [
      'Now record a payment against the invoice:',
      '',
      'YOUR TASKS:',
      '  1. Navigate to /payments',
      '  2. Click "New Payment"',
      '  3. Select customer: Acme Corp',
      '  4. Enter payment amount: try PARTIAL payment first',
      '     (e.g., $2,000 against a $3,950 invoice)',
      '  5. Select payment method (Check, Wire, ACH)',
      '  6. Enter reference number (e.g., CHK-44829)',
      '  7. Click "Record Payment"',
      '',
      '  8. Verify the invoice now shows "Partially Paid" status',
      '  9. Record a second payment for the remaining balance',
      '  10. Verify the invoice shows "Paid" status',
      '',
      '  BONUS:',
      '  11. Navigate to /invoices and check the status column',
      '  12. Try generating a Customer Statement:',
      '      /customers → click Acme → look for "Statement" button',
      '',
      'Click RESUME when done.',
    ]);
    step('✓ Payment recording checkpoint passed');
  });
});
