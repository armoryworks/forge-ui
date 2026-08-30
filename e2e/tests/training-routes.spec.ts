import { writeFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import { SEED_PASSWORD, getAuthToken, loginViaApi } from '../helpers/auth.helper';

/**
 * Training must describe the app that actually ships. For every published
 * module: each AppRoute must resolve to a real page (the wildcard route
 * redirects unknown URLs home), and every walkthrough step's `element`
 * selector must exist on that page. A stale module fails the nightly
 * instead of misleading someone on the floor.
 *
 * Note the list endpoint is paginated and its list model carries no
 * appRoutes — both have to come from the per-module detail, or this test
 * passes without checking anything (it did, until 2026-08-27).
 */
const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:5000/api/v1/';
const ADMIN = 'admin@forge.local';
const PAGE_SIZE = 100;

interface ModuleListItem { id: number; slug: string; contentType: string }
interface PagedModules { data: ModuleListItem[]; totalPages: number }
interface ModuleDetail { slug: string; contentType: string; contentJson: string | object; appRoutes: string[] | string | null }
interface WalkthroughContent { appRoute?: string; steps?: { element?: string }[] }

async function fetchJson<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

/** jsonb columns come back as real arrays/objects; older rows can still be JSON text. */
function asArray(value: string[] | string | null): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) return JSON.parse(value) as string[];
  return [];
}

function asObject<T>(value: string | object): T {
  return (typeof value === 'string' ? JSON.parse(value) : value) as T;
}

/** Skipped: the native shell and the kiosk guard their own routes. */
const skipRoute = (route: string): boolean => route.startsWith('/app/') || route.startsWith('/display/') || route.startsWith('/m/');

test.describe('training content matches shipped routes', () => {
  test.setTimeout(20 * 60 * 1000);

  test('every AppRoute exists and every walkthrough target is on its page', async ({ page }) => {
    const token = await getAuthToken(ADMIN, SEED_PASSWORD);
    await loginViaApi(page, ADMIN, SEED_PASSWORD);

    const first = await fetchJson<PagedModules>(token, `training/modules?page=1&pageSize=${PAGE_SIZE}`);
    const items = [...first.data];
    for (let p = 2; p <= first.totalPages; p++) {
      items.push(...(await fetchJson<PagedModules>(token, `training/modules?page=${p}&pageSize=${PAGE_SIZE}`)).data);
    }

    const failures: string[] = [];
    const warnings: string[] = [];
    const routeOk = new Map<string, boolean>();
    let routesChecked = 0;
    let walkthroughsChecked = 0;

    const visit = async (route: string): Promise<boolean> => {
      if (!routeOk.has(route)) {
        // domcontentloaded, not networkidle: SignalR keeps a connection open,
        // so networkidle waits out its timeout on every single navigation.
        await page.goto(route, { waitUntil: 'domcontentloaded' }).catch(() => undefined);
        await page.waitForTimeout(400);   // let the router settle / guards redirect
        const landed = new URL(page.url()).pathname;
        routeOk.set(route, landed === route || landed.startsWith(`${route.replace(/\/$/, '')}/`));
      }
      return routeOk.get(route) as boolean;
    };

    for (const item of items) {
      const detail = await fetchJson<ModuleDetail>(token, `training/modules/${item.id}`);
      const routes = asArray(detail.appRoutes).filter((r) => !skipRoute(r));

      for (const route of routes) {
        routesChecked++;
        if (!(await visit(route))) failures.push(`${detail.slug}: route ${route} redirected away (page gone, or capability off)`);
      }

      if (detail.contentType !== 'Walkthrough') continue;
      const content = asObject<WalkthroughContent>(detail.contentJson);
      if (!content.appRoute || skipRoute(content.appRoute)) continue;
      if (!(await visit(content.appRoute))) continue;   // already reported as a dead route
      walkthroughsChecked++;
      await page.goto(content.appRoute, { waitUntil: 'domcontentloaded' }).catch(() => undefined);
      await page.waitForTimeout(400);

      // Only the first step must be on the page as loaded: later steps may live
      // inside a panel an earlier step opens (a row click, a dialog).
      let firstStep = true;
      for (const step of content.steps ?? []) {
        if (!step.element) continue;
        if (await page.locator(step.element).count().catch(() => 0) === 0) {
          const message = `${detail.slug}: walkthrough target "${step.element}" not found on ${content.appRoute}`;
          if (firstStep) failures.push(message); else warnings.push(message);
        }
        firstStep = false;
      }
    }

    // Guard against the vacuous pass: if the API shape changes under us, this
    // test must fail loudly rather than quietly check nothing.
    expect(items.length, 'no training modules returned').toBeGreaterThan(50);
    expect(routesChecked, 'no AppRoutes were checked — has the detail model changed?').toBeGreaterThan(50);
    expect(walkthroughsChecked, 'no walkthroughs were checked').toBeGreaterThan(5);

    const report = [
      `# Training content vs. shipped routes`,
      ``,
      `- modules: ${items.length}`,
      `- route checks: ${routesChecked} (${routeOk.size} unique)`,
      `- walkthroughs checked: ${walkthroughsChecked}`,
      ``,
      `## Failures (${failures.length})`,
      ...failures.map((f) => `- ${f}`),
      ``,
      `## Warnings — step not on the initial page (${warnings.length})`,
      ...warnings.map((w) => `- ${w}`),
      ``,
    ].join('\n');
    writeFileSync('test-results/training-content-report.md', report);

    if (warnings.length) console.warn(`steps not on the initial page (may need a click):\n  ${warnings.join('\n  ')}`);
    expect(failures, `${failures.length} of ${routesChecked} route checks failed:\n${failures.join('\n')}`).toEqual([]);
  });
});
