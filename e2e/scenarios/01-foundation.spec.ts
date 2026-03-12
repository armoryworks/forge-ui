import { test, type Page } from '@playwright/test';
import { loginViaApi } from '../helpers/auth.helper';
import {
  fillInput,
  fillTextarea,
  selectOption,
  clickButton,
  waitForDialog,
  navigateTo,
  waitForAnySnackbar,
  brief,
  dismissSnackbar,
} from '../helpers/ui.helper';
import { step, phase } from '../helpers/interactive.helper';

/**
 * 01 — Foundation
 *
 * Non-interactive. Creates baseline data all other scenarios need:
 * - 10 standard parts, 3 assemblies, 2 tooling parts
 * - 5 vendors
 * - 3 additional customers
 * - Warehouse → aisles → shelves → bins hierarchy
 *
 * Run first, always. All other scenarios depend on this.
 */

test.describe.serial('01 Foundation', () => {
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

  test('create customers', async () => {
    phase('Creating customers');
    await navigateTo(page, '/customers');

    const customers = [
      { name: 'TechPro Industries', company: 'TechPro Industries LLC', email: 'orders@techpro.com', phone: '555-100-2000' },
      { name: 'NorthStar Aerospace', company: 'NorthStar Aerospace Inc', email: 'procurement@northstar.aero', phone: '555-200-3000' },
      { name: 'Pacific Rim Manufacturing', company: 'Pacific Rim Mfg Co', email: 'purchasing@pacificrim.com', phone: '555-300-4000' },
    ];

    for (const c of customers) {
      await clickButton(page, 'New Customer');
      await waitForDialog(page, 'New Customer');
      await fillInput(page, 'Name', c.name);
      await fillInput(page, 'Company Name', c.company);
      await fillInput(page, 'Email', c.email);
      await fillInput(page, 'Phone', c.phone);
      await clickButton(page, 'Create Customer');
      await waitForAnySnackbar(page);
      await dismissSnackbar(page);
      await brief(page, 600);
      step(`✓ ${c.name}`);
    }
  });

  test('create vendors', async () => {
    phase('Creating vendors');
    await navigateTo(page, '/vendors');

    const vendors = [
      { company: 'Steel Supply Co', contact: 'Frank Miller', email: 'sales@steelsupply.com', phone: '555-111-0001', city: 'Pittsburgh', state: 'PA' },
      { company: 'FastCut Tooling', contact: 'Sarah Chen', email: 'orders@fastcut.com', phone: '555-111-0002', city: 'Cincinnati', state: 'OH' },
      { company: 'Allied Raw Materials', contact: 'Bob Thompson', email: 'bob@alliedraw.com', phone: '555-111-0003', city: 'Cleveland', state: 'OH' },
      { company: 'Precision Plastics', contact: 'Maria Gonzalez', email: 'sales@precisionplastics.com', phone: '555-111-0004', city: 'Houston', state: 'TX' },
      { company: 'Global Fasteners', contact: 'Jim Park', email: 'jim@globalfasteners.com', phone: '555-111-0005', city: 'Detroit', state: 'MI' },
    ];

    for (const v of vendors) {
      await clickButton(page, 'New Vendor');
      await waitForDialog(page, 'New Vendor');
      await fillInput(page, 'Company Name', v.company);
      await fillInput(page, 'Contact Name', v.contact);
      await fillInput(page, 'Email', v.email);
      await fillInput(page, 'Phone', v.phone);
      await fillInput(page, 'City', v.city);
      await fillInput(page, 'State', v.state);
      await clickButton(page, 'Create Vendor');
      await waitForAnySnackbar(page);
      await dismissSnackbar(page);
      await brief(page, 600);
      step(`✓ ${v.company}`);
    }
  });

  test('create parts', async () => {
    phase('Creating parts');
    await navigateTo(page, '/parts');

    const parts: { desc: string; material: string; rev: string; type: string; moldRef?: string }[] = [
      // Standard parts
      { desc: 'Aluminum Housing 6061-T6', material: '6061-T6 Aluminum', rev: 'A', type: 'Standard' },
      { desc: 'Stainless Shaft 304', material: '304 Stainless Steel', rev: 'B', type: 'Standard' },
      { desc: 'Brass Bushing', material: 'C360 Brass', rev: 'A', type: 'Standard' },
      { desc: 'Titanium Pin Grade 5', material: 'Ti-6Al-4V', rev: 'A', type: 'Standard' },
      { desc: 'Carbon Steel Bracket', material: '1018 Carbon Steel', rev: 'C', type: 'Standard' },
      { desc: 'Delrin Spacer', material: 'Delrin (POM)', rev: 'A', type: 'Standard' },
      { desc: 'Copper Bus Bar', material: 'C110 Copper', rev: 'A', type: 'Standard' },
      { desc: 'UHMW Guide Rail', material: 'UHMW-PE', rev: 'B', type: 'Standard' },
      { desc: 'Spring Steel Clip', material: '1095 Spring Steel', rev: 'A', type: 'Standard' },
      { desc: 'Nylon Insulator', material: 'Nylon 6/6', rev: 'A', type: 'Standard' },
      // Assemblies
      { desc: 'Hydraulic Valve Assembly', material: 'Mixed', rev: 'A', type: 'Assembly' },
      { desc: 'Motor Mount Assembly', material: '6061 Aluminum / Steel', rev: 'B', type: 'Assembly' },
      { desc: 'Control Panel Assembly', material: 'Steel / Copper / Nylon', rev: 'A', type: 'Assembly' },
      // Tooling
      { desc: 'Housing Injection Mold — 4 Cavity', material: 'P20 Tool Steel', rev: 'A', type: 'Tooling Asset', moldRef: 'MOLD-HOU-001' },
      { desc: 'Shaft Turning Fixture', material: 'A2 Tool Steel', rev: 'A', type: 'Tooling Asset', moldRef: 'FIX-SHF-001' },
    ];

    for (const p of parts) {
      await clickButton(page, 'New Part');
      await waitForDialog(page, 'Create Part');
      await selectOption(page, 'Type', p.type);
      await fillInput(page, 'Description', p.desc);
      await fillInput(page, 'Revision', p.rev);
      await fillInput(page, 'Material', p.material);
      if (p.moldRef) {
        await fillInput(page, 'Mold/Tool Ref', p.moldRef);
      }
      await clickButton(page, 'Create Part');
      await waitForAnySnackbar(page);
      await dismissSnackbar(page);
      await brief(page, 600);
      step(`✓ ${p.desc}`);
    }
  });

  test('create storage locations', async () => {
    phase('Creating storage location hierarchy');
    await navigateTo(page, '/inventory/locations');
    await brief(page, 1000);

    // Top-level warehouse
    await clickButton(page, 'Add Location');
    await waitForDialog(page, 'Add Location');
    await fillInput(page, 'Name', 'Main Warehouse');
    await selectOption(page, 'Type', 'Warehouse');
    await fillInput(page, 'Description', 'Primary production warehouse');
    await clickButton(page, 'Create Location');
    await waitForAnySnackbar(page);
    await dismissSnackbar(page);
    await brief(page, 800);
    step('✓ Main Warehouse');

    // Select warehouse, add aisles
    await page.locator('text=Main Warehouse').first().click();
    await brief(page, 500);

    const aisles = ['Aisle A — Raw Materials', 'Aisle B — WIP', 'Aisle C — Finished Goods'];
    for (const aisle of aisles) {
      const addChild = page.getByRole('button', { name: 'Add Child' });
      const addLoc = page.getByRole('button', { name: 'Add Location' });
      if (await addChild.isVisible()) await addChild.click();
      else await addLoc.click();

      await waitForDialog(page, 'Add Location');
      await fillInput(page, 'Name', aisle);
      await selectOption(page, 'Type', 'Aisle');
      await clickButton(page, 'Create Location');
      await waitForAnySnackbar(page);
      await dismissSnackbar(page);
      await brief(page, 800);
      step(`✓ ${aisle}`);
    }

    // Add shelves + bins to Aisle A
    await page.locator('text=Aisle A').first().click();
    await brief(page, 500);

    for (let shelf = 1; shelf <= 2; shelf++) {
      const addChild = page.getByRole('button', { name: 'Add Child' });
      const addLoc = page.getByRole('button', { name: 'Add Location' });
      if (await addChild.isVisible()) await addChild.click();
      else await addLoc.click();

      await waitForDialog(page, 'Add Location');
      await fillInput(page, 'Name', `Shelf A-${shelf}`);
      await selectOption(page, 'Type', 'Shelf');
      await clickButton(page, 'Create Location');
      await waitForAnySnackbar(page);
      await dismissSnackbar(page);
      await brief(page, 800);
      step(`✓ Shelf A-${shelf}`);

      // Add 3 bins per shelf
      await page.locator(`text=Shelf A-${shelf}`).first().click();
      await brief(page, 500);

      for (let bin = 1; bin <= 3; bin++) {
        const addBtn = page.getByRole('button', { name: 'Add Child' });
        const addLoc2 = page.getByRole('button', { name: 'Add Location' });
        if (await addBtn.isVisible()) await addBtn.click();
        else await addLoc2.click();

        const binName = `BIN-A${shelf}-0${bin}`;
        await waitForDialog(page, 'Add Location');
        await fillInput(page, 'Name', binName);
        await selectOption(page, 'Type', 'Bin');
        await brief(page, 300);
        const barcodeField = page.locator('mat-form-field', { has: page.locator('mat-label:text-is("Barcode")') });
        if (await barcodeField.isVisible()) {
          await fillInput(page, 'Barcode', binName);
        }
        await clickButton(page, 'Create Location');
        await waitForAnySnackbar(page);
        await dismissSnackbar(page);
        await brief(page, 600);
        step(`  ✓ ${binName}`);
      }

      // Back to Aisle A for next shelf
      await page.locator('text=Aisle A').first().click();
      await brief(page, 500);
    }

    step('Storage hierarchy complete');
  });
});
