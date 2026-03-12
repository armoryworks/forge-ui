import { test, type Page } from '@playwright/test';
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
 * 03c — Quality & Traceability
 *
 * Requires: 01-foundation → 02c-production
 * Interactive: YES — user creates inspections, records results, scans parts
 *
 * Workflow:
 *   Automation creates assets and QC templates
 *   ⏸ USER: create a QC inspection from a template
 *   ⏸ USER: record pass/fail results on checklist items
 *   ⏸ USER: scan a part number to look up inspection
 *   ⏸ USER: create a part revision with notes
 */

test.describe.serial('03c Quality', () => {
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

  test('create assets', async () => {
    phase('Creating shop floor assets');
    await navigateTo(page, '/assets');
    await brief(page, 1000);

    const assets = [
      { name: 'Haas VF-2SS CNC Mill', type: 'Machinery', location: 'Bay 1', mfr: 'Haas', model: 'VF-2SS', serial: 'HAAS-VF2SS-1042' },
      { name: 'Mazak QTN-200 CNC Lathe', type: 'Machinery', location: 'Bay 2', mfr: 'Mazak', model: 'QTN-200', serial: 'MAZ-QTN200-0887' },
      { name: 'Brown & Sharpe CMM', type: 'Equipment', location: 'QC Lab', mfr: 'Brown & Sharpe', model: 'Global S', serial: 'BS-GLBS-3301' },
    ];

    for (const a of assets) {
      await clickButton(page, 'New Asset');
      await waitForDialog(page, 'New Asset');
      await fillInput(page, 'Name', a.name);
      await selectOption(page, 'Type', a.type);
      await fillInput(page, 'Location', a.location);
      await fillInput(page, 'Manufacturer', a.mfr);
      await fillInput(page, 'Model', a.model);
      await fillInput(page, 'Serial Number', a.serial);
      await clickButton(page, 'Create Asset');
      await waitForAnySnackbar(page);
      await dismissSnackbar(page);
      await brief(page, 600);
      step(`✓ ${a.name}`);
    }
  });

  test('user creates QC inspection', async () => {
    phase('Quality inspection workflow');

    await checkpoint(page, 'QC INSPECTION — CREATE & RECORD RESULTS', [
      '3 assets have been created (CNC Mill, CNC Lathe, CMM).',
      'Jobs exist on the kanban board from scenario 02c.',
      '',
      'YOUR TASKS:',
      '  1. Navigate to /quality',
      '',
      '  2. CREATE QC TEMPLATE (if Templates tab exists):',
      '     - Click "New Template"',
      '     - Name: "Standard Machined Part Inspection"',
      '     - Add checklist items:',
      '       • Verify dimensions per drawing (±0.001")',
      '       • Surface finish Ra check',
      '       • Visual — no burrs or tool marks',
      '       • Material cert matches callout',
      '     - Save the template',
      '',
      '  3. CREATE INSPECTION:',
      '     - Switch to Inspections tab',
      '     - Click "New Inspection"',
      '     - Select the template (if prompted)',
      '     - Link to a job (e.g., Housing Batch)',
      '     - Save',
      '',
      '  4. RECORD RESULTS:',
      '     - Open the inspection you just created',
      '     - For each checklist item, mark PASS or FAIL',
      '     - Try marking one item as FAIL with a note',
      '     - Save/complete the inspection',
      '',
      'Click RESUME when done.',
    ]);
    step('✓ QC inspection checkpoint passed');
  });

  test('user tests scanner on quality page', async () => {
    await checkpoint(page, 'SCANNER TEST — QUALITY PAGE', [
      'Test barcode scanning on the quality page:',
      '',
      'YOUR TASKS:',
      '  1. Stay on /quality',
      '',
      '  2. If you have a barcode scanner:',
      '     - Scan a part number',
      '     - The search/filter should populate with the scanned value',
      '     - Relevant inspections for that part should filter',
      '',
      '  3. If no scanner, simulate by:',
      '     - Clicking the search field',
      '     - Rapidly typing a part number (scanner wedge simulation)',
      '',
      '  4. Also try the Lots tab (if available):',
      '     - Search for lot number LOT-ALU-2026-001',
      '       (from receiving in scenario 02b, if you ran that path)',
      '',
      'Click RESUME when done.',
    ]);
    step('✓ Scanner quality checkpoint passed');
  });

  test('user creates part revision', async () => {
    await checkpoint(page, 'PART REVISIONS', [
      'Test part revision control:',
      '',
      'YOUR TASKS:',
      '  1. Navigate to /parts',
      '  2. Click on "Aluminum Housing 6061-T6" part',
      '  3. In the detail panel, find the Revisions tab',
      '  4. Click "New Revision" (or similar)',
      '  5. Enter:',
      '     - Revision: B',
      '     - Notes: "Updated bore tolerance from ±0.005 to ±0.002',
      '              per customer ECR-2026-012"',
      '  6. Save the revision',
      '  7. Verify revision B appears in the history',
      '',
      '  BONUS:',
      '  8. Try uploading a file to the new revision',
      '     (the Files tab should let you associate files with revisions)',
      '',
      'Click RESUME when done.',
    ]);
    step('✓ Part revision checkpoint passed');
  });
});
