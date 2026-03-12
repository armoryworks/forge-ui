import { test, type Page } from '@playwright/test';
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
  brief,
  dismissSnackbar,
} from '../helpers/ui.helper';
import { step, phase } from '../helpers/interactive.helper';

/**
 * 02d — Full Populate (NON-INTERACTIVE)
 *
 * Requires: 01-foundation
 * Interactive: NO — runs headless, creates maximum data
 *
 * Creates everything from all branches without pausing:
 * - Jobs across all stages and tracks
 * - Quotes, sales orders, purchase orders
 * - Time entries, expenses
 * - Leads at various pipeline stages
 * - Assets
 *
 * Use this when you just want a fully populated DB for:
 *   ✓ Dashboard testing (all widgets have data)
 *   ✓ Report builder (meaningful data to query)
 *   ✓ Search testing (entities across all types)
 *   ✓ Demo/screenshots
 */

test.describe.serial('02d Full Populate', () => {
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

  // -----------------------------------------------------------------------
  // JOBS — 8 production + 2 R&D + 2 maintenance
  // -----------------------------------------------------------------------

  test('create production jobs', async () => {
    phase('Creating production jobs');
    await navigateTo(page, '/kanban');
    await brief(page, 1500);

    const jobs = [
      { title: 'Machine Housing Batch — TechPro', customer: 'TechPro Industries', priority: 'High' },
      { title: 'Titanium Pin Run — Quantum', customer: 'Quantum Dynamics', priority: 'Normal' },
      { title: 'Valve Assembly — TechPro', customer: 'TechPro Industries', priority: 'High' },
      { title: 'Motor Mount Weld — NorthStar', customer: 'NorthStar Aerospace', priority: 'Urgent' },
      { title: 'Control Panel Build — Pacific Rim', customer: 'Pacific Rim Manufacturing', priority: 'Normal' },
      { title: 'Bushing Order — Acme', customer: 'Acme Corp', priority: 'Low' },
      { title: 'Bracket Fabrication — Internal', priority: 'Normal' },
      { title: 'Guide Rail Replacement', priority: 'High' },
    ];

    for (const j of jobs) {
      await clickButton(page, 'New Job');
      await waitForDialog(page, 'New Job');
      await fillInput(page, 'Title', j.title);

      const trackSelect = page.locator('mat-form-field', { has: page.locator('mat-label:text-is("Track Type")') });
      if (await trackSelect.isVisible()) {
        await selectOption(page, 'Track Type', 'Production');
      }

      if (j.customer) {
        await selectOption(page, 'Customer', j.customer);
      }
      await selectOption(page, 'Priority', j.priority);

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7 + Math.floor(Math.random() * 21));
      await fillDate(page, 'Due Date', `${dueDate.getMonth() + 1}/${dueDate.getDate()}/${dueDate.getFullYear()}`);

      await clickButton(page, 'Create Job');
      await waitForAnySnackbar(page);
      await dismissSnackbar(page);
      await brief(page, 600);
      step(`✓ ${j.title}`);
    }
  });

  test('create R&D jobs', async () => {
    phase('Creating R&D jobs');

    const rdJobs = [
      { title: 'Prototype Housing V2 — weight reduction' },
      { title: 'New alloy evaluation — Inconel 718' },
    ];

    for (const j of rdJobs) {
      await clickButton(page, 'New Job');
      await waitForDialog(page, 'New Job');
      await fillInput(page, 'Title', j.title);
      const trackSelect = page.locator('mat-form-field', { has: page.locator('mat-label:text-is("Track Type")') });
      if (await trackSelect.isVisible()) {
        await trackSelect.locator('mat-select').click();
        const rdOption = page.locator('mat-option', { hasText: /R&D|Tooling/i }).first();
        if (await rdOption.isVisible()) await rdOption.click();
        else await page.locator('mat-option').nth(1).click();
        await brief(page, 300);
      }
      await selectOption(page, 'Priority', 'High');
      await clickButton(page, 'Create Job');
      await waitForAnySnackbar(page);
      await dismissSnackbar(page);
      await brief(page, 600);
      step(`✓ ${j.title}`);
    }
  });

  test('create maintenance jobs', async () => {
    phase('Creating maintenance jobs');

    const maintJobs = [
      { title: 'Haas VF-2SS — Spindle bearing replacement' },
      { title: 'Trumpf TruLaser — Lens cleaning & calibration' },
    ];

    for (const j of maintJobs) {
      await clickButton(page, 'New Job');
      await waitForDialog(page, 'New Job');
      await fillInput(page, 'Title', j.title);
      const trackSelect = page.locator('mat-form-field', { has: page.locator('mat-label:text-is("Track Type")') });
      if (await trackSelect.isVisible()) {
        await trackSelect.locator('mat-select').click();
        const maintOption = page.locator('mat-option', { hasText: /Maintenance/i }).first();
        if (await maintOption.isVisible()) await maintOption.click();
        else await page.locator('mat-option').nth(2).click();
        await brief(page, 300);
      }
      await selectOption(page, 'Priority', 'Urgent');
      await clickButton(page, 'Create Job');
      await waitForAnySnackbar(page);
      await dismissSnackbar(page);
      await brief(page, 600);
      step(`✓ ${j.title}`);
    }
  });

  // -----------------------------------------------------------------------
  // QUOTES + POs
  // -----------------------------------------------------------------------

  test('create quotes', async () => {
    phase('Creating quotes');
    await navigateTo(page, '/quotes');
    await brief(page, 1000);

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const expDate = `${futureDate.getMonth() + 1}/${futureDate.getDate()}/${futureDate.getFullYear()}`;

    const quotes = [
      { customer: 'Acme Corp', desc: 'Aluminum Housing machined', qty: '50', price: '45.00' },
      { customer: 'TechPro Industries', desc: 'Hydraulic Valve Assembly', qty: '10', price: '350.00' },
      { customer: 'NorthStar Aerospace', desc: 'Motor Mount Assembly welded', qty: '5', price: '780.00' },
    ];

    for (const q of quotes) {
      await clickButton(page, 'New Quote');
      await waitForDialog(page, 'New Quote');
      await selectOption(page, 'Customer', q.customer);
      await fillDate(page, 'Expiration Date', expDate);
      await fillInput(page, 'Tax Rate', '7.5');
      await fillInput(page, 'Description', q.desc);
      await fillInput(page, 'Qty', q.qty);
      await fillInput(page, 'Price', q.price);
      await page.locator('button .material-icons-outlined:text-is("add")').first().click().catch(() => {});
      await brief(page, 300);
      await clickButton(page, 'Create Quote');
      await waitForAnySnackbar(page);
      await dismissSnackbar(page);
      await brief(page, 600);
      step(`✓ Quote: ${q.customer}`);
    }
  });

  test('create purchase orders', async () => {
    phase('Creating purchase orders');
    await navigateTo(page, '/purchase-orders');
    await brief(page, 1000);

    const pos = [
      { vendor: 'Steel Supply Co', desc: '6061-T6 Bar Stock', qty: '10', price: '185.00' },
      { vendor: 'FastCut Tooling', desc: 'End Mill Carbide 0.5"', qty: '20', price: '42.00' },
      { vendor: 'Allied Raw Materials', desc: 'C360 Brass Round', qty: '12', price: '110.00' },
    ];

    for (const po of pos) {
      await clickButton(page, 'New PO');
      await waitForDialog(page, 'New Purchase Order');
      await selectOption(page, 'Vendor', po.vendor);
      await fillInput(page, 'Description', po.desc);
      await fillInput(page, 'Qty', po.qty);
      await fillInput(page, 'Price', po.price);
      await page.locator('button .material-icons-outlined:text-is("add")').first().click().catch(() => {});
      await brief(page, 300);
      await clickButton(page, 'Create PO');
      await waitForAnySnackbar(page);
      await dismissSnackbar(page);
      await brief(page, 600);
      step(`✓ PO: ${po.vendor}`);
    }
  });

  // -----------------------------------------------------------------------
  // TIME ENTRIES
  // -----------------------------------------------------------------------

  test('create time entries', async () => {
    phase('Creating time entries');
    await navigateTo(page, '/time-tracking');
    await brief(page, 1000);

    const entries = [
      { hours: '4', minutes: '30', notes: 'Housing batch machining — units 1-25' },
      { hours: '2', minutes: '15', notes: 'Tooling setup for titanium run' },
      { hours: '6', minutes: '0', notes: 'Valve assembly units 1-5' },
      { hours: '1', minutes: '45', notes: 'QC inspection — brass bushings' },
      { hours: '3', minutes: '0', notes: 'Motor mount welding — units 1-3' },
    ];

    for (const e of entries) {
      await clickButton(page, 'Manual Entry');
      await waitForDialog(page, 'Log Time Entry');
      await fillInput(page, 'Hours', e.hours);
      await fillInput(page, 'Minutes', e.minutes);
      await fillTextarea(page, 'Notes', e.notes);
      await clickButton(page, 'Log Entry');
      await waitForAnySnackbar(page);
      await dismissSnackbar(page);
      await brief(page, 600);
      step(`✓ ${e.hours}h ${e.minutes}m`);
    }
  });

  // -----------------------------------------------------------------------
  // EXPENSES
  // -----------------------------------------------------------------------

  test('create expenses', async () => {
    phase('Creating expenses');
    await navigateTo(page, '/expenses');
    await brief(page, 1000);

    const expenses = [
      { amount: '245.00', category: 'Tooling', desc: 'Replacement end mills — CNMG120408' },
      { amount: '89.50', category: 'Material', desc: 'Emergency aluminum stock' },
      { amount: '1250.00', category: 'Tooling', desc: 'Precision grinding wheel for titanium' },
      { amount: '55.00', category: 'Shipping', desc: 'Overnight shipping — NorthStar samples' },
      { amount: '180.00', category: 'Travel', desc: 'Customer site visit — TechPro' },
    ];

    for (const exp of expenses) {
      await clickButton(page, 'New Expense');
      await waitForDialog(page, 'New Expense');
      await fillInput(page, 'Amount', exp.amount);
      await selectOption(page, 'Category', exp.category);
      await fillTextarea(page, 'Description', exp.desc);
      await clickButton(page, 'Submit Expense');
      await waitForAnySnackbar(page);
      await dismissSnackbar(page);
      await brief(page, 600);
      step(`✓ $${exp.amount}`);
    }
  });

  // -----------------------------------------------------------------------
  // LEADS
  // -----------------------------------------------------------------------

  test('create leads', async () => {
    phase('Creating leads');
    await navigateTo(page, '/leads');
    await brief(page, 1000);

    const leads = [
      { company: 'Riverside Engineering', contact: 'Tom Wilson', email: 'tom@riverside.com', source: 'Website' },
      { company: 'Summit Fabrication', contact: 'Lisa Park', email: 'lisa@summitfab.com', source: 'Referral' },
      { company: 'Coastal Defense Systems', contact: 'Mark Reynolds', email: 'mreynolds@coastal.gov', source: 'Trade Show' },
      { company: 'GreenTech Solar', contact: 'Amy Chen', email: 'achen@greentech.com', source: 'Cold Call' },
    ];

    for (const lead of leads) {
      await clickButton(page, 'New Lead');
      await waitForDialog(page, 'New Lead');
      await fillInput(page, 'Company Name', lead.company);
      await fillInput(page, 'Contact Name', lead.contact);
      await fillInput(page, 'Email', lead.email);
      await selectOption(page, 'Source', lead.source);
      await clickButton(page, 'Create Lead');
      await waitForAnySnackbar(page);
      await dismissSnackbar(page);
      await brief(page, 600);
      step(`✓ ${lead.company}`);
    }
  });

  // -----------------------------------------------------------------------
  // ASSETS
  // -----------------------------------------------------------------------

  test('create assets', async () => {
    phase('Creating assets');
    await navigateTo(page, '/assets');
    await brief(page, 1000);

    const assets = [
      { name: 'Haas VF-2SS CNC Mill', type: 'Machinery', location: 'Bay 1', serial: 'HAAS-VF2SS-1042' },
      { name: 'Mazak QTN-200 CNC Lathe', type: 'Machinery', location: 'Bay 2', serial: 'MAZ-QTN200-0887' },
      { name: 'Brown & Sharpe CMM', type: 'Equipment', location: 'QC Lab', serial: 'BS-GLBS-3301' },
    ];

    for (const a of assets) {
      await clickButton(page, 'New Asset');
      await waitForDialog(page, 'New Asset');
      await fillInput(page, 'Name', a.name);
      await selectOption(page, 'Type', a.type);
      await fillInput(page, 'Location', a.location);
      await fillInput(page, 'Serial Number', a.serial);
      await clickButton(page, 'Create Asset');
      await waitForAnySnackbar(page);
      await dismissSnackbar(page);
      await brief(page, 600);
      step(`✓ ${a.name}`);
    }
  });

  test('summary', async () => {
    console.log('');
    console.log('═'.repeat(60));
    console.log('  Full populate complete. DB contains:');
    console.log('  • 15 parts + 43 seeded jobs + 12 new jobs');
    console.log('  • 5 vendors, 7 customers');
    console.log('  • 3 quotes, 3 purchase orders');
    console.log('  • 5 time entries, 5 expenses, 4 leads');
    console.log('  • 3 assets, warehouse with bins');
    console.log('  • 27 pre-seeded reports');
    console.log('');
    console.log('  Open http://localhost:4200 to explore.');
    console.log('═'.repeat(60));
  });
});
