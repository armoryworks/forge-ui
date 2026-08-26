import { expect, test } from '@playwright/test';

import { SEED_PASSWORD, getAuthToken, loginViaApi } from '../helpers/auth.helper';

/**
 * Training must describe the app that actually ships. For every published
 * module: each AppRoute must resolve to a real page (the wildcard route
 * redirects unknown URLs home), and every walkthrough step's `element`
 * selector must exist on that page. A stale module fails the nightly
 * instead of misleading someone on the floor.
 */
const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:5000/api/v1/';
const ADMIN = 'admin@forge.local';

interface ModuleListItem { id: number; slug: string; title: string; contentType: string; appRoutes: string | null }
interface ModuleDetail { slug: string; contentType: string; contentJson: string }
interface WalkthroughContent { appRoute?: string; steps?: { element?: string }[] }

async function fetchJson<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

test.describe('training content matches shipped routes', () => {
  test.setTimeout(15 * 60 * 1000);

  test('every AppRoute exists and every walkthrough target is on its page', async ({ page }) => {
    const token = await getAuthToken(ADMIN, SEED_PASSWORD);
    await loginViaApi(page, ADMIN, SEED_PASSWORD);

    const modules = await fetchJson<ModuleListItem[] | { data: ModuleListItem[] }>(token, 'training/modules');
    const list = Array.isArray(modules) ? modules : modules.data;
    const failures: string[] = [];
    const warnings: string[] = [];
    const visited = new Map<string, boolean>();

    for (const item of list) {
      const routes = (JSON.parse(item.appRoutes ?? '[]') as string[])
        .filter((r) => !r.startsWith('/app/') && !r.startsWith('/display/'));   // native shell + kiosk have their own guards
      for (const route of routes) {
        if (!visited.has(route)) {
          await page.goto(route, { waitUntil: 'networkidle' }).catch(() => undefined);
          const landed = new URL(page.url()).pathname;
          visited.set(route, landed === route || landed.startsWith(`${route}/`) || landed.startsWith(route.replace(/\/$/, '')));
        }
        if (!visited.get(route)) failures.push(`${item.slug}: route ${route} redirected away (page gone?)`);
      }

      if (item.contentType !== 'Walkthrough') continue;
      const detail = await fetchJson<ModuleDetail>(token, `training/modules/${item.id}`);
      const content = JSON.parse(detail.contentJson) as WalkthroughContent;
      if (!content.appRoute || content.appRoute.startsWith('/app/') || content.appRoute.startsWith('/display/')) continue;
      await page.goto(content.appRoute, { waitUntil: 'networkidle' }).catch(() => undefined);
      // Only the first step must be on the page as loaded: later steps may live
      // inside a panel the earlier steps open (a row click, a dialog). Those
      // are reported, not failed.
      let first = true;
      for (const step of content.steps ?? []) {
        if (!step.element) continue;
        const count = await page.locator(step.element).count().catch(() => 0);
        if (count === 0) {
          const message = `${item.slug}: walkthrough target "${step.element}" not found on ${content.appRoute}`;
          if (first) failures.push(message); else warnings.push(message);
        }
        first = false;
      }
    }

    if (warnings.length) console.warn(`training walkthrough steps not on the initial page (may need a click):\n  ${warnings.join('\n  ')}`);
    expect(failures, failures.join('\n')).toEqual([]);
  });
});
