/**
 * Post-stress-test screenshot capture.
 *
 * Logs in as admin and captures a 1920x1080 screenshot of every major page
 * in the app. Screenshots are saved to e2e/stress/screenshots/{run}/{page}.png.
 *
 * Usage:
 *   npx ts-node e2e/stress/capture-screenshots.ts [runId]
 */

import { chromium, request as pwRequest } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { clearAllDrafts, dismissDraftRecoveryPrompt, clearOverlayBackdrops } from '../lib/form.lib';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:4200';
const API_URL = process.env.E2E_API_URL || 'http://localhost:5000';
const PASSWORD = process.env.SEED_USER_PASSWORD || 'Test1234!';

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
];

async function main(): Promise<void> {
  const runId = process.argv[2] || `run-${Date.now()}`;
  const outDir = path.join(__dirname, 'screenshots', runId);
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`Capturing screenshots for run: ${runId}`);
  console.log(`Output: ${outDir}`);
  console.log(`Pages: ${PAGES.length}\n`);

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

  // Clear drafts to prevent blocking dialogs
  await clearAllDrafts(page).catch(() => {});

  const results: { page: string; status: string; file?: string }[] = [];

  for (const pg of PAGES) {
    try {
      await page.goto(`${BASE_URL}${pg.path}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(pg.waitMs ?? 2000);

      // Dismiss any blocking overlays or draft recovery prompts
      await dismissDraftRecoveryPrompt(page).catch(() => {});
      await clearOverlayBackdrops(page).catch(() => {});
      await page.waitForTimeout(500);

      const filePath = path.join(outDir, `${pg.name}.png`);
      await page.screenshot({ path: filePath, fullPage: false }); // viewport only, 1080p
      results.push({ page: pg.name, status: 'ok', file: filePath });
      console.log(`  ✓ ${pg.name}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ page: pg.name, status: `error: ${msg.slice(0, 100)}` });
      console.log(`  ✗ ${pg.name}: ${msg.slice(0, 80)}`);
    }
  }

  await context.close();
  await browser.close();

  // Save results manifest
  const manifestPath = path.join(outDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify({ runId, capturedAt: new Date().toISOString(), results }, null, 2));

  const ok = results.filter(r => r.status === 'ok').length;
  const failed = results.length - ok;
  console.log(`\nDone: ${ok} captured, ${failed} failed`);
  console.log(`Manifest: ${manifestPath}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
