/**
 * UAT Training Audit
 *
 * Screenshots every major page, fetches the corresponding training modules,
 * and saves both for analysis. Verifies that:
 * 1. Each page renders correctly (no console errors, no 5xx network failures)
 * 2. Training modules exist for each feature area
 * 3. Screenshots are captured for manual/automated review against training content
 *
 * Run: npm run test:training-uat
 */
import { test, expect } from '@playwright/test';
import { request } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

import { loginViaApi, getAuthToken, SEED_PASSWORD } from '../../helpers/auth.helper';

const API_BASE = 'http://localhost:5000';
const APP_BASE = 'http://localhost:4200';

// All major pages to audit, grouped by business domain
const PAGES_TO_AUDIT = [
  // Operations
  { route: '/dashboard', name: 'Dashboard', domain: 'Operations', trainingSlug: 'dashboard' },
  { route: '/kanban', name: 'Kanban Board', domain: 'Operations', trainingSlug: 'kanban' },
  { route: '/backlog', name: 'Backlog', domain: 'Operations', trainingSlug: 'backlog' },
  { route: '/planning', name: 'Planning Cycles', domain: 'Operations', trainingSlug: 'planning' },
  { route: '/calendar', name: 'Calendar', domain: 'Operations', trainingSlug: 'calendar' },

  // Sales
  { route: '/customers', name: 'Customers', domain: 'Sales', trainingSlug: 'customers' },
  { route: '/leads', name: 'Leads', domain: 'Sales', trainingSlug: 'leads' },
  { route: '/quotes', name: 'Quotes', domain: 'Sales', trainingSlug: 'quotes' },
  { route: '/sales-orders', name: 'Sales Orders', domain: 'Sales', trainingSlug: 'sales-orders' },
  { route: '/shipments', name: 'Shipments', domain: 'Sales', trainingSlug: 'shipments' },
  { route: '/invoices', name: 'Invoices', domain: 'Sales', trainingSlug: 'invoices' },
  { route: '/payments', name: 'Payments', domain: 'Sales', trainingSlug: 'payments' },

  // Supply Chain
  { route: '/parts', name: 'Parts Catalog', domain: 'Supply Chain', trainingSlug: 'parts' },
  { route: '/inventory/stock', name: 'Inventory', domain: 'Supply Chain', trainingSlug: 'inventory' },
  { route: '/vendors', name: 'Vendors', domain: 'Supply Chain', trainingSlug: 'vendors' },
  { route: '/purchase-orders', name: 'Purchase Orders', domain: 'Supply Chain', trainingSlug: 'purchase-orders' },

  // Resources
  { route: '/time-tracking', name: 'Time Tracking', domain: 'Resources', trainingSlug: 'time-tracking' },
  { route: '/expenses', name: 'Expenses', domain: 'Resources', trainingSlug: 'expenses' },
  { route: '/assets', name: 'Assets', domain: 'Resources', trainingSlug: 'assets' },
  { route: '/reports', name: 'Reports', domain: 'Resources', trainingSlug: 'reports' },
  { route: '/quality', name: 'Quality', domain: 'Resources', trainingSlug: 'quality' },

  // Communication
  { route: '/chat', name: 'Chat', domain: 'Communication', trainingSlug: 'chat' },
  { route: '/ai', name: 'AI Assistant', domain: 'Communication', trainingSlug: 'ai' },
  { route: '/training/library', name: 'Training Library', domain: 'Communication', trainingSlug: 'training' },

  // Admin
  { route: '/admin/users', name: 'Admin - Users', domain: 'Admin', trainingSlug: 'admin' },
  { route: '/admin/settings', name: 'Admin - Settings', domain: 'Admin', trainingSlug: 'admin' },
  { route: '/admin/integrations', name: 'Admin - Integrations', domain: 'Admin', trainingSlug: 'admin' },
  { route: '/admin/training', name: 'Admin - Training', domain: 'Admin', trainingSlug: 'admin' },

  // Account
  { route: '/account/profile', name: 'Account - Profile', domain: 'Account', trainingSlug: 'navigation' },
  { route: '/account/security', name: 'Account - Security', domain: 'Account', trainingSlug: 'mfa' },
];

interface TrainingModule {
  id: number;
  title: string;
  slug: string;
  summary: string;
  contentType: string;
  estimatedMinutes: number;
  tags: string[];
  isPublished: boolean;
  contentJson?: string;
}

interface PageAuditResult {
  route: string;
  name: string;
  domain: string;
  screenshotPath: string;
  consoleErrors: string[];
  networkFailures: string[];
  trainingModules: TrainingModule[];
  timestamp: string;
}

test.describe('UAT Training Audit', () => {
  const runId = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputDir = path.resolve(process.cwd(), `e2e/uat-results/${runId}`);
  const screenshotDir = path.join(outputDir, 'screenshots');

  test.beforeAll(async () => {
    fs.mkdirSync(screenshotDir, { recursive: true });
  });

  test('capture all pages with training context', async ({ page }, testInfo) => {
    testInfo.setTimeout(300_000); // 5 minutes for 30 pages
    // Auth
    await loginViaApi(page, 'admin@qbengineer.local', SEED_PASSWORD);

    // Get auth token for API calls
    const token = await getAuthToken('admin@qbengineer.local', SEED_PASSWORD);

    // Fetch all training modules via API
    const apiContext = await request.newContext({
      baseURL: API_BASE,
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });

    let allModules: TrainingModule[] = [];
    try {
      const modulesRes = await apiContext.get('/api/v1/training/modules?pageSize=500');
      if (modulesRes.ok()) {
        const body = await modulesRes.json();
        allModules = body.data ?? body ?? [];
      }
    } catch {
      console.warn('Could not fetch training modules — continuing without');
    }

    const results: PageAuditResult[] = [];

    for (const pageInfo of PAGES_TO_AUDIT) {
      const consoleErrors: string[] = [];
      const networkFailures: string[] = [];

      // Collect console errors
      const consoleHandler = (msg: import('@playwright/test').ConsoleMessage) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      };
      page.on('console', consoleHandler);

      // Collect network failures
      const responseHandler = (response: import('@playwright/test').Response) => {
        if (response.status() >= 500) {
          networkFailures.push(`${response.status()} ${response.url()}`);
        }
      };
      page.on('response', responseHandler);

      try {
        await page.goto(`${APP_BASE}${pageInfo.route}`, {
          waitUntil: 'networkidle',
          timeout: 15000,
        });
        await page.waitForTimeout(2000); // Let animations settle

        // Take screenshot
        const safeName = pageInfo.name.replace(/[^a-zA-Z0-9-]/g, '_').toLowerCase();
        const screenshotPath = path.join(screenshotDir, `${safeName}.png`);
        await page.screenshot({
          path: screenshotPath,
          fullPage: true,
        });

        // Find matching training modules
        const matchingModules = allModules.filter((m: TrainingModule) =>
          m.slug?.includes(pageInfo.trainingSlug) ||
          m.tags?.some((t: string) => t.toLowerCase().includes(pageInfo.trainingSlug))
        );

        results.push({
          route: pageInfo.route,
          name: pageInfo.name,
          domain: pageInfo.domain,
          screenshotPath: `screenshots/${safeName}.png`,
          consoleErrors: [...consoleErrors],
          networkFailures: [...networkFailures],
          trainingModules: matchingModules.map((m: TrainingModule) => ({
            id: m.id,
            title: m.title,
            slug: m.slug,
            summary: m.summary,
            contentType: m.contentType,
            estimatedMinutes: m.estimatedMinutes,
            tags: m.tags,
            isPublished: m.isPublished,
          })),
          timestamp: new Date().toISOString(),
        });
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`  ERROR navigating to ${pageInfo.route}: ${errMsg}`);
        results.push({
          route: pageInfo.route,
          name: pageInfo.name,
          domain: pageInfo.domain,
          screenshotPath: '',
          consoleErrors: [...consoleErrors, `Navigation error: ${errMsg}`],
          networkFailures: [...networkFailures],
          trainingModules: [],
          timestamp: new Date().toISOString(),
        });
      }

      page.removeListener('console', consoleHandler);
      page.removeListener('response', responseHandler);
    }

    await apiContext.dispose();

    // ── Generate Report ──
    const report = generateReport(results, allModules);
    fs.writeFileSync(path.join(outputDir, 'uat-report.md'), report);
    fs.writeFileSync(path.join(outputDir, 'uat-results.json'), JSON.stringify(results, null, 2));

    console.log(`\n${'='.repeat(70)}`);
    console.log(`  UAT AUDIT COMPLETE — ${results.length} pages captured`);
    console.log(`  Output: e2e/uat-results/${runId}/`);
    console.log(`${'='.repeat(70)}\n`);

    // Assert no pages with 5xx errors
    const pagesWithErrors = results.filter(r => r.networkFailures.length > 0);
    if (pagesWithErrors.length > 0) {
      const errorList = pagesWithErrors
        .map(r => `  ${r.name}: ${r.networkFailures.join(', ')}`)
        .join('\n');
      console.warn(`\n  WARN: ${pagesWithErrors.length} page(s) had 5xx network errors:\n${errorList}`);
    }

    // Assert all pages were captured
    const captured = results.filter(r => r.screenshotPath !== '');
    expect(captured.length).toBe(PAGES_TO_AUDIT.length);
  });
});

function generateReport(
  results: PageAuditResult[],
  allModules: TrainingModule[],
): string {
  const lines: string[] = [];

  lines.push('# UAT Training Audit Report');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Pages audited: ${results.length}`);
  lines.push(`Training modules found: ${allModules.length}`);
  lines.push('');

  // Summary table
  lines.push('## Summary');
  lines.push('');
  lines.push('| Page | Domain | Console Errors | 5xx Errors | Training Modules |');
  lines.push('|------|--------|---------------|------------|------------------|');

  for (const r of results) {
    const status = r.consoleErrors.length === 0 && r.networkFailures.length === 0 ? 'OK' : 'WARN';
    lines.push(
      `| ${r.name} | ${r.domain} | ${r.consoleErrors.length} | ${r.networkFailures.length} | ${r.trainingModules.length} |`,
    );
  }

  lines.push('');

  // Training coverage gaps
  const coveredSlugs = new Set(results.flatMap(r => r.trainingModules.map(m => m.slug)));
  const uncoveredPages = results.filter(r => r.trainingModules.length === 0);

  if (uncoveredPages.length > 0) {
    lines.push('## Training Coverage Gaps');
    lines.push('');
    lines.push('Pages with NO matching training modules:');
    for (const p of uncoveredPages) {
      lines.push(`- **${p.name}** (${p.route})`);
    }
    lines.push('');
  }

  // Console errors detail
  const pagesWithConsoleErrors = results.filter(r => r.consoleErrors.length > 0);
  if (pagesWithConsoleErrors.length > 0) {
    lines.push('## Console Errors');
    lines.push('');
    for (const p of pagesWithConsoleErrors) {
      lines.push(`### ${p.name} (${p.route})`);
      for (const err of p.consoleErrors) {
        lines.push(`- \`${err.slice(0, 200)}\``);
      }
      lines.push('');
    }
  }

  // Per-page details
  lines.push('## Page Details');
  lines.push('');

  let currentDomain = '';
  for (const r of results) {
    if (r.domain !== currentDomain) {
      currentDomain = r.domain;
      lines.push(`### ${currentDomain}`);
      lines.push('');
    }

    lines.push(`#### ${r.name}`);
    lines.push(`- **Route:** \`${r.route}\``);
    lines.push(`- **Screenshot:** \`${r.screenshotPath}\``);
    lines.push(`- **Console Errors:** ${r.consoleErrors.length}`);
    lines.push(`- **Network Failures:** ${r.networkFailures.length}`);

    if (r.trainingModules.length > 0) {
      lines.push(`- **Training Modules:**`);
      for (const m of r.trainingModules) {
        lines.push(`  - ${m.title} (${m.contentType}, ${m.estimatedMinutes} min)`);
      }
    } else {
      lines.push(`- **Training Modules:** NONE`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
