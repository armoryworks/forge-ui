/**
 * Comprehensive UI audit tool.
 *
 * Captures screenshots of every page + every create dialog, in both light
 * and dark themes. Also captures console errors and failed network requests
 * per page.
 *
 * Usage:
 *   npx ts-node e2e/stress/audit-screenshots.ts [runId]
 */

import { chromium, request as pwRequest, Page, ConsoleMessage } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { clearAllDrafts, dismissDraftRecoveryPrompt, clearOverlayBackdrops } from '../lib/form.lib';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:4200';
const API_URL = process.env.E2E_API_URL || 'http://localhost:5000';
const PASSWORD = process.env.SEED_USER_PASSWORD || 'Test1234!';

// ── Pages to screenshot ──

const PAGES: { name: string; path: string; waitMs?: number }[] = [
  { name: 'dashboard', path: '/dashboard', waitMs: 3000 },
  { name: 'kanban', path: '/kanban', waitMs: 3000 },
  { name: 'backlog', path: '/backlog', waitMs: 2000 },
  { name: 'calendar', path: '/calendar', waitMs: 2000 },
  { name: 'parts', path: '/parts', waitMs: 2000 },
  { name: 'inventory-stock', path: '/inventory/stock', waitMs: 2000 },
  { name: 'inventory-receiving', path: '/inventory/receiving', waitMs: 2000 },
  { name: 'inventory-locations', path: '/inventory/locations', waitMs: 2000 },
  { name: 'customers', path: '/customers', waitMs: 2000 },
  { name: 'leads', path: '/leads', waitMs: 2000 },
  { name: 'expenses', path: '/expenses', waitMs: 2000 },
  { name: 'assets', path: '/assets', waitMs: 2000 },
  { name: 'time-tracking', path: '/time-tracking', waitMs: 2000 },
  { name: 'vendors', path: '/vendors', waitMs: 2000 },
  { name: 'purchase-orders', path: '/purchase-orders', waitMs: 2000 },
  { name: 'sales-orders', path: '/sales-orders', waitMs: 2000 },
  { name: 'quotes', path: '/quotes', waitMs: 2000 },
  { name: 'shipments', path: '/shipments', waitMs: 2000 },
  { name: 'invoices', path: '/invoices', waitMs: 2000 },
  { name: 'payments', path: '/payments', waitMs: 2000 },
  { name: 'customer-returns', path: '/customer-returns', waitMs: 2000 },
  { name: 'quality-inspections', path: '/quality/inspections', waitMs: 2000 },
  { name: 'quality-lots', path: '/quality/lots', waitMs: 2000 },
  { name: 'reports', path: '/reports', waitMs: 2000 },
  { name: 'planning', path: '/planning', waitMs: 2000 },
  { name: 'training', path: '/training', waitMs: 2000 },
  { name: 'chat', path: '/chat', waitMs: 2000 },
  { name: 'notifications', path: '/notifications', waitMs: 2000 },
  { name: 'admin-users', path: '/admin/users', waitMs: 2000 },
  { name: 'admin-settings', path: '/admin/settings', waitMs: 2000 },
  { name: 'admin-integrations', path: '/admin/integrations', waitMs: 2000 },
  { name: 'admin-compliance', path: '/admin/compliance', waitMs: 2000 },
  { name: 'admin-events', path: '/admin/events', waitMs: 2000 },
  { name: 'admin-edi', path: '/admin/edi', waitMs: 2000 },
  { name: 'admin-time-corrections', path: '/admin/time-corrections', waitMs: 2000 },
  { name: 'admin-scheduled-tasks', path: '/admin/scheduled-tasks', waitMs: 2000 },
  { name: 'admin-ai-assistants', path: '/admin/ai-assistants', waitMs: 2000 },
  { name: 'admin-mfa', path: '/admin/mfa', waitMs: 2000 },
  { name: 'account-profile', path: '/account/profile', waitMs: 2000 },
  { name: 'account-security', path: '/account/security', waitMs: 2000 },
  { name: 'purchasing', path: '/purchasing', waitMs: 2000 },
];

// ── Dialogs to open and screenshot ──

interface DialogDef {
  name: string;
  /** Page to navigate to first */
  pagePath: string;
  /** data-testid of the "New X" button */
  triggerTestId: string;
  /** Wait time after click for dialog to render */
  waitMs?: number;
}

const DIALOGS: DialogDef[] = [
  { name: 'dialog-new-job', pagePath: '/kanban', triggerTestId: 'new-job-btn', waitMs: 1500 },
  { name: 'dialog-new-part', pagePath: '/parts', triggerTestId: 'new-part-btn', waitMs: 1500 },
  { name: 'dialog-new-customer', pagePath: '/customers', triggerTestId: 'new-customer-btn', waitMs: 1500 },
  { name: 'dialog-new-vendor', pagePath: '/vendors', triggerTestId: 'new-vendor-btn', waitMs: 1500 },
  { name: 'dialog-new-lead', pagePath: '/leads', triggerTestId: 'new-lead-btn', waitMs: 1500 },
  { name: 'dialog-new-expense', pagePath: '/expenses', triggerTestId: 'new-expense-btn', waitMs: 1500 },
  { name: 'dialog-new-asset', pagePath: '/assets', triggerTestId: 'new-asset-btn', waitMs: 1500 },
  { name: 'dialog-new-po', pagePath: '/purchase-orders', triggerTestId: 'new-po-btn', waitMs: 1500 },
  { name: 'dialog-new-so', pagePath: '/sales-orders', triggerTestId: 'new-so-btn', waitMs: 1500 },
  { name: 'dialog-new-quote', pagePath: '/quotes', triggerTestId: 'new-quote-btn', waitMs: 1500 },
  { name: 'dialog-new-shipment', pagePath: '/shipments', triggerTestId: 'new-shipment-btn', waitMs: 1500 },
  { name: 'dialog-new-invoice', pagePath: '/invoices', triggerTestId: 'new-invoice-btn', waitMs: 1500 },
  { name: 'dialog-new-payment', pagePath: '/payments', triggerTestId: 'new-payment-btn', waitMs: 1500 },
  { name: 'dialog-new-return', pagePath: '/customer-returns', triggerTestId: 'new-return-btn', waitMs: 1500 },
  { name: 'dialog-new-lot', pagePath: '/quality/lots', triggerTestId: 'new-lot-btn', waitMs: 1500 },
  { name: 'dialog-new-rfq', pagePath: '/purchasing', triggerTestId: 'new-rfq-btn', waitMs: 1500 },
  { name: 'dialog-new-event', pagePath: '/admin/events', triggerTestId: 'new-event-btn', waitMs: 1500 },
  { name: 'dialog-new-gage', pagePath: '/quality/gages', triggerTestId: 'new-gage-btn', waitMs: 1500 },
];

// ── Types ──

interface PageResult {
  name: string;
  theme: 'light' | 'dark';
  status: 'ok' | 'error';
  screenshotFile?: string;
  consoleErrors: string[];
  networkFailures: string[];
  errorMessage?: string;
}

// ── Helpers ──

function collectConsoleErrors(page: Page): { errors: string[]; stop: () => void } {
  const errors: string[] = [];
  const handler = (msg: ConsoleMessage) => {
    if (msg.type() === 'error') {
      errors.push(msg.text().slice(0, 300));
    }
  };
  page.on('console', handler);
  return {
    errors,
    stop: () => page.off('console', handler),
  };
}

function collectNetworkFailures(page: Page): { failures: string[]; stop: () => void } {
  const failures: string[] = [];
  const handler = (response: { status: () => number; url: () => string }) => {
    const status = response.status();
    if (status >= 400) {
      const url = response.url();
      // Skip known noise (favicon, source maps)
      if (url.includes('.map') || url.includes('favicon')) return;
      failures.push(`${status} ${url.slice(0, 200)}`);
    }
  };
  page.on('response', handler);
  return {
    failures,
    stop: () => page.off('response', handler),
  };
}

async function capturePage(
  page: Page,
  name: string,
  url: string,
  outDir: string,
  theme: 'light' | 'dark',
  waitMs: number,
): Promise<PageResult> {
  const collector = collectConsoleErrors(page);
  const netCollector = collectNetworkFailures(page);

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(waitMs);

    await dismissDraftRecoveryPrompt(page).catch(() => {});
    await clearOverlayBackdrops(page).catch(() => {});
    await page.waitForTimeout(500);

    const fileName = `${name}--${theme}.png`;
    const filePath = path.join(outDir, fileName);
    await page.screenshot({ path: filePath, fullPage: false });

    collector.stop();
    netCollector.stop();

    return {
      name,
      theme,
      status: 'ok',
      screenshotFile: fileName,
      consoleErrors: [...collector.errors],
      networkFailures: [...netCollector.failures],
    };
  } catch (err) {
    collector.stop();
    netCollector.stop();
    const msg = err instanceof Error ? err.message : String(err);
    return {
      name,
      theme,
      status: 'error',
      consoleErrors: [...collector.errors],
      networkFailures: [...netCollector.failures],
      errorMessage: msg.slice(0, 200),
    };
  }
}

async function captureDialog(
  page: Page,
  dialog: DialogDef,
  outDir: string,
  theme: 'light' | 'dark',
): Promise<PageResult> {
  const collector = collectConsoleErrors(page);
  const netCollector = collectNetworkFailures(page);

  try {
    // Navigate to the page
    await page.goto(`${BASE_URL}${dialog.pagePath}`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);
    await dismissDraftRecoveryPrompt(page).catch(() => {});
    await clearOverlayBackdrops(page).catch(() => {});

    // Click the create button
    const btn = page.locator(`[data-testid="${dialog.triggerTestId}"]`);
    const visible = await btn.isVisible({ timeout: 3000 }).catch(() => false);
    if (!visible) {
      collector.stop();
      netCollector.stop();
      return {
        name: dialog.name,
        theme,
        status: 'error',
        consoleErrors: [...collector.errors],
        networkFailures: [...netCollector.failures],
        errorMessage: `Button [data-testid="${dialog.triggerTestId}"] not found`,
      };
    }

    await btn.click({ timeout: 3000 });
    await page.waitForTimeout(dialog.waitMs ?? 1500);

    const fileName = `${dialog.name}--${theme}.png`;
    const filePath = path.join(outDir, fileName);
    await page.screenshot({ path: filePath, fullPage: false });

    // Close the dialog
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    // If there's a dirty form confirmation, dismiss it
    const confirmDiscard = page.getByRole('button', { name: /discard|cancel|no/i }).first();
    if (await confirmDiscard.isVisible({ timeout: 500 }).catch(() => false)) {
      await confirmDiscard.click({ force: true });
      await page.waitForTimeout(300);
    }

    collector.stop();
    netCollector.stop();

    return {
      name: dialog.name,
      theme,
      status: 'ok',
      screenshotFile: fileName,
      consoleErrors: [...collector.errors],
      networkFailures: [...netCollector.failures],
    };
  } catch (err) {
    collector.stop();
    netCollector.stop();
    // Try to close any open dialog
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);
    const msg = err instanceof Error ? err.message : String(err);
    return {
      name: dialog.name,
      theme,
      status: 'error',
      consoleErrors: [...collector.errors],
      networkFailures: [...netCollector.failures],
      errorMessage: msg.slice(0, 200),
    };
  }
}

// ── Main ──

async function main(): Promise<void> {
  const runId = process.argv[2] || `audit-${Date.now()}`;
  const outDir = path.join(__dirname, 'screenshots', runId);
  fs.mkdirSync(outDir, { recursive: true });

  const totalItems = (PAGES.length + DIALOGS.length) * 2; // x2 for light + dark
  console.log(`\nUI Audit — Run: ${runId}`);
  console.log(`Pages: ${PAGES.length} | Dialogs: ${DIALOGS.length} | Themes: 2`);
  console.log(`Total screenshots: ${totalItems}`);
  console.log(`Output: ${outDir}\n`);

  // Login via API
  const apiContext = await pwRequest.newContext({ baseURL: `${API_URL}/api/v1/` });
  let loginData: { token: string; user: unknown };
  try {
    const response = await apiContext.post('auth/login', {
      data: { email: 'admin@qbengineer.local', password: PASSWORD },
    });
    if (!response.ok()) {
      console.error(`Login failed: ${response.status()}`);
      process.exit(1);
    }
    loginData = await response.json();
  } finally {
    await apiContext.dispose();
  }

  // Launch browser
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  // Seed auth
  await page.goto(BASE_URL, { waitUntil: 'commit' });
  await page.evaluate(
    ({ token, user }) => {
      localStorage.setItem('qbe-token', token);
      localStorage.setItem('qbe-user', JSON.stringify(user));
      localStorage.setItem('language', 'en');
    },
    { token: loginData.token, user: loginData.user },
  );
  await clearAllDrafts(page).catch(() => {});

  const allResults: PageResult[] = [];
  let completed = 0;

  // ── Pass 1: Light theme ──
  console.log('── LIGHT THEME ──');
  await page.evaluate(() => {
    localStorage.setItem('themeMode', 'light');
    document.documentElement.setAttribute('data-theme', 'light');
  });

  // Pages
  for (const pg of PAGES) {
    const result = await capturePage(page, pg.name, `${BASE_URL}${pg.path}`, outDir, 'light', pg.waitMs ?? 2000);
    allResults.push(result);
    completed++;
    const errInfo = result.consoleErrors.length > 0 ? ` [${result.consoleErrors.length} console errors]` : '';
    const netInfo = result.networkFailures.length > 0 ? ` [${result.networkFailures.length} network failures]` : '';
    const icon = result.status === 'ok' ? '✓' : '✗';
    console.log(`  ${icon} [${completed}/${totalItems}] ${result.name}${errInfo}${netInfo}`);
  }

  // Dialogs
  for (const dlg of DIALOGS) {
    const result = await captureDialog(page, dlg, outDir, 'light');
    allResults.push(result);
    completed++;
    const icon = result.status === 'ok' ? '✓' : '✗';
    const errInfo = result.consoleErrors.length > 0 ? ` [${result.consoleErrors.length} console errors]` : '';
    console.log(`  ${icon} [${completed}/${totalItems}] ${result.name}${errInfo}`);
  }

  // ── Pass 2: Dark theme ──
  console.log('\n── DARK THEME ──');
  await page.evaluate(() => {
    localStorage.setItem('themeMode', 'dark');
    document.documentElement.setAttribute('data-theme', 'dark');
  });
  // Reload to apply theme fully
  await page.goto(BASE_URL, { waitUntil: 'commit' });
  await page.evaluate(
    ({ token, user }) => {
      localStorage.setItem('qbe-token', token);
      localStorage.setItem('qbe-user', JSON.stringify(user));
      localStorage.setItem('language', 'en');
      localStorage.setItem('themeMode', 'dark');
    },
    { token: loginData.token, user: loginData.user },
  );
  await clearAllDrafts(page).catch(() => {});
  await page.waitForTimeout(500);

  // Pages
  for (const pg of PAGES) {
    const result = await capturePage(page, pg.name, `${BASE_URL}${pg.path}`, outDir, 'dark', pg.waitMs ?? 2000);
    allResults.push(result);
    completed++;
    const errInfo = result.consoleErrors.length > 0 ? ` [${result.consoleErrors.length} console errors]` : '';
    const netInfo = result.networkFailures.length > 0 ? ` [${result.networkFailures.length} network failures]` : '';
    const icon = result.status === 'ok' ? '✓' : '✗';
    console.log(`  ${icon} [${completed}/${totalItems}] ${result.name}${errInfo}${netInfo}`);
  }

  // Dialogs
  for (const dlg of DIALOGS) {
    const result = await captureDialog(page, dlg, outDir, 'dark');
    allResults.push(result);
    completed++;
    const icon = result.status === 'ok' ? '✓' : '✗';
    const errInfo = result.consoleErrors.length > 0 ? ` [${result.consoleErrors.length} console errors]` : '';
    console.log(`  ${icon} [${completed}/${totalItems}] ${result.name}${errInfo}`);
  }

  await context.close();
  await browser.close();

  // ── Generate report ──
  const ok = allResults.filter(r => r.status === 'ok').length;
  const failed = allResults.length - ok;
  const withConsoleErrors = allResults.filter(r => r.consoleErrors.length > 0);
  const withNetworkFailures = allResults.filter(r => r.networkFailures.length > 0);

  // Deduplicate console errors across pages
  const uniqueConsoleErrors = new Map<string, string[]>();
  for (const r of withConsoleErrors) {
    for (const err of r.consoleErrors) {
      const key = err.slice(0, 100);
      if (!uniqueConsoleErrors.has(key)) {
        uniqueConsoleErrors.set(key, []);
      }
      uniqueConsoleErrors.get(key)!.push(r.name);
    }
  }

  // Deduplicate network failures
  const uniqueNetworkFailures = new Map<string, string[]>();
  for (const r of withNetworkFailures) {
    for (const fail of r.networkFailures) {
      const key = fail.slice(0, 150);
      if (!uniqueNetworkFailures.has(key)) {
        uniqueNetworkFailures.set(key, []);
      }
      uniqueNetworkFailures.get(key)!.push(r.name);
    }
  }

  // Save full manifest
  const manifest = {
    runId,
    capturedAt: new Date().toISOString(),
    summary: {
      totalScreenshots: allResults.length,
      successful: ok,
      failed,
      pagesWithConsoleErrors: withConsoleErrors.length,
      pagesWithNetworkFailures: withNetworkFailures.length,
      uniqueConsoleErrors: uniqueConsoleErrors.size,
      uniqueNetworkFailures: uniqueNetworkFailures.size,
    },
    consoleErrors: Object.fromEntries(uniqueConsoleErrors),
    networkFailures: Object.fromEntries(uniqueNetworkFailures),
    results: allResults,
  };
  const manifestPath = path.join(outDir, 'audit-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  // Print summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  UI AUDIT COMPLETE`);
  console.log(`${'='.repeat(60)}`);
  console.log(`  Screenshots: ${ok} ok, ${failed} failed`);
  console.log(`  Console errors: ${uniqueConsoleErrors.size} unique across ${withConsoleErrors.length} pages`);
  console.log(`  Network failures: ${uniqueNetworkFailures.size} unique across ${withNetworkFailures.length} pages`);

  if (uniqueConsoleErrors.size > 0) {
    console.log(`\n  Top console errors:`);
    let i = 0;
    for (const [err, pages] of uniqueConsoleErrors) {
      if (i++ >= 10) break;
      console.log(`    [${pages.length} pages] ${err.slice(0, 80)}`);
    }
  }

  if (uniqueNetworkFailures.size > 0) {
    console.log(`\n  Network failures:`);
    for (const [fail, pages] of uniqueNetworkFailures) {
      console.log(`    [${pages.length} pages] ${fail.slice(0, 100)}`);
    }
  }

  console.log(`\n  Manifest: ${manifestPath}`);
  console.log(`  Screenshots: ${outDir}/`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
