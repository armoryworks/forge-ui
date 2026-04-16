/**
 * Walkthrough Selector Verification Script
 *
 * Extracts all walkthrough module selectors from the API,
 * navigates to each route, and checks whether the CSS selector
 * targets a visible element on the page.
 *
 * Usage:
 *   npx tsx e2e/training-verification/check-selectors.ts
 */

import { chromium, type Page } from 'playwright';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000/api/v1/';
const APP_BASE = process.env.APP_BASE_URL || 'http://localhost:4200';
const SEED_PASSWORD = process.env.SEED_USER_PASSWORD || 'Test1234!';
const ADMIN_EMAIL = 'admin@qbengineer.local';

interface WalkthroughStep {
  element: string;
  popover: { title: string; description: string; side: string };
}

interface WalkthroughContent {
  appRoute: string;
  startButtonLabel: string;
  steps: WalkthroughStep[];
}

interface TrainingModuleListItem {
  id: number;
  title: string;
  slug: string;
  contentType: string;
}

interface TrainingModuleDetail {
  id: number;
  title: string;
  slug: string;
  contentType: string;
  contentJson: string;
  appRoutes: string[];
}

interface SelectorResult {
  moduleSlug: string;
  moduleTitle: string;
  route: string;
  stepIndex: number;
  stepTitle: string;
  selector: string;
  found: boolean;
  visible: boolean;
  boundingBox: { x: number; y: number; width: number; height: number } | null;
  tagName: string;
  textSnippet: string;
}

async function login(page: Page): Promise<string> {
  const response = await fetch(`${API_BASE}auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: SEED_PASSWORD }),
  });

  if (!response.ok) throw new Error(`Login failed: ${response.status}`);
  const data = await response.json() as { token: string; user: Record<string, unknown> };

  // Navigate to app and set auth before Angular bootstraps
  await page.goto(APP_BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate((loginData) => {
    localStorage.setItem('qbe-token', loginData.token);
    localStorage.setItem('qbe-user', JSON.stringify(loginData.user));
  }, data);

  // Reload so Angular bootstraps with auth already in localStorage
  await page.reload({ waitUntil: 'networkidle' });

  // Wait for Angular to fully bootstrap (sidebar renders = app is ready)
  try {
    await page.waitForSelector('.sidebar, .app-header, app-root', { timeout: 10000 });
    console.log('  Angular bootstrapped successfully');
  } catch {
    console.log('  WARNING: Angular may not have fully bootstrapped');
  }

  // Check we're not on login page
  const url = page.url();
  if (url.includes('/login') || url.includes('/setup')) {
    throw new Error(`Auth failed — redirected to ${url}`);
  }
  console.log(`  Authenticated. Current URL: ${url}`);

  return data.token;
}

async function fetchWalkthroughModules(token: string): Promise<TrainingModuleDetail[]> {
  // Step 1: Get list (no contentJson in list response)
  const resp = await fetch(`${API_BASE}training/modules?pageSize=500&includeUnpublished=true`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) throw new Error(`Fetch modules failed: ${resp.status}`);
  const body = await resp.json() as { data: TrainingModuleListItem[] };
  const walkthroughs = body.data.filter(m => m.contentType === 'Walkthrough');

  console.log(`  Found ${walkthroughs.length} walkthrough modules in list, fetching details...`);

  // Step 2: Fetch each module's detail to get contentJson
  const details: TrainingModuleDetail[] = [];
  for (const item of walkthroughs) {
    const detailResp = await fetch(`${API_BASE}training/modules/${item.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!detailResp.ok) {
      console.log(`  WARNING: Could not fetch detail for ${item.slug} (${detailResp.status})`);
      continue;
    }
    const detail = await detailResp.json() as TrainingModuleDetail;
    details.push(detail);
  }

  return details;
}

async function checkSelector(page: Page, selector: string): Promise<{
  found: boolean;
  visible: boolean;
  boundingBox: { x: number; y: number; width: number; height: number } | null;
  tagName: string;
  textSnippet: string;
}> {
  try {
    const el = await page.$(selector);
    if (!el) return { found: false, visible: false, boundingBox: null, tagName: '', textSnippet: '' };

    const box = await el.boundingBox();
    const visible = box !== null && box.width > 0 && box.height > 0;
    const tagName = await el.evaluate(e => e.tagName.toLowerCase());
    const textSnippet = (await el.evaluate(e => (e as HTMLElement).innerText || e.textContent || '')).slice(0, 80);

    return { found: true, visible, boundingBox: box, tagName, textSnippet };
  } catch {
    return { found: false, visible: false, boundingBox: null, tagName: '', textSnippet: '' };
  }
}

async function navigateToRoute(page: Page, route: string, slug: string): Promise<boolean> {
  try {
    // Use Angular router navigation via evaluate for SPA routing
    const fullUrl = `${APP_BASE}${route}`;
    await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 20000 });

    // Wait for Angular to render the page content
    await page.waitForTimeout(3000);

    // Verify we're on the expected route (Angular may redirect)
    const currentUrl = page.url();
    const currentPath = new URL(currentUrl).pathname;

    // Check we weren't redirected to login — re-authenticate if so
    if (currentPath.includes('/login') || currentPath.includes('/setup')) {
      console.log(`  [${slug}] Session expired — re-authenticating...`);
      try {
        await login(page);
        await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 20000 });
        await page.waitForTimeout(3000);
        const retryPath = new URL(page.url()).pathname;
        if (retryPath.includes('/login') || retryPath.includes('/setup')) {
          console.log(`  [${slug}] REDIRECTED to ${retryPath} — re-auth failed`);
          return false;
        }
      } catch (err) {
        console.log(`  [${slug}] Re-auth failed: ${err}`);
        return false;
      }
    }

    // For routes like /admin, Angular may redirect to /admin/users — that's OK
    if (!currentPath.startsWith(route.split('?')[0])) {
      console.log(`  [${slug}] NOTE: Route ${route} redirected to ${currentPath}`);
    }

    return true;
  } catch (err) {
    console.log(`  [${slug}] ERROR navigating to ${route}: ${err}`);
    return false;
  }
}

async function main() {
  console.log('Walkthrough Selector Verification');
  console.log('=================================\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  console.log('Logging in...');
  const token = await login(page);

  console.log('\nFetching walkthrough modules...');
  const modules = await fetchWalkthroughModules(token);
  console.log(`Found ${modules.length} walkthrough modules\n`);

  const allResults: SelectorResult[] = [];
  const routeCache = new Map<string, boolean>();
  let totalSelectors = 0;
  let foundCount = 0;
  let missingCount = 0;
  let invisibleCount = 0;

  for (const mod of modules) {
    let content: WalkthroughContent;
    try {
      if (!mod.contentJson) {
        console.log(`  [${mod.slug}] SKIP — no contentJson returned`);
        continue;
      }
      content = JSON.parse(mod.contentJson) as WalkthroughContent;
    } catch {
      console.log(`  [${mod.slug}] SKIP — invalid JSON`);
      continue;
    }

    if (!content.appRoute || !content.steps?.length) {
      console.log(`  [${mod.slug}] SKIP — no route or steps`);
      continue;
    }

    const route = content.appRoute;

    // Always navigate to the route (each module needs a fresh page state)
    const success = await navigateToRoute(page, route, mod.slug);
    if (!success) continue;

    console.log(`  [${mod.slug}] Route: ${route} (${content.steps.length} steps)`);

    for (let i = 0; i < content.steps.length; i++) {
      const step = content.steps[i];
      totalSelectors++;

      const result = await checkSelector(page, step.element);

      const selectorResult: SelectorResult = {
        moduleSlug: mod.slug,
        moduleTitle: mod.title,
        route,
        stepIndex: i + 1,
        stepTitle: step.popover.title,
        selector: step.element,
        ...result,
      };
      allResults.push(selectorResult);

      if (!result.found) {
        missingCount++;
        console.log(`    Step ${i + 1}: ❌ NOT FOUND — "${step.popover.title}" → ${step.element}`);
      } else if (!result.visible) {
        invisibleCount++;
        console.log(`    Step ${i + 1}: ⚠️  HIDDEN  — "${step.popover.title}" → ${step.element} (${result.tagName})`);
      } else {
        foundCount++;
        console.log(`    Step ${i + 1}: ✅ OK      — "${step.popover.title}" → <${result.tagName}> "${result.textSnippet.slice(0, 40)}"`);
      }
    }
  }

  await browser.close();

  // Summary
  console.log('\n═══════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════════════');
  console.log(`Total selectors:  ${totalSelectors}`);
  console.log(`Found & visible:  ${foundCount} ✅`);
  console.log(`Found but hidden: ${invisibleCount} ⚠️`);
  console.log(`Not found:        ${missingCount} ❌`);
  console.log('');

  // List all failures grouped by module
  const failures = allResults.filter(r => !r.found || !r.visible);
  if (failures.length > 0) {
    console.log('FAILURES:');
    let currentSlug = '';
    for (const f of failures) {
      if (f.moduleSlug !== currentSlug) {
        currentSlug = f.moduleSlug;
        console.log(`\n  ${f.moduleSlug} (${f.route}):`);
      }
      const status = !f.found ? '❌ NOT FOUND' : '⚠️  HIDDEN';
      console.log(`    Step ${f.stepIndex}: ${status} — "${f.stepTitle}" → ${f.selector}`);
    }
  } else {
    console.log('All selectors verified! 🎉');
  }

  // Write JSON report
  const fs = await import('fs');
  const path = await import('path');
  const reportDir = path.resolve(__dirname, 'results');
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, 'selector-check.json');
  fs.writeFileSync(reportPath, JSON.stringify({ totalSelectors, foundCount, missingCount, invisibleCount, failures, allResults }, null, 2));
  console.log(`\nFull report: ${reportPath}`);

  if (missingCount > 0) process.exit(1);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(2);
});
