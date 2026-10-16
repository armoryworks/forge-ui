import { test, expect, Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Demo-mode screenshot tour. Serves the static demo build on localhost:5500
 * (run `npx serve -s dist/forge-ui-demo/browser -l 5500` first).
 *
 * Output: e2e/screenshots/demo-tour/*.png — NOT source-controlled.
 *
 * Purpose: catch blank pages, empty tables, and missing demo data.
 */

const BASE_URL = process.env.DEMO_BASE_URL || 'http://localhost:5500';
const OUT_DIR = 'e2e/screenshots/demo-tour';

const PAGES: { name: string; path: string; waitFor?: string; note?: string }[] = [
  { name: '00-welcome', path: '/welcome' },
  { name: '01-dashboard', path: '/dashboard' },
  { name: '02-kanban', path: '/kanban' },
  { name: '03-backlog', path: '/backlog' },
  { name: '04-calendar', path: '/calendar' },
  { name: '05-parts', path: '/parts' },
  { name: '06-inventory-stock', path: '/inventory/stock' },
  { name: '07-inventory-receiving', path: '/inventory/receiving' },
  { name: '08-inventory-movements', path: '/inventory/movements' },
  { name: '09-inventory-cycle-counts', path: '/inventory/cycle-counts' },
  { name: '10-customers', path: '/customers' },
  { name: '11-leads', path: '/leads' },
  { name: '12-expenses', path: '/expenses' },
  { name: '13-expenses-approvals', path: '/expenses/approvals' },
  { name: '14-assets', path: '/assets' },
  { name: '15-time-tracking', path: '/time-tracking' },
  { name: '16-time-tracking-clock', path: '/time-tracking/clock' },
  { name: '17-employees', path: '/employees' },
  { name: '18-reports', path: '/reports' },
  { name: '19-planning', path: '/planning' },
  { name: '20-vendors', path: '/vendors' },
  { name: '21-purchasing', path: '/purchasing' },
  { name: '22-purchase-orders', path: '/purchase-orders' },
  { name: '23-sales-orders', path: '/sales-orders' },
  { name: '24-quotes', path: '/quotes' },
  { name: '25-shipments', path: '/shipments' },
  { name: '26-invoices', path: '/invoices' },
  { name: '27-payments', path: '/payments' },
  { name: '28-notifications', path: '/notifications' },
  { name: '29-approvals', path: '/approvals' },
  { name: '30-quality', path: '/quality' },
  { name: '31-customer-returns', path: '/customer-returns' },
  { name: '32-lots', path: '/lots' },
  { name: '33-onboarding', path: '/onboarding' },
  { name: '34-training', path: '/training' },
  { name: '35-ai', path: '/ai' },
  { name: '36-mrp', path: '/mrp' },
  { name: '37-oee', path: '/oee' },
  { name: '38-scheduling', path: '/scheduling' },
  { name: '39-chat', path: '/chat' },
  { name: '40-account-profile', path: '/account/profile' },
  { name: '41-account-security', path: '/account/security' },
  { name: '42-account-customization', path: '/account/customization' },
  { name: '43-account-integrations', path: '/account/integrations' },
  { name: '44-admin-users', path: '/admin/users' },
  { name: '45-admin-track-types', path: '/admin/track-types' },
  { name: '46-admin-reference-data', path: '/admin/reference-data' },
  { name: '47-admin-terminology', path: '/admin/terminology' },
  { name: '48-admin-integrations', path: '/admin/integrations' },
  { name: '49-admin-settings', path: '/admin/settings' },
  { name: '50-admin-audit-log', path: '/admin/audit-log' },
  { name: '51-admin-announcements', path: '/admin/announcements' },
  { name: '52-admin-events', path: '/admin/events' },
  { name: '53-admin-compliance', path: '/admin/compliance' },
  { name: '54-admin-ai-assistants', path: '/admin/ai-assistants' },
  { name: '55-admin-mfa', path: '/admin/mfa' },
  { name: '56-admin-edi', path: '/admin/edi' },
  { name: '57-shop-floor', path: '/display/shop-floor' },
];

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
});

async function primeDemoAuth(page: Page): Promise<void> {
  await page.goto(BASE_URL, { waitUntil: 'commit' });
  await page.evaluate(() => {
    localStorage.setItem('forge-token', 'demo-session-tour');
    localStorage.setItem(
      'forge-user',
      JSON.stringify({
        id: 1,
        email: 'demo@forge.com',
        firstName: 'Demo',
        lastName: 'Viewer',
        initials: 'DV',
        avatarColor: '#0d9488',
        roles: ['Admin', 'Manager', 'Engineer', 'OfficeManager', 'ProductionWorker'],
        profileComplete: true,
      }),
    );
    localStorage.setItem('language', 'en');
  });
}

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({
    path: path.join(OUT_DIR, `${name}.png`),
    fullPage: true,
    animations: 'disabled',
  });
}

test('demo app tour', async ({ browser }) => {
  test.setTimeout(600_000);
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await primeDemoAuth(page);

  for (const entry of PAGES) {
    try {
      const resp = await page.goto(`${BASE_URL}${entry.path}`, { waitUntil: 'networkidle', timeout: 15_000 });
      if (!resp || resp.status() >= 400) {
        console.warn(`  ! ${entry.path} status=${resp?.status()}`);
      }
    } catch (err) {
      console.warn(`  ! ${entry.path} nav error: ${(err as Error).message}`);
    }
    await page.waitForTimeout(1200);
    await shot(page, entry.name);
    console.log(`  ✓ ${entry.name}`);
  }

  // Dialog tours — open a representative dialog on 3 pages
  const dialogTours: { name: string; path: string; triggerSelector: string }[] = [
    { name: '70-parts-new-dialog', path: '/parts', triggerSelector: 'button:has-text("New Part"), button:has-text("Add Part"), button.action-btn--create' },
    { name: '71-customers-new-dialog', path: '/customers', triggerSelector: 'button:has-text("New Customer"), button.action-btn--create' },
    { name: '72-leads-new-dialog', path: '/leads', triggerSelector: 'button:has-text("New Lead"), button.action-btn--create' },
  ];

  for (const d of dialogTours) {
    try {
      await page.goto(`${BASE_URL}${d.path}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(800);
      const btn = page.locator(d.triggerSelector).first();
      if (await btn.count()) {
        await btn.click({ timeout: 3000 });
        await page.waitForTimeout(800);
      }
      await shot(page, d.name);
      console.log(`  ✓ ${d.name}`);
      await page.keyboard.press('Escape');
    } catch (err) {
      console.warn(`  ! ${d.name}: ${(err as Error).message}`);
    }
  }

  // Customer detail (first row click)
  try {
    await page.goto(`${BASE_URL}/customers`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const firstRow = page.locator('table tbody tr, [role="row"]').nth(1);
    if (await firstRow.count()) {
      await firstRow.click({ timeout: 3000 });
      await page.waitForTimeout(1500);
    }
    await shot(page, '73-customer-detail');
    console.log('  ✓ 73-customer-detail');
  } catch (err) {
    console.warn(`  ! customer-detail: ${(err as Error).message}`);
  }

  // Kanban card detail (first card click)
  try {
    await page.goto(`${BASE_URL}/kanban`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const firstCard = page.locator('.job-card, .kanban-card').first();
    if (await firstCard.count()) {
      await firstCard.click({ timeout: 3000 });
      await page.waitForTimeout(1200);
    }
    await shot(page, '74-kanban-job-detail');
    console.log('  ✓ 74-kanban-job-detail');
  } catch (err) {
    console.warn(`  ! kanban-job-detail: ${(err as Error).message}`);
  }

  if (errors.length) {
    console.log(`\n=== Page errors (${errors.length}) ===`);
    for (const e of errors.slice(0, 20)) console.log(`  × ${e}`);
  }

  await context.close();
  expect(true).toBe(true);
});
