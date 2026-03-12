import { test, expect, type Page } from '@playwright/test';
import { loginViaApi } from '../helpers/auth.helper';
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
  clickTableRow,
  brief,
  dismissSnackbar,
} from '../helpers/ui.helper';
import { checkpoint, step, phase } from '../helpers/interactive.helper';

/**
 * 02b — Order Pipeline
 *
 * Requires: 01-foundation
 * Interactive: YES — user reviews quotes, converts to SOs, receives POs
 *
 * Workflow:
 *   Automation creates 3 quotes with realistic line items
 *   ⏸ USER: review a quote, edit lines, send to customer
 *   ⏸ USER: accept a quote, convert to sales order
 *   Automation creates purchase orders for materials
 *   ⏸ USER: receive PO delivery into bins (scanner test)
 */

test.describe.serial('02b Orders', () => {
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

  test('create quotes', async () => {
    phase('Creating quotes with line items');
    await navigateTo(page, '/quotes');
    await brief(page, 1000);

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const expDate = `${futureDate.getMonth() + 1}/${futureDate.getDate()}/${futureDate.getFullYear()}`;

    const quotes = [
      {
        customer: 'Acme Corp',
        lines: [
          { desc: 'Aluminum Housing 6061-T6 — CNC machined per DWG-HOU-100', qty: '50', price: '45.00' },
          { desc: 'Brass Bushing — turned to print REV-C', qty: '200', price: '8.50' },
        ],
      },
      {
        customer: 'TechPro Industries',
        lines: [
          { desc: 'Hydraulic Valve Assembly — complete build', qty: '10', price: '350.00' },
          { desc: 'Stainless Shaft 304 — turned & polished', qty: '10', price: '65.00' },
        ],
      },
      {
        customer: 'NorthStar Aerospace',
        lines: [
          { desc: 'Motor Mount Assembly — welded, AS9100 cert', qty: '5', price: '780.00' },
        ],
      },
    ];

    for (const q of quotes) {
      await clickButton(page, 'New Quote');
      await waitForDialog(page, 'New Quote');
      await selectOption(page, 'Customer', q.customer);
      await fillDate(page, 'Expiration Date', expDate);
      await fillInput(page, 'Tax Rate', '7.5');

      for (const line of q.lines) {
        await fillInput(page, 'Description', line.desc);
        await fillInput(page, 'Qty', line.qty);
        await fillInput(page, 'Price', line.price);
        await page.locator('button .material-icons-outlined:text-is("add")').first().click().catch(async () => {
          await clickButtonContaining(page, 'Add');
        });
        await brief(page, 400);
      }

      await clickButton(page, 'Create Quote');
      await waitForAnySnackbar(page);
      await dismissSnackbar(page);
      await brief(page, 800);
      step(`✓ Quote for ${q.customer}`);
    }
  });

  test('user reviews and sends quotes', async () => {
    await checkpoint(page, 'REVIEW & SEND QUOTES', [
      '3 quotes have been created:',
      '  • Acme Corp — housings + bushings ($3,950)',
      '  • TechPro Industries — valve assembly + shafts ($4,150)',
      '  • NorthStar Aerospace — motor mounts ($3,900)',
      '',
      'YOUR TASKS:',
      '  1. Click on the Acme Corp quote row to open the detail panel',
      '  2. Review the line items and totals',
      '  3. Try editing a line item (change qty or price)',
      '  4. Click "Send" to mark the quote as sent to customer',
      '  5. Repeat for TechPro Industries quote',
      '  6. Leave the NorthStar quote as Draft',
      '',
      'Click RESUME when done.',
    ]);
    step('✓ Quote review checkpoint passed');
  });

  test('user converts quotes to sales orders', async () => {
    await checkpoint(page, 'ACCEPT & CONVERT TO SALES ORDER', [
      'Now accept quotes and convert them to sales orders:',
      '',
      'YOUR TASKS:',
      '  1. Click on the Acme Corp quote (should be "Sent" status)',
      '  2. Click "Accept" in the detail panel',
      '  3. Click "Convert to Order" to create a Sales Order',
      '  4. Verify you\'re redirected to the new Sales Order',
      '  5. Navigate back to /quotes',
      '  6. Convert the TechPro quote the same way',
      '',
      '  Now go to /sales-orders and verify both orders appear.',
      '',
      'Click RESUME when done.',
    ]);
    step('✓ Quote conversion checkpoint passed');
  });

  test('create purchase orders for materials', async () => {
    phase('Creating purchase orders for raw materials');
    await navigateTo(page, '/purchase-orders');
    await brief(page, 1000);

    const pos = [
      {
        vendor: 'Steel Supply Co',
        lines: [
          { desc: '6061-T6 Aluminum Bar Stock 2" dia x 12ft', qty: '10', price: '185.00' },
          { desc: '304 Stainless Round Bar 1" dia x 10ft', qty: '5', price: '220.00' },
        ],
      },
      {
        vendor: 'Allied Raw Materials',
        lines: [
          { desc: 'C360 Brass Round Bar 1.5" dia x 6ft', qty: '12', price: '110.00' },
        ],
      },
      {
        vendor: 'FastCut Tooling',
        lines: [
          { desc: 'End Mill 4-Flute 0.5" Carbide', qty: '20', price: '42.00' },
          { desc: 'Drill Bit Set HSS 1/16"-1/2"', qty: '5', price: '68.00' },
        ],
      },
    ];

    for (const po of pos) {
      await clickButton(page, 'New PO');
      await waitForDialog(page, 'New Purchase Order');
      await selectOption(page, 'Vendor', po.vendor);

      for (const line of po.lines) {
        await fillInput(page, 'Description', line.desc);
        await fillInput(page, 'Qty', line.qty);
        await fillInput(page, 'Price', line.price);
        await page.locator('button .material-icons-outlined:text-is("add")').first().click().catch(async () => {
          await clickButtonContaining(page, 'Add');
        });
        await brief(page, 400);
      }

      await clickButton(page, 'Create PO');
      await waitForAnySnackbar(page);
      await dismissSnackbar(page);
      await brief(page, 800);
      step(`✓ PO for ${po.vendor}`);
    }
  });

  test('user receives PO delivery', async () => {
    await checkpoint(page, 'RECEIVE PO DELIVERY — SCANNER TEST', [
      '3 purchase orders have been created for materials.',
      '',
      'YOUR TASKS:',
      '  1. Navigate to /inventory/receiving',
      '  2. Click "Receive Goods"',
      '  3. Select a PO line to receive against',
      '  4. Enter received quantity (try partial — less than PO qty)',
      '  5. Select a bin location (e.g., BIN-A1-01)',
      '  6. Enter a lot number (e.g., LOT-ALU-2026-001)',
      '  7. Click "Receive"',
      '',
      'SCANNER TEST:',
      '  8. If you have a barcode scanner, try scanning a bin barcode',
      '     (BIN-A1-01, BIN-A1-02, etc.)',
      '  9. The scan should populate the location field',
      '',
      '  10. Go to /inventory (Stock Levels tab) and verify stock appears',
      '',
      'Click RESUME when done.',
    ]);
    step('✓ PO receiving checkpoint passed');
  });
});
